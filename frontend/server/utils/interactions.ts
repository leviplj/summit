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

export function resolveAskUser(sessionId: string, answers: Record<string, string>): boolean {
  const pending = pendingAskUser.get(sessionId);
  if (!pending) return false;
  pending.resolve(answers);
  pendingAskUser.delete(sessionId);
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

export function createPendingAskUser(sessionId: string, source: string): Promise<Record<string, string>> {
  return new Promise<Record<string, string>>((resolve) => {
    pendingAskUser.set(sessionId, { resolve, source });
  });
}

export function createPendingElicitation(elicitationId: string): Promise<ElicitationResult> {
  return new Promise<ElicitationResult>((resolve) => {
    pendingElicitations.set(elicitationId, { resolve });
  });
}

export function getAskUserSource(sessionId: string): string | undefined {
  return pendingAskUser.get(sessionId)?.source;
}

export function cleanupSession(sessionId: string) {
  pendingAskUser.delete(sessionId);
  // Note: elicitations are keyed by elicitationId, not sessionId.
  // They are cleaned up when the query finishes naturally or by abort.
}
