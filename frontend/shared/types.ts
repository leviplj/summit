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
  agentSessionId: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionListItem {
  id: string;
  title: string;
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
    | "elicitation";
  [key: string]: unknown;
}

export interface ElicitationPayload {
  id: string;
  serverName: string;
  message: string;
  schema?: Record<string, unknown>;
}
