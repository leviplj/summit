import type { AppEvent, BeforeQueryContext } from "summit-types";
import { EventStream } from "./EventStream";

export interface StreamEvent {
  id: number;
  timestamp: number;
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
const streamHolds = new Map<string, number>();

// TODO: evaluate whether this timeout is needed. Currently it silently kills
// long-running teammates without notifying the frontend (leaves spinners stuck).
// Teammates already abort via linked signal on user cancel, and provider errors
// are caught by the .catch handler. This only guards against a query that hangs
// forever without resolving or rejecting — unclear if that actually happens.
// If kept, it needs to emit error events to the frontend before releasing.
const HOLD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const streamReleaseCallbacks = new Map<string, Array<() => void>>();
const queryInitListeners = new Set<(sessionId: string, source: string) => void>();
const beforeQueryHooks = new Set<(ctx: BeforeQueryContext) => void | Promise<void>>();

/** Register a callback invoked whenever a new query is initialized. */
export function onQueryInit(listener: (sessionId: string, source: string) => void): () => void {
  queryInitListeners.add(listener);
  return () => queryInitListeners.delete(listener);
}

/** Register a hook invoked before each query executes (after initQuery, before provider.runQuery). */
export function onBeforeQuery(hook: (ctx: BeforeQueryContext) => void | Promise<void>): () => void {
  beforeQueryHooks.add(hook);
  return () => beforeQueryHooks.delete(hook);
}

/** Fire all onBeforeQuery hooks. Hooks can mutate ctx to inject mcpServers/systemPromptSuffix. */
export async function fireBeforeQueryHooks(ctx: BeforeQueryContext): Promise<void> {
  await Promise.all(
    Array.from(beforeQueryHooks).map((hook) =>
      Promise.resolve(hook(ctx)).catch((err) =>
        console.error(`[summit] onBeforeQuery hook error:`, err)
      )
    )
  );
}

export function emit(sessionId: string, data: AppEvent) {
  const q = active.get(sessionId);
  if (!q) return;
  const event: StreamEvent = { id: q.stream.events.length, timestamp: Date.now(), data };
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

export function getAbortController(sessionId: string): AbortController | undefined {
  return abortControllers.get(sessionId);
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

/**
 * Hold the stream open for a session. Returns a release function, or null if no active query.
 * The stream won't close until all holds are released and finalize() has been called.
 */
export function holdStream(sessionId: string): (() => void) | null {
  const aq = active.get(sessionId);
  if (!aq) return null;

  const current = streamHolds.get(sessionId) ?? 0;
  streamHolds.set(sessionId, current + 1);

  let released = false;
  const timeout = setTimeout(() => {
    if (!released) {
      console.warn(`[summit] holdStream safety timeout for session ${sessionId} — auto-releasing`);
      release();
    }
  }, HOLD_TIMEOUT_MS);

  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timeout);

    const holds = (streamHolds.get(sessionId) ?? 1) - 1;
    if (holds <= 0) {
      streamHolds.delete(sessionId);
      // Fire any registered release callbacks
      const callbacks = streamReleaseCallbacks.get(sessionId);
      if (callbacks) {
        streamReleaseCallbacks.delete(sessionId);
        for (const cb of callbacks) cb();
      }
      // If finalize was already called (done=true), now actually close the stream
      const q = active.get(sessionId);
      if (q?.done) {
        q.stream.end();
        setTimeout(() => active.delete(sessionId), 60_000);
      }
    } else {
      streamHolds.set(sessionId, holds);
    }
  };

  return release;
}

/** Check if a session has active stream holds (teammates still running). */
export function hasStreamHolds(sessionId: string): boolean {
  return (streamHolds.get(sessionId) ?? 0) > 0;
}

/** Register a callback to fire when all stream holds for a session are released. */
export function onStreamFullyReleased(sessionId: string, callback: () => void): void {
  const existing = streamReleaseCallbacks.get(sessionId) ?? [];
  existing.push(callback);
  streamReleaseCallbacks.set(sessionId, existing);
}

export function finalize(sessionId: string) {
  const aq = active.get(sessionId);
  if (aq) {
    aq.done = true;
    const holds = streamHolds.get(sessionId) ?? 0;
    if (holds === 0) {
      // No holds — close immediately
      aq.stream.end();
      setTimeout(() => active.delete(sessionId), 60_000);
    }
    // If holds > 0, stream stays open until last hold is released
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
