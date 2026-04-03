import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { TeamManager } from "./teamManager";

export function createOrchestratorTools(manager: TeamManager) {
  const spawnTeammate = tool(
    "spawn_teammate",
    "Spawn a new teammate agent to work on a specific task concurrently. The teammate runs in the same session and shared worktree.",
    {
      role: z.string().describe("Short role name (e.g., 'backend', 'frontend', 'qa')"),
      prompt: z.string().describe("Instructions for the teammate — what they should do"),
      model: z.string().optional().describe("Optional model override for this teammate"),
    },
    async (args) => {
      const id = await manager.spawnTeammate(args.role, args.prompt, args.model);
      return {
        content: [{ type: "text" as const, text: `Teammate "${args.role}" spawned with id "${id}". They are now working concurrently.` }],
      };
    },
  );

  const broadcast = tool(
    "broadcast",
    "Send a message to all active teammates.",
    {
      content: z.string().describe("The message to broadcast"),
    },
    async (args) => {
      manager.broadcast("orchestrator", args.content);
      const teammates = manager.getTeammates();
      return {
        content: [{ type: "text" as const, text: `Broadcast sent to ${teammates.length} teammate(s).` }],
      };
    },
  );

  return [spawnTeammate, broadcast];
}

export function createTeammateTools(manager: TeamManager, teammateId: string) {
  const sendMessage = tool(
    "send_message",
    "Send a message to another teammate or the orchestrator.",
    {
      to: z.string().describe("The recipient teammate id or 'orchestrator'"),
      content: z.string().describe("The message content"),
    },
    async (args) => {
      manager.sendMessage(teammateId, args.to, args.content);
      return {
        content: [{ type: "text" as const, text: `Message sent to "${args.to}".` }],
      };
    },
  );

  const receiveMessage = tool(
    "receive_message",
    "Wait for a message from another teammate. Blocks until a message arrives or timeout.",
    {
      from: z.string().optional().describe("Only receive from this specific teammate (optional)"),
      timeout: z.number().optional().describe("Timeout in milliseconds (default: 30000)"),
    },
    async (args) => {
      try {
        const msg = await manager.receiveMessage(teammateId, args.from, args.timeout);
        return {
          content: [{ type: "text" as const, text: `Message from "${msg.from}": ${msg.content}` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: err.message }],
          isError: true,
        };
      }
    },
  );

  return [sendMessage, receiveMessage];
}
