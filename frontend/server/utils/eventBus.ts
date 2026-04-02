import type { AppEvent } from "~~/shared/types";

export interface StreamEvent {
  id: number;
  data: AppEvent;
}

export interface ActiveQuery {
  events: StreamEvent[];
  done: boolean;
  listeners: Set<(event: StreamEvent) => void>;
  source: string;
  sessionId: string;
}

const active = new Map<string, ActiveQuery>();
const abortControllers = new Map<string, AbortController>();

export function emit(sessionId: string, data: AppEvent) {
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
    listener(q.events[i]!);
  }

  if (q.done) return null;

  q.listeners.add(listener);
  return () => q.listeners.delete(listener);
}

/**
 * Create an ActiveQuery placeholder and AbortController for a new query.
 * Returns false if a query is already running for this session.
 */
export function initQuery(sessionId: string, source: string = "web"): AbortController | null {
  const existing = active.get(sessionId);
  if (existing && !existing.done) return null;

  const aq: ActiveQuery = { events: [], done: false, listeners: new Set(), source, sessionId };
  active.set(sessionId, aq);

  const abortController = new AbortController();
  abortControllers.set(sessionId, abortController);
  return abortController;
}

export function cancelQuery(sessionId: string): boolean {
  const controller = abortControllers.get(sessionId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function getQuerySource(sessionId: string): string | undefined {
  return active.get(sessionId)?.source;
}

export function finalize(sessionId: string) {
  const aq = active.get(sessionId);
  if (aq) {
    aq.done = true;
    aq.listeners.clear();
    setTimeout(() => active.delete(sessionId), 60_000);
  }
  abortControllers.delete(sessionId);
}
