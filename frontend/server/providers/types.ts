import type { AppEvent } from "~~/shared/types";

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
}

export interface InteractionHooks {
  onAskUser: (questions: any[]) => Promise<Record<string, string>>;
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
