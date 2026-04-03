import { getProvider } from "~~/server/providers/registry";
import { emit, initQuery, finalize, fireBeforeQueryHooks, holdStream, getActiveQuery, getAbortController, hasStreamHolds, onStreamFullyReleased } from "./eventBus";
import type { BeforeQueryContext } from "summit-types";
import { createPendingAskUser, createPendingElicitation, cleanupSession, cleanupConversation } from "./interactions";
import { getSessionCwd, getSessionAdditionalDirs } from "./sessionHelpers";
import { buildSystemPrompt } from "~~/server/providers/claude-code/prompt";
import type { AppEvent, InteractionHooks } from "summit-types";

export async function startQuery(sessionId: string, text: string, source: string = "web") {
  const abortController = initQuery(sessionId, source);
  if (!abortController) return;

  const session = await getStoredSession(sessionId);
  if (!session) {
    finalize(sessionId);
    return;
  }

  const hookCtx: BeforeQueryContext = { sessionId, prompt: text, source };
  await fireBeforeQueryHooks(hookCtx);

  // Clear non-lead conversations at query start
  session.conversations = session.conversations.filter((c) => c.id === "lead");
  const lead = session.conversations[0];

  runQuery(session, lead, text, sessionId, abortController, hookCtx).catch((err) => {
    emit(sessionId, { type: "error", text: String(err?.message ?? err) });
    finalize(sessionId);
  });
}

async function runQuery(
  session: NonNullable<Awaited<ReturnType<typeof getStoredSession>>>,
  lead: NonNullable<Awaited<ReturnType<typeof getStoredSession>>>["conversations"][0],
  text: string,
  sessionId: string,
  abortController: AbortController,
  hookCtx: BeforeQueryContext,
) {
  const provider = getProvider(session.provider ?? "claude-code");
  const errorMessages: Array<{ id: string; role: "error"; content: string }> = [];

  // Persist user message early so external consumers see it immediately
  lead.messages.push({ id: crypto.randomUUID(), role: "user", content: text });
  if (lead.messages.filter((m) => m.role === "user").length === 1) {
    session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
  }
  await saveSession(session);

  const resolvedCwd = getSessionCwd(session);
  console.log(`[summit] Query cwd for session ${sessionId}: ${resolvedCwd} (worktrees: ${JSON.stringify(session.worktrees)}, worktreePath: ${session.worktreePath})`);

  const hooks: InteractionHooks = {
    onAskUser: async (questions) => {
      emit(sessionId, { type: "ask_user", questions });
      return createPendingAskUser(sessionId, "web", "lead");
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

  let systemPromptSuffix = buildSystemPrompt(session);
  if (hookCtx?.systemPromptSuffix) {
    systemPromptSuffix = systemPromptSuffix + "\n\n" + hookCtx.systemPromptSuffix;
  }

  const result = provider.runQuery({
    prompt: text,
    cwd: resolvedCwd,
    additionalDirs: getSessionAdditionalDirs(session),
    systemPromptSuffix,
    model: session.model,
    resumeSessionId: session.agentSessionId,
    abortSignal: abortController.signal,
    ...(hookCtx?.mcpServers ? { mcpServers: hookCtx.mcpServers } : {}),
    ...(hookCtx?.allowedTools ? { allowedTools: hookCtx.allowedTools } : {}),
    ...(hookCtx?.disallowedTools ? { disallowedTools: hookCtx.disallowedTools } : {}),
  }, hooks);

  try {
    for await (const appEvent of result.stream) {
      if (appEvent.type === "init" && appEvent.sessionId && !session.agentSessionId) {
        session.agentSessionId = appEvent.sessionId as string;
      }
      if (appEvent.type === "error") {
        errorMessages.push({ id: crypto.randomUUID(), role: "error", content: appEvent.text as string });
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
      errorMessages.push({ id: crypto.randomUUID(), role: "error", content: text });
    }
  }

  // Persist assistant response and errors to lead conversation
  const assistantText = result.getAssistantText();
  if (assistantText) {
    lead.messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: assistantText,
      ...(result.getAssistantMeta() ? { meta: result.getAssistantMeta()! } : {}),
    });
  }
  lead.messages.push(...errorMessages);

  await saveSession(session);

  // If teammates are still active (stream holds > 0), emit turn_done
  // instead of done — the stream stays open for teammate events.
  if (hasStreamHolds(sessionId)) {
    emit(sessionId, { type: "turn_done" });
    onStreamFullyReleased(sessionId, () => {
      emit(sessionId, { type: "done" });
      finalize(sessionId);
    });
  } else {
    emit(sessionId, { type: "done" });
    cleanupSession(sessionId);
    finalize(sessionId);
  }
}

/**
 * Run a sub-query within an already-active session.
 * Bypasses initQuery() — shares the existing EventStream.
 * Tags all events with conversationId. Auto-holds/releases the stream.
 */
export async function runSubQuery(
  sessionId: string,
  prompt: string,
  opts: { conversationId: string; source?: string; mcpServers?: Record<string, unknown>; systemPrompt?: string; model?: string },
): Promise<void> {
  const aq = getActiveQuery(sessionId);
  if (!aq) throw new Error(`No active query for session ${sessionId}`);

  const release = holdStream(sessionId);
  if (!release) throw new Error(`Cannot hold stream for session ${sessionId}`);

  try {
    const session = await getStoredSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const provider = getProvider(session.provider ?? "claude-code");
    const { conversationId } = opts;

    // Link to parent's abort signal so cancelling the session propagates
    const abortController = new AbortController();
    const parentController = getAbortController(sessionId);
    const onParentAbort = () => abortController.abort();
    parentController?.signal.addEventListener("abort", onParentAbort);

    const errorMessages: Array<{ id: string; role: "error"; content: string }> = [];
    const emitTagged = (data: AppEvent) => emit(sessionId, { ...data, conversationId });

    const resolvedCwd = getSessionCwd(session);

    const hooks: InteractionHooks = {
      onAskUser: async (questions) => {
        emitTagged({ type: "ask_user", questions } as AppEvent);
        return createPendingAskUser(sessionId, opts.source ?? "extension", conversationId);
      },
      onElicitation: async (request) => {
        const elicitationId = crypto.randomUUID();
        emitTagged({
          type: "elicitation",
          elicitationId,
          serverName: request.serverName,
          message: request.message,
          schema: request.schema,
        } as AppEvent);
        return createPendingElicitation(elicitationId);
      },
    };

    const systemPromptSuffix = opts.systemPrompt
      ? `${buildSystemPrompt(session)}\n\n${opts.systemPrompt}`
      : buildSystemPrompt(session);

    const result = provider.runQuery({
      prompt,
      cwd: resolvedCwd,
      additionalDirs: getSessionAdditionalDirs(session),
      systemPromptSuffix,
      model: opts.model ?? session.model,
      resumeSessionId: null, // sub-queries don't resume
      abortSignal: abortController.signal,
      ...(opts.mcpServers ? { mcpServers: opts.mcpServers } : {}),
    }, hooks);

    try {
      for await (const appEvent of result.stream) {
        if (appEvent.type === "error") {
          errorMessages.push({ id: crypto.randomUUID(), role: "error", content: appEvent.text as string });
        }
        emitTagged(appEvent);
      }
    } catch (err: any) {
      const aborted = abortController.signal.aborted || err?.name === "AbortError";
      if (aborted) {
        emitTagged({ type: "cancelled" } as AppEvent);
      } else {
        const text = err.message || String(err);
        emitTagged({ type: "error", text } as AppEvent);
        errorMessages.push({ id: crypto.randomUUID(), role: "error", content: text });
      }
    }

    parentController?.signal.removeEventListener("abort", onParentAbort);

    // Persist agent's messages to conversation
    let conversation = session.conversations.find((c) => c.id === conversationId);
    if (!conversation) {
      conversation = { id: conversationId, role: conversationId, status: "working", messages: [] };
      session.conversations.push(conversation);
    }
    const assistantText = result.getAssistantText();
    if (assistantText) {
      conversation.messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantText,
        ...(result.getAssistantMeta() ? { meta: result.getAssistantMeta()! } : {}),
      });
    }
    conversation.messages.push(...errorMessages);
    await saveSession(session);

    emitTagged({ type: "done" } as AppEvent);
    cleanupConversation(sessionId, conversationId);
  } finally {
    release();
  }
}
