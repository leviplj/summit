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

export type SessionStatus = "idle" | "waiting" | "thinking" | "streaming" | "tool" | "elicitation" | "error";

export interface StoredSession {
  id: string;
  title: string;
  model: string | null;
  agentSessionId: string | null;
  worktreePath: string | null;
  branch: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  model: string | null;
  branch: string | null;
  messages: ChatMessage[];
  hasActiveQuery: boolean;
}

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
    | "cancelled";
  [key: string]: unknown;
}

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

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  uncommitted: boolean;
  staged: boolean;
}
