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

export interface StoredSession {
  id: string;
  title: string;
  model: string | null;
  agentSessionId: string | null;
  projectId: string | null;
  worktreePath: string | null;
  branch: string | null;
  worktrees: Record<string, string>;
  messages: ChatMessage[];
  teamState?: TeamState;
  createdAt: string;
  updatedAt: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  model: string | null;
  projectId: string | null;
  branch: string | null;
  worktrees: Record<string, string>;
  messages: ChatMessage[];
  hasActiveQuery: boolean;
  teamState?: TeamState;
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
    | "turn_done"
    | "elicitation"
    | "ask_user"
    | "cancelled"
    | "team_created"
    | "teammate_message"
    | "teammate_done"
    | "teammate_status";
  teammateId?: string;
  teammateName?: string;
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

// --- Agent Teams ---

export type TeammateStatus = "working" | "waiting" | "done" | "error" | "cancelled";

export interface Teammate {
  id: string;
  role: string;
  status: TeammateStatus;
  scopePath?: string;
}

export interface TeamMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

export interface TeamState {
  teammates: Teammate[];
  messages: TeamMessage[];
}
