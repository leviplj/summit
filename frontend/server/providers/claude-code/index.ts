import { query } from "@anthropic-ai/claude-agent-sdk";
import { createStreamState, translateMessage } from "./events";
import { ALL_MODELS } from "./models";
import type { AgentProvider, QueryContext, InteractionHooks, QueryResult, ProviderCapability } from "summit-types";

const ALL_CAPABILITIES: ProviderCapability[] = [
  "resume", "elicitation", "ask_user", "tool_streaming", "mcp_tools", "system_prompt",
];

export const claudeCodeProvider: AgentProvider = {
  name: "claude-code",
  models: ALL_MODELS,

  supports(capability: ProviderCapability): boolean {
    return ALL_CAPABILITIES.includes(capability);
  },

  runQuery(ctx: QueryContext, hooks: InteractionHooks): QueryResult {
    const state = createStreamState();
    let capturedSessionId: string | null = null;

    const abortController = new AbortController();
    // Forward external abort signal to our controller
    ctx.abortSignal.addEventListener("abort", () => abortController.abort(), { once: true });

    const sdkQuery = query({
      prompt: ctx.prompt,
      options: {
        abortController,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: ctx.systemPromptSuffix,
        },
        cwd: ctx.cwd,
        ...(ctx.additionalDirs.length > 0 ? { additionalDirectories: ctx.additionalDirs } : {}),
        toolConfig: { askUserQuestion: { previewFormat: "html" } },
        ...(ctx.resumeSessionId ? { resume: ctx.resumeSessionId } : {}),
        ...(ctx.model ? { model: ctx.model } : {}),
        ...(ctx.mcpServers ? { mcpServers: ctx.mcpServers as any } : {}),
        ...(ctx.allowedTools ? { allowedTools: ctx.allowedTools } : {}),
        ...(ctx.disallowedTools ? { disallowedTools: ctx.disallowedTools } : {}),
        canUseTool: async (toolName: string, input: any) => {
          if (toolName === "AskUserQuestion") {
            const answers = await hooks.onAskUser(input.questions);
            return { behavior: "allow" as const, updatedInput: { ...input, answers } };
          }
          return { behavior: "allow" as const };
        },
        onElicitation: async (request: any) => {
          return hooks.onElicitation({
            serverName: request.serverName,
            message: request.message,
            schema: request.requestedSchema,
          });
        },
      },
    });

    const stream = (async function* () {
      for await (const message of sdkQuery) {
        const events = translateMessage(message, state);
        for (const event of events) {
          if (event.type === "init" && event.sessionId) {
            capturedSessionId = event.sessionId;
          }
          yield event;
        }
      }
    })();

    return {
      stream,
      getSessionId: () => capturedSessionId,
      getAssistantText: () => state.assistantText,
      getAssistantMeta: () => state.assistantMeta,
    };
  },

  async complete(prompt: string, model?: string): Promise<string> {
    let result = "";
    const q = query({
      prompt,
      options: {
        maxTurns: 1,
        model: model ?? "haiku",
        allowedTools: [],
      },
    });
    for await (const ev of q) {
      if (ev.type === "result" && "result" in ev) {
        result = (ev as any).result;
        break;
      }
    }
    return result;
  },
};

