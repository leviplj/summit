import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AppEvent } from "~~/shared/types";

export interface StreamEvent {
  id: number;
  data: AppEvent;
}

interface ActiveQuery {
  events: StreamEvent[];
  done: boolean;
  listeners: Set<(event: StreamEvent) => void>;
}

interface PendingElicitation {
  resolve: (result: { action: "accept" | "decline"; content?: Record<string, unknown> }) => void;
}

interface PendingAskUser {
  resolve: (answers: Record<string, string>) => void;
}

const active = new Map<string, ActiveQuery>();
const pendingElicitations = new Map<string, PendingElicitation>();
const pendingAskUser = new Map<string, PendingAskUser>();

export function resolveAskUser(sessionId: string, answer: Record<string, string>) {
  const pending = pendingAskUser.get(sessionId);
  if (!pending) return false;
  pending.resolve(answer);
  pendingAskUser.delete(sessionId);
  return true;
}

export function resolveElicitation(
  elicitationId: string,
  result: { action: "accept" | "decline"; content?: Record<string, unknown> },
) {
  const pending = pendingElicitations.get(elicitationId);
  if (!pending) return false;
  pending.resolve(result);
  pendingElicitations.delete(elicitationId);
  return true;
}

function emit(sessionId: string, data: AppEvent) {
  const q = active.get(sessionId);
  if (!q) return;
  const event: StreamEvent = { id: q.events.length, data };
  q.events.push(event);
  for (const listener of q.listeners) {
    listener(event);
  }
}

export function getActiveQuery(sessionId: string): ActiveQuery | undefined {
  return active.get(sessionId);
}

export function getActiveSessionIds(): string[] {
  return Array.from(active.entries())
    .filter(([, q]) => !q.done)
    .map(([id]) => id);
}

export function subscribe(
  sessionId: string,
  afterId: number,
  listener: (event: StreamEvent) => void,
): (() => void) | null {
  const q = active.get(sessionId);
  if (!q) return null;

  for (let i = afterId; i < q.events.length; i++) {
    listener(q.events[i]);
  }

  if (q.done) return null;

  q.listeners.add(listener);
  return () => q.listeners.delete(listener);
}

export async function startQuery(sessionId: string, text: string) {
  const existing = active.get(sessionId);
  if (existing && !existing.done) return;

  // Set placeholder synchronously to prevent race conditions
  const aq: ActiveQuery = { events: [], done: false, listeners: new Set() };
  active.set(sessionId, aq);

  const session = await getStoredSession(sessionId);
  if (!session) {
    active.delete(sessionId);
    return;
  }

  runQuery(session, text, sessionId).catch((err) => {
    emit(sessionId, { type: "error", text: String(err?.message ?? err) });
    finalize(sessionId);
  });
}

function finalize(sessionId: string) {
  const aq = active.get(sessionId);
  if (aq) {
    aq.done = true;
    aq.listeners.clear();
    setTimeout(() => active.delete(sessionId), 60_000);
  }
  pendingAskUser.delete(sessionId);
}

async function runQuery(session: NonNullable<Awaited<ReturnType<typeof getStoredSession>>>, text: string, sessionId: string) {
  const state = createStreamState();
  const errorMessages: Array<{ id: string; role: "error"; content: string }> = [];

  try {
    const q = query({
      prompt: text,
      options: {
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        cwd: session.worktreePath || process.cwd(),
        toolConfig: { askUserQuestion: { previewFormat: "html" } },
        ...(session.agentSessionId ? { resume: session.agentSessionId } : {}),
        canUseTool: async (toolName, input) => {
          if (toolName === "AskUserQuestion") {
            emit(sessionId, { type: "ask_user", questions: input.questions });
            const answers = await new Promise<Record<string, string>>((resolve) => {
              pendingAskUser.set(sessionId, { resolve });
            });
            return { behavior: "allow" as const, updatedInput: { ...input, answers } };
          }
          return { behavior: "allow" as const };
        },
        onElicitation: async (request) => {
          const elicitationId = crypto.randomUUID();
          emit(sessionId, {
            type: "elicitation",
            elicitationId,
            serverName: request.serverName,
            message: request.message,
            schema: request.requestedSchema,
          });
          return new Promise((resolve) => {
            pendingElicitations.set(elicitationId, { resolve });
          });
        },
      },
    });

    for await (const message of q) {
      const appEvents = translateMessage(message, state);
      for (const appEvent of appEvents) {
        // Capture session ID from init
        if (appEvent.type === "init" && appEvent.sessionId && !session.agentSessionId) {
          session.agentSessionId = appEvent.sessionId as string;
        }
        if (appEvent.type === "error") {
          errorMessages.push({ id: String(Date.now()), role: "error", content: appEvent.text as string });
        }
        emit(sessionId, appEvent);
      }
    }
  } catch (err: any) {
    const text = err.message || String(err);
    emit(sessionId, { type: "error", text });
    errorMessages.push({ id: String(Date.now()), role: "error", content: text });
  }

  // Persist
  session.messages.push({ id: String(Date.now() - 1), role: "user", content: text });
  if (state.assistantText) {
    session.messages.push({
      id: String(Date.now()),
      role: "assistant",
      content: state.assistantText,
      ...(state.assistantMeta ? { meta: state.assistantMeta } : {}),
    });
  }
  session.messages.push(...errorMessages);

  if (session.messages.filter((m) => m.role === "user").length === 1) {
    session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
  }

  await saveSession(session);
  emit(sessionId, { type: "done" });
  finalize(sessionId);
}
