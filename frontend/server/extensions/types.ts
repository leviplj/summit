import type { StoredSession, AppEvent } from "~~/shared/types";
import type { AgentProvider } from "~~/server/providers/types";
import type { ActiveQuery, StreamEvent, GlobalEvent } from "~~/server/utils/eventBus";

export interface ExtensionAPI {
  /** Extension name (derived from filename/directory) */
  readonly name: string;

  /** Log a message prefixed with the extension name */
  log(message: string): void;

  /** Register a callback to run on server shutdown */
  onShutdown(callback: () => void | Promise<void>): void;

  /** Session management */
  sessions: {
    get(id: string): Promise<StoredSession | null>;
    save(session: StoredSession): Promise<void>;
    list(): Promise<StoredSession[]>;
  };

  /** Event bus access */
  events: {
    onQueryInit(listener: (sessionId: string, source: string) => void): () => void;
    onGlobal(listener: (event: GlobalEvent) => void): () => void;
    subscribe(sessionId: string, afterId: number, listener: (event: StreamEvent) => void): (() => void) | null;
    emit(sessionId: string, data: AppEvent): void;
  };

  /** Query management */
  queries: {
    start(sessionId: string, text: string, source?: string): Promise<void>;
    getActive(sessionId: string): ActiveQuery | undefined;
  };

  /** Provider registration */
  providers: {
    register(provider: AgentProvider): void;
  };

  /** Interaction resolution */
  interactions: {
    resolveAskUser(sessionId: string, answers: Record<string, string>): boolean;
    createPendingAskUser(sessionId: string, source: string): Promise<Record<string, string>>;
  };

  /** Worktree management */
  worktrees: {
    create(sessionId: string): Promise<string>;
  };
}

export type ExtensionFactory = (api: ExtensionAPI) => void | Promise<void>;
