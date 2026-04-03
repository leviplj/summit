export interface ElicitationResult {
  action: "accept" | "decline";
  content?: Record<string, unknown>;
}

interface PendingAskUser {
  resolve: (answers: Record<string, string>) => void;
  source: string;
}

interface PendingElicitation {
  resolve: (result: ElicitationResult) => void;
}

const pendingAskUser = new Map<string, PendingAskUser>();
const pendingElicitations = new Map<string, PendingElicitation>();

function askUserKey(sessionId: string, conversationId?: string): string {
  return `${sessionId}:${conversationId ?? "lead"}`;
}

export function resolveAskUser(sessionId: string, answers: Record<string, string>, conversationId?: string): boolean {
  const key = askUserKey(sessionId, conversationId);
  const pending = pendingAskUser.get(key);
  if (!pending) return false;
  pending.resolve(answers);
  pendingAskUser.delete(key);
  return true;
}

export function resolveElicitation(
  elicitationId: string,
  result: ElicitationResult,
): boolean {
  const pending = pendingElicitations.get(elicitationId);
  if (!pending) return false;
  pending.resolve(result);
  pendingElicitations.delete(elicitationId);
  return true;
}

export function createPendingAskUser(sessionId: string, source: string, conversationId?: string): Promise<Record<string, string>> {
  const key = askUserKey(sessionId, conversationId);
  return new Promise<Record<string, string>>((resolve) => {
    pendingAskUser.set(key, { resolve, source });
  });
}

export function createPendingElicitation(elicitationId: string): Promise<ElicitationResult> {
  return new Promise<ElicitationResult>((resolve) => {
    pendingElicitations.set(elicitationId, { resolve });
  });
}

export function getAskUserSource(sessionId: string, conversationId?: string): string | undefined {
  const key = askUserKey(sessionId, conversationId);
  return pendingAskUser.get(key)?.source;
}

export function cleanupSession(sessionId: string) {
  for (const key of pendingAskUser.keys()) {
    if (key === sessionId || key.startsWith(`${sessionId}:`)) {
      pendingAskUser.delete(key);
    }
  }
}

/** Clean up only a specific conversation's pending entries, not the whole session. */
export function cleanupConversation(sessionId: string, conversationId: string) {
  pendingAskUser.delete(askUserKey(sessionId, conversationId));
}
