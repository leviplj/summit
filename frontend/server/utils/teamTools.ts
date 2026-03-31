import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { TeamManager } from "./teamManager";

/**
 * Create the MCP server with communication tools for a specific teammate.
 */
export function createTeammateMcpServer(teammateId: string, manager: TeamManager) {
  const checkMailbox = tool(
    "check_mailbox",
    "Wait for and receive a message from another teammate. Blocks until a message arrives. Use the optional 'from' parameter to wait for a message from a specific teammate.",
    {
      from: z.string().optional().describe("Only receive messages from this teammate role/ID. If omitted, receives the next message from anyone."),
    },
    async (args) => {
      try {
        const msg = await manager.messageBus.receive(teammateId, args.from);
        return {
          content: [{ type: "text" as const, text: `Message from ${msg.from}: ${msg.content}` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  const sendMessage = tool(
    "send_message",
    "Send a message to another teammate. Use this to share results, endpoint specs, status updates, or coordinate work.",
    {
      to: z.string().describe("The teammate role/ID to send the message to"),
      content: z.string().describe("The message content"),
    },
    async (args) => {
      manager.deliverMessage(teammateId, args.to, args.content);
      return {
        content: [{ type: "text" as const, text: `Message sent to ${args.to}` }],
      };
    },
  );

  const notifyDone = tool(
    "notify_done",
    "Signal that you have completed your assigned work. Call this when all your tasks are finished. Include a summary of what you accomplished.",
    {
      summary: z.string().describe("Summary of what was accomplished"),
    },
    async (args) => {
      manager.markTeammateDone(teammateId, args.summary);
      return {
        content: [{ type: "text" as const, text: "Completion signaled to orchestrator." }],
      };
    },
  );

  return createSdkMcpServer({
    name: "team",
    version: "1.0.0",
    tools: [checkMailbox, sendMessage, notifyDone],
  });
}

/**
 * Create the MCP server with management tools for the orchestrator.
 */
export function createOrchestratorMcpServer(manager: TeamManager) {
  const createTeammate = tool(
    "create_teammate",
    "Spawn a new teammate agent with a specific role. The teammate will run concurrently and can communicate with other teammates via messages.",
    {
      role: z.string().describe("The teammate's role (e.g., 'backend', 'frontend', 'qa')"),
      systemPrompt: z.string().describe("Detailed instructions for the teammate including their scope and responsibilities"),
      scopePath: z.string().optional().describe("Directory path the teammate should focus on"),
    },
    async (args) => {
      try {
        const teammate = await manager.spawnTeammate(args.role, args.systemPrompt, args.scopePath);
        return {
          content: [{ type: "text" as const, text: `Teammate "${args.role}" created with ID "${teammate.id}". They are now working.` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to create teammate: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  const broadcast = tool(
    "broadcast",
    "Send a message to all active teammates simultaneously.",
    {
      content: z.string().describe("The message content to broadcast"),
    },
    async (args) => {
      manager.broadcast("orchestrator", args.content);
      return {
        content: [{ type: "text" as const, text: `Broadcast sent to ${manager.activeTeammateCount} teammates.` }],
      };
    },
  );

  const sendMessage = tool(
    "send_message",
    "Send a message to a specific teammate. Use this to relay user instructions, ask for status, or give new tasks to a particular teammate.",
    {
      to: z.string().describe("The teammate ID to send the message to"),
      content: z.string().describe("The message content"),
    },
    async (args) => {
      manager.deliverMessage("orchestrator", args.to, args.content);
      return {
        content: [{ type: "text" as const, text: `Message sent to ${args.to}.` }],
      };
    },
  );

  const checkMailbox = tool(
    "check_mailbox",
    "Wait for and receive a message from a teammate. Blocks until a message arrives. Use the optional 'from' parameter to wait for a specific teammate. This is how you receive replies from teammates after sending them a message.",
    {
      from: z.string().optional().describe("Only receive messages from this teammate ID. If omitted, receives the next message from anyone."),
    },
    async (args) => {
      try {
        const msg = await manager.messageBus.receive("orchestrator", args.from);
        return {
          content: [{ type: "text" as const, text: `Message from ${msg.from}: ${msg.content}` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  const checkTeamStatus = tool(
    "check_team_status",
    "Check the current status of all teammates without blocking. Returns each teammate's ID, role, status (working/waiting/done/error/cancelled), and completion summary if available.",
    {},
    async () => {
      const statuses = manager.getTeamStatus();
      const lines = statuses.map((s) => {
        let line = `[${s.role}] (${s.id}) — ${s.status}`;
        if (s.summary) line += `\n  Summary: ${s.summary}`;
        return line;
      });
      return {
        content: [{ type: "text" as const, text: lines.join("\n") || "No teammates created yet." }],
      };
    },
  );

  const waitForNextCompletion = tool(
    "wait_for_next_completion",
    "Block until the next teammate finishes (done, error, or cancelled). Returns that single teammate's result. Call this repeatedly to process teammates one at a time as they complete.",
    {},
    async () => {
      try {
        const result = await manager.waitForNextCompletion();
        let text = `[${result.role}] (${result.id}) — ${result.status}`;
        if (result.summary) text += `\nSummary: ${result.summary}`;

        // Also include remaining active count
        const remaining = manager.activeTeammateCount;
        text += `\n\n${remaining} teammate(s) still active.`;
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `${err.message}` }],
          isError: true,
        };
      }
    },
  );

  const cancelTeammate = tool(
    "cancel_teammate",
    "Cancel a specific teammate's work by aborting their query.",
    {
      id: z.string().describe("The teammate ID or role to cancel"),
    },
    async (args) => {
      const cancelled = manager.cancelTeammate(args.id);
      if (cancelled) {
        return {
          content: [{ type: "text" as const, text: `Teammate "${args.id}" has been cancelled.` }],
        };
      }
      return {
        content: [{ type: "text" as const, text: `No active teammate found with ID "${args.id}".` }],
        isError: true,
      };
    },
  );

  const dismissTeam = tool(
    "dismiss_team",
    "Dispose the entire team, cancelling all active teammates. Use when the user explicitly says to end/dismiss/disband the team, or when the project is complete.",
    {},
    async () => {
      manager.dispose();
      return {
        content: [{ type: "text" as const, text: "Team dismissed. All teammates have been cancelled and cleaned up." }],
      };
    },
  );

  return createSdkMcpServer({
    name: "orchestrator",
    version: "1.0.0",
    tools: [createTeammate, broadcast, sendMessage, checkMailbox, checkTeamStatus, waitForNextCompletion, cancelTeammate, dismissTeam],
  });
}
