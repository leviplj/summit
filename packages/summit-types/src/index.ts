// =============================================================================
// Session & Message types
// =============================================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  meta?: ChatMessageMeta;
}

export interface ChatMessageMeta {
  duration_ms?: number;
  cost_usd?: number;
  output_tokens?: number;
}

export type SessionStatus = "idle" | "waiting" | "thinking" | "streaming" | "tool" | "elicitation" | "ask_user" | "error";

export interface Conversation {
  id: string;
  role: string;
  status: "idle" | "working" | "done" | "error" | "cancelled";
  messages: ChatMessage[];
  model?: string;
}

export interface StoredSession {
  id: string;
  title: string;
  model: string | null;
  provider: string;
  agentSessionId: string | null;
  projectId: string | null;
  worktreePath: string | null;
  branch: string | null;
  worktrees: Record<string, string>;
  channelMeta?: Record<string, unknown>;
  conversations: Conversation[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  model: string | null;
  provider: string;
  projectId: string | null;
  branch: string | null;
  worktrees: Record<string, string>;
  conversations: Conversation[];
  hasActiveQuery: boolean;
}

// =============================================================================
// Event types
// =============================================================================

export interface AppEvent {
  type:
    | "init"
    | "thinking"
    | "tool_use"
    | "tool_result"
    | "text"
    | "result"
    | "error"
    | "done"
    | "elicitation"
    | "ask_user"
    | "cancelled"
    | "team_created"
    | "conversation_status"
    | "conversation_message"
    | "conversation_done"
    | "turn_done";
  [key: string]: unknown;
}

export interface StreamEvent {
  id: number;
  timestamp: number;
  data: AppEvent;
}

export interface GlobalEvent {
  type: "session_created" | "session_deleted" | "session_updated";
  sessionId: string;
  meta?: Record<string, unknown>;
}

/** Public-facing ActiveQuery (without internal EventStream). */
export interface ActiveQuery {
  done: boolean;
  source: string;
  sessionId: string;
}

// =============================================================================
// Interaction types
// =============================================================================

export interface AskUserOption {
  label: string;
  description: string;
  preview?: string;
}

export interface AskUserQuestion {
  question: string;
  header: string;
  options: AskUserOption[];
}

export interface ElicitationPayload {
  id: string;
  serverName: string;
  message: string;
  schema?: Record<string, unknown>;
}

// =============================================================================
// Project types
// =============================================================================

export interface Project {
  id: string;
  name: string;
  repos: Array<{ name: string; path: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  uncommitted: boolean;
  staged: boolean;
}

// =============================================================================
// Provider types
// =============================================================================

export interface BeforeQueryContext {
  sessionId: string;
  prompt: string;
  source: string;
  mcpServers?: Record<string, unknown>;
  systemPromptSuffix?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
}

export interface QueryContext {
  prompt: string;
  cwd: string;
  additionalDirs: string[];
  systemPromptSuffix: string;
  model: string | null;
  resumeSessionId: string | null;
  abortSignal: AbortSignal;
  mcpServers?: Record<string, unknown>;
  allowedTools?: string[];
  disallowedTools?: string[];
}

export interface InteractionHooks {
  onAskUser: (questions: AskUserQuestion[]) => Promise<Record<string, string>>;
  onElicitation: (request: ElicitationRequest) => Promise<ElicitationResult>;
}

export interface ElicitationRequest {
  serverName: string;
  message: string;
  schema?: Record<string, unknown>;
}

export interface ElicitationResult {
  action: "accept" | "decline";
  content?: Record<string, unknown>;
}

export interface QueryResult {
  stream: AsyncIterable<AppEvent>;
  getSessionId: () => string | null;
  getAssistantText: () => string;
  getAssistantMeta: () => { duration_ms?: number; cost_usd?: number; output_tokens?: number } | null;
}

export interface AgentProvider {
  readonly name: string;
  readonly models: ProviderModel[];

  supports(capability: ProviderCapability): boolean;
  runQuery(ctx: QueryContext, hooks: InteractionHooks): QueryResult;
  complete(prompt: string, model?: string): Promise<string>;
}

export interface ProviderModel {
  id: string;
  label: string;
  default?: boolean;
}

export type ProviderCapability =
  | "resume"
  | "elicitation"
  | "ask_user"
  | "tool_streaming"
  | "mcp_tools"
  | "system_prompt";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
}

// =============================================================================
// Extension types
// =============================================================================

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
    onBeforeQuery(hook: (ctx: BeforeQueryContext) => void | Promise<void>): () => void;
    onGlobal(listener: (event: GlobalEvent) => void): () => void;
    subscribe(sessionId: string, afterId: number): AsyncIterable<StreamEvent> | null;
    emit(sessionId: string, data: AppEvent): void;
    holdStream(sessionId: string): (() => void) | null;
  };

  /** Query management */
  queries: {
    start(sessionId: string, text: string, source?: string): Promise<void>;
    run(sessionId: string, prompt: string, opts: { conversationId: string; source?: string; mcpServers?: Record<string, unknown>; systemPrompt?: string; model?: string }): Promise<void>;
    getActive(sessionId: string): ActiveQuery | undefined;
  };

  /** Provider registration */
  providers: {
    register(provider: AgentProvider): void;
  };

  /** Interaction resolution */
  interactions: {
    resolveAskUser(sessionId: string, answers: Record<string, string>, conversationId?: string): boolean;
    createPendingAskUser(sessionId: string, source: string, conversationId?: string): Promise<Record<string, string>>;
  };

  /** Worktree management */
  worktrees: {
    create(sessionId: string): Promise<string>;
  };
}

export type ExtensionFactory = (api: ExtensionAPI) => void | Promise<void>;
