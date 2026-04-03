import type { ExtensionFactory } from "summit-types";
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { TeamManager } from "./teamManager";
import { createOrchestratorTools } from "./tools";

const extension: ExtensionFactory = (api) => {
  api.log("Teams extension loaded");

  api.events.onBeforeQuery(async (ctx) => {
    const manager = new TeamManager(api, ctx.sessionId);
    const orchestratorTools = createOrchestratorTools(manager);

    // Inject team tools as an MCP server into every query
    ctx.mcpServers = {
      ...ctx.mcpServers,
      "summit-team-orchestrator": createSdkMcpServer({
        name: "summit-team-orchestrator",
        tools: orchestratorTools,
      }),
    };

    const orchestratorPrompt = [
      "## Team Coordination",
      "You have tools to spawn teammate agents that work concurrently:",
      "- `spawn_teammate`: Spawn a teammate to work on a specific task. Pass a role and detailed prompt.",
      "- `broadcast`: Send a message to all active teammates.",
      "",
      "Use these when the user's request benefits from parallel work by multiple agents.",
      "Do NOT use the built-in Agent tool — use `spawn_teammate` instead.",
    ].join("\n");

    ctx.systemPromptSuffix = ctx.systemPromptSuffix
      ? ctx.systemPromptSuffix + "\n\n" + orchestratorPrompt
      : orchestratorPrompt;

    // Disable the built-in Agent tool so the model uses spawn_teammate
    ctx.disallowedTools = [...(ctx.disallowedTools ?? []), "Agent"];
  });
};

export default extension;
