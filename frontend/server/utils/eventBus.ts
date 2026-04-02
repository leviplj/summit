import type { AppEvent } from "~~/shared/types";
import { EventStream } from "./EventStream";

export interface StreamEvent {
  id: number;
  data: AppEvent;
}

export interface ActiveQuery {
  stream: EventStream<StreamEvent>;
  done: boolean;
  source: string;
  sessionId: string;
}

const active = new Map<string, ActiveQuery>();
const abortControllers = new Map<string, AbortController>();
const queryInitListeners = new Set<(sessionId: string, source: string) => void>();

/** Register a callback invoked whenever a new query is initialized. */
export function onQueryInit(listener: (sessionId: string, source: string) => void): () => void {
  queryInitListeners.add(listener);
  return () => queryInitListeners.delete(listener);
}

export function emit(sessionId: string, data: AppEvent) {
  const q = active.get(sessionId);
  if (!q) return;
  const event: StreamEvent = { id: q.stream.events.length, data };
  q.stream.push(event);
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
): AsyncIterable<StreamEvent> | null {
  const q = active.get(sessionId);
  if (!q) return null;
  return q.stream.subscribe(afterId);
}

/**
 * Create an ActiveQuery placeholder and AbortController for a new query.
 * Returns false if a query is already running for this session.
 */
export function initQuery(sessionId: string, source: string = "web"): AbortController | null {
  const existing = active.get(sessionId);
  if (existing && !existing.done) return null;

  const aq: ActiveQuery = { stream: new EventStream(), done: false, source, sessionId };
  active.set(sessionId, aq);

  const abortController = new AbortController();
  abortControllers.set(sessionId, abortController);

  for (const listener of queryInitListeners) {
    listener(sessionId, source);
  }

  emitGlobal({ type: "session_updated", sessionId });

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
    aq.stream.end();
    setTimeout(() => active.delete(sessionId), 60_000);
  }
  abortControllers.delete(sessionId);
}

// --- Global broadcast (session-level lifecycle events) ---

export interface GlobalEvent {
  type: "session_created" | "session_deleted" | "session_updated";
  sessionId: string;
  meta?: Record<string, unknown>;
}

const globalListeners = new Set<(event: GlobalEvent) => void>();

export function emitGlobal(event: GlobalEvent) {
  for (const listener of globalListeners) {
    listener(event);
  }
}

export function onGlobal(listener: (event: GlobalEvent) => void): () => void {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}
