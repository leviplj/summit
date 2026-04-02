import { listProviders } from "~~/server/providers/registry";
import "~~/server/providers/claude-code";

export default defineEventHandler(() => {
  return listProviders().map((p) => ({
    name: p.name,
    models: p.models,
    capabilities: [
      "resume", "elicitation", "ask_user", "tool_streaming", "mcp_tools", "system_prompt",
    ].filter((cap) => p.supports(cap as any)),
  }));
});
