import { getProvider } from "~~/server/providers/registry";
import { emit, initQuery, finalize } from "./eventBus";
import { createPendingAskUser, createPendingElicitation, cleanupSession } from "./interactions";
import { getSessionCwd, getSessionAdditionalDirs } from "./sessionHelpers";
import { buildSystemPrompt } from "~~/server/providers/claude-code/prompt";
import type { InteractionHooks } from "~~/server/providers/types";

export async function startQuery(sessionId: string, text: string, source: string = "web") {
  const abortController = initQuery(sessionId, source);
  if (!abortController) return;

  const session = await getStoredSession(sessionId);
  if (!session) {
    finalize(sessionId);
    return;
  }

  runQuery(session, text, sessionId, abortController).catch((err) => {
    emit(sessionId, { type: "error", text: String(err?.message ?? err) });
    finalize(sessionId);
  });
}

async function runQuery(
  session: NonNullable<Awaited<ReturnType<typeof getStoredSession>>>,
  text: string,
  sessionId: string,
  abortController: AbortController,
) {
  const provider = getProvider(session.provider ?? "claude-code");
  const errorMessages: Array<{ id: string; role: "error"; content: string }> = [];

  // Persist user message early so external consumers (web UI via global events) see it immediately
  session.messages.push({ id: String(Date.now() - 1), role: "user", content: text });
  if (session.messages.filter((m) => m.role === "user").length === 1) {
    session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
  }
  await saveSession(session);

  const resolvedCwd = getSessionCwd(session);
  console.log(`[summit] Query cwd for session ${sessionId}: ${resolvedCwd} (worktrees: ${JSON.stringify(session.worktrees)}, worktreePath: ${session.worktreePath})`);

  const hooks: InteractionHooks = {
    onAskUser: async (questions) => {
      emit(sessionId, { type: "ask_user", questions });
      return createPendingAskUser(sessionId, "web");
    },
    onElicitation: async (request) => {
      const elicitationId = crypto.randomUUID();
      emit(sessionId, {
        type: "elicitation",
        elicitationId,
        serverName: request.serverName,
        message: request.message,
        schema: request.schema,
      });
      return createPendingElicitation(elicitationId);
    },
  };

  const systemPromptSuffix = buildSystemPrompt(session);

  const result = provider.runQuery({
    prompt: text,
    cwd: resolvedCwd,
    additionalDirs: getSessionAdditionalDirs(session),
    systemPromptSuffix,
    model: session.model,
    resumeSessionId: session.agentSessionId,
    abortSignal: abortController.signal,
  }, hooks);

  try {
    for await (const appEvent of result.stream) {
      if (appEvent.type === "init" && appEvent.sessionId && !session.agentSessionId) {
        session.agentSessionId = appEvent.sessionId as string;
      }
      if (appEvent.type === "error") {
        errorMessages.push({ id: String(Date.now()), role: "error", content: appEvent.text as string });
      }
      emit(sessionId, appEvent);
    }
  } catch (err: any) {
    const aborted = abortController.signal.aborted || err?.name === "AbortError";
    if (aborted) {
      emit(sessionId, { type: "cancelled" });
    } else {
      const text = err.message || String(err);
      emit(sessionId, { type: "error", text });
      errorMessages.push({ id: String(Date.now()), role: "error", content: text });
    }
  }

  // Persist assistant response and errors
  const assistantText = result.getAssistantText();
  if (assistantText) {
    session.messages.push({
      id: String(Date.now()),
      role: "assistant",
      content: assistantText,
      ...(result.getAssistantMeta() ? { meta: result.getAssistantMeta()! } : {}),
    });
  }
  session.messages.push(...errorMessages);

  await saveSession(session);
  emit(sessionId, { type: "done" });
  cleanupSession(sessionId);
  finalize(sessionId);
}
