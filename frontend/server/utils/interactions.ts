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

export function resolveAskUser(sessionId: string, answers: Record<string, string>, askId?: string): boolean {
  const key = askId ? `${sessionId}:${askId}` : sessionId;
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

export function createPendingAskUser(sessionId: string, source: string, askId?: string): Promise<Record<string, string>> {
  const key = askId ? `${sessionId}:${askId}` : sessionId;
  return new Promise<Record<string, string>>((resolve) => {
    pendingAskUser.set(key, { resolve, source });
  });
}

export function createPendingElicitation(elicitationId: string): Promise<ElicitationResult> {
  return new Promise<ElicitationResult>((resolve) => {
    pendingElicitations.set(elicitationId, { resolve });
  });
}

export function getAskUserSource(sessionId: string, askId?: string): string | undefined {
  const key = askId ? `${sessionId}:${askId}` : sessionId;
  return pendingAskUser.get(key)?.source;
}

export function cleanupSession(sessionId: string) {
  pendingAskUser.delete(sessionId);
  // Also clean up any composite keys from sub-queries (sessionId:askId)
  for (const key of pendingAskUser.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      pendingAskUser.delete(key);
    }
  }
  // Note: elicitations are keyed by elicitationId, not sessionId.
  // They are cleaned up when the query finishes naturally or by abort.
}
