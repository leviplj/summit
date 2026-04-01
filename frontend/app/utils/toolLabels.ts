const TOOL_LABELS: Record<string, (input: Record<string, any>) => string> = {
  Read: (i) => `Reading ${i.file_path || "file"}`,
  Write: (i) => `Writing ${i.file_path || "file"}`,
  Edit: (i) => `Editing ${i.file_path || "file"}`,
  Bash: (i) => `$ ${i.command || "command"}`,
  Glob: (i) => `Searching files: ${i.pattern || ""}`,
  Grep: (i) => `Searching for: ${i.pattern || ""}`,
  WebFetch: (i) => `Fetching ${i.url || "URL"}`,
  WebSearch: (i) => `Searching: ${i.query || ""}`,
  ToolSearch: (i) => `ToolSearch: ${i.query || ""}`,
  // Orchestrator team tools
  mcp__orchestrator__create_teammate: (i) => `Creating teammate: ${i.role || ""}`,
  mcp__orchestrator__broadcast: () => "Broadcasting to team",
  mcp__orchestrator__send_message: (i) => `Message → ${i.to || "teammate"}`,
  mcp__orchestrator__check_mailbox: (i) => i.from ? `Waiting for message from ${i.from}` : "Waiting for teammate message",
  mcp__orchestrator__check_team_status: () => "Checking team status",
  mcp__orchestrator__wait_for_next_completion: () => "Waiting for teammate to finish",
  mcp__orchestrator__cancel_teammate: (i) => `Cancelling ${i.id || "teammate"}`,
  mcp__orchestrator__dismiss_team: () => "Dismissing team",
  // Teammate tools
  mcp__team__check_mailbox: (i) => i.from ? `Waiting for message from ${i.from}` : "Waiting for message",
  mcp__team__send_message: (i) => `Message → ${i.to || "teammate"}`,
  mcp__team__notify_done: () => "Finishing up",
};

export function formatToolUse(tool: string, input?: Record<string, any>): string {
  if (!input) return `Using ${tool}`;
  const fn = TOOL_LABELS[tool];
  if (fn) return fn(input);
  const s = input.file_path || input.command || input.pattern || input.query || "";
  return s ? `${tool}: ${s}` : `Using ${tool}`;
}
