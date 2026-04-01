import { query } from "@anthropic-ai/claude-agent-sdk";
import { MessageBus } from "./messageBus";
import { createTeammateMcpServer } from "./teamTools";
import { createStreamState, translateMessage } from "./agentEvents";
import type { AppEvent, StoredSession, Teammate, TeamMessage, TeammateStatus } from "~~/shared/types";

interface TeammateEntry {
  id: string;
  role: string;
  status: TeammateStatus;
  scopePath?: string;
  abortController: AbortController;
  doneSummary?: string;
}

interface TeamWaiter {
  resolve: (summaries: Array<{ role: string; summary: string }>) => void;
}

interface CompletionWaiter {
  resolve: (entry: { id: string; role: string; status: TeammateStatus; summary?: string }) => void;
}

type EmitFn = (sessionId: string, data: AppEvent) => void;
type CanUseToolFn = (toolName: string, input: any, extraEmitFields?: Record<string, unknown>) => Promise<{ behavior: "allow"; updatedInput?: any }>;
type OnElicitationFn = (request: any, extraEmitFields?: Record<string, unknown>) => Promise<any>;

export class TeamManager {
  readonly messageBus = new MessageBus();
  private teammates = new Map<string, TeammateEntry>();
  private teamWaiters: TeamWaiter[] = [];
  private completionQueue: Array<{ id: string; role: string; status: TeammateStatus; summary?: string }> = [];
  private completionWaiters: CompletionWaiter[] = [];
  private sessionId: string;
  private session: StoredSession;
  private emitFn: EmitFn;
  private canUseToolFn: CanUseToolFn;
  private onElicitationFn: OnElicitationFn;
  private firstTeammateCreated = false;
  private onAllTeammateDoneFn?: () => void;

  constructor(
    sessionId: string,
    session: StoredSession,
    emitFn: EmitFn,
    canUseToolFn: CanUseToolFn,
    onElicitationFn: OnElicitationFn,
  ) {
    this.sessionId = sessionId;
    this.session = session;
    this.emitFn = emitFn;
    this.canUseToolFn = canUseToolFn;
    this.onElicitationFn = onElicitationFn;
  }

  /**
   * Update handler references when reusing across query turns.
   */
  updateHandlers(emitFn: EmitFn, canUseToolFn: CanUseToolFn, onElicitationFn: OnElicitationFn): void {
    this.emitFn = emitFn;
    this.canUseToolFn = canUseToolFn;
    this.onElicitationFn = onElicitationFn;
  }

  /**
   * Register a callback to fire when all teammates reach a terminal state.
   */
  onAllTeammateDone(fn: () => void): void {
    this.onAllTeammateDoneFn = fn;
  }

  get activeTeammateCount(): number {
    return Array.from(this.teammates.values()).filter(
      (t) => t.status === "working" || t.status === "waiting",
    ).length;
  }

  get allTeammateIds(): string[] {
    return Array.from(this.teammates.keys());
  }

  getTeammates(): Teammate[] {
    return Array.from(this.teammates.values()).map((t) => ({
      id: t.id,
      role: t.role,
      status: t.status,
      scopePath: t.scopePath,
    }));
  }

  /**
   * Spawn a new teammate query() running concurrently.
   */
  async spawnTeammate(role: string, systemPrompt: string, scopePath?: string): Promise<Teammate> {
    const id = role.toLowerCase().replace(/\s+/g, "-");
    if (this.teammates.has(id)) {
      throw new Error(`Teammate with role "${role}" already exists`);
    }

    const abortController = new AbortController();
    const entry: TeammateEntry = {
      id,
      role,
      status: "working",
      scopePath,
      abortController,
    };
    this.teammates.set(id, entry);

    // Emit team_created on first teammate
    if (!this.firstTeammateCreated) {
      this.firstTeammateCreated = true;
      this.emitFn(this.sessionId, {
        type: "team_created",
        teammates: this.getTeammates(),
      });
    } else {
      // Emit updated team state for subsequent teammates
      this.emitFn(this.sessionId, {
        type: "team_created",
        teammates: this.getTeammates(),
      });
    }

    this.emitFn(this.sessionId, {
      type: "teammate_status",
      teammateId: id,
      teammateName: role,
      status: "working",
    });

    // Build teammate system prompt with team awareness
    const otherTeammates = Array.from(this.teammates.values())
      .filter((t) => t.id !== id)
      .map((t) => `- ${t.role} (ID: ${t.id})${t.scopePath ? ` — working in ${t.scopePath}` : ""}`)
      .join("\n");

    const fullPrompt = `${systemPrompt}

You are part of a team. Your role is: ${role}
Your teammate ID is: ${id}
${scopePath ? `Your workspace scope: ${scopePath}` : ""}

Other teammates:
${otherTeammates || "(none yet — the orchestrator will broadcast the full roster once the team is assembled)"}

You have the following team communication tools:
- check_mailbox: Wait for a message from another teammate or the orchestrator. Use the 'from' parameter to wait for a specific teammate.
- send_message: Send a message to another teammate by their ID (e.g., "backend", "frontend"), or to "orchestrator" to reply to the orchestrator.
- notify_done: Signal that you have completed ALL your work. Only call this when you are truly finished with everything.

IMPORTANT: Start by calling check_mailbox to receive the initial broadcast from the orchestrator.
IMPORTANT: After handling each message, call check_mailbox again to wait for the next one. Keep looping — do NOT call notify_done until you are explicitly told the project is complete or you have no more work to do.
IMPORTANT: When you need to reply to the orchestrator (e.g., to ask the user a question or report progress), use send_message with to="orchestrator", then call check_mailbox to wait for their response.`;

    // Start the teammate query in the background
    this.runTeammateQuery(id, role, fullPrompt, abortController);

    return { id, role, status: "working", scopePath };
  }

  private async runTeammateQuery(
    id: string,
    role: string,
    prompt: string,
    abortController: AbortController,
  ): Promise<void> {
    const state = createStreamState();
    const mcpServer = createTeammateMcpServer(id, this);

    const resolvedCwd = this.getSessionCwd();
    const additionalDirs = this.getSessionAdditionalDirs();

    try {
      const q = query({
        prompt,
        options: {
          abortController,
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          includePartialMessages: true,
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
          },
          cwd: resolvedCwd,
          ...(additionalDirs.length > 0 ? { additionalDirectories: additionalDirs } : {}),
          mcpServers: { team: mcpServer },
          allowedTools: ["mcp__team__*"],
          ...(this.session.model ? { model: this.session.model } : {}),
          canUseTool: async (toolName: string, input: any) => {
            return this.canUseToolFn(toolName, input, { teammateId: id, teammateName: role });
          },
          onElicitation: async (request: any) => {
            return this.onElicitationFn(request, { teammateId: id, teammateName: role });
          },
        },
      });

      for await (const message of q) {
        if (abortController.signal.aborted) break;
        const appEvents = translateMessage(message, state);
        for (const appEvent of appEvents) {
          // Attach teammate identity to every event
          this.emitFn(this.sessionId, {
            ...appEvent,
            teammateId: id,
            teammateName: role,
          });
        }
      }

      // Query finished — finalize the teammate (emits done events now that generation is complete)
      this.finalizeTeammate(id);
    } catch (err: any) {
      const aborted = abortController.signal.aborted || err?.name === "AbortError";
      if (aborted) {
        this.updateStatus(id, "cancelled");
        this.notifyIndividualCompletion(id, role, "cancelled");
      } else {
        this.emitFn(this.sessionId, {
          type: "error",
          text: `Teammate "${role}" error: ${err.message}`,
          teammateId: id,
          teammateName: role,
        });
        this.updateStatus(id, "error");
        this.notifyIndividualCompletion(id, role, "error");
      }
    }
  }

  /**
   * Deliver a message between teammates (called by send_message tool).
   */
  deliverMessage(from: string, to: string, content: string): void {
    const msg: TeamMessage = {
      id: crypto.randomUUID(),
      from,
      to,
      content,
      timestamp: Date.now(),
    };
    this.messageBus.deliver(msg);

    // Emit message events to both sender and recipient streams
    this.emitFn(this.sessionId, {
      type: "teammate_message",
      teammateId: from,
      teammateName: this.teammates.get(from)?.role ?? from,
      direction: "sent",
      to,
      toName: this.teammates.get(to)?.role ?? to,
      content,
    });
    this.emitFn(this.sessionId, {
      type: "teammate_message",
      teammateId: to,
      teammateName: this.teammates.get(to)?.role ?? to,
      direction: "received",
      from,
      fromName: this.teammates.get(from)?.role ?? from,
      content,
    });
  }

  /**
   * Mark a teammate as done (called by notify_done tool).
   */
  markTeammateDone(id: string, summary: string): void {
    const entry = this.teammates.get(id);
    if (!entry) return;
    // Just record the summary — the actual "done" transition happens
    // in finalizeTeammate() after the query finishes generating.
    entry.doneSummary = summary;
  }

  /**
   * Finalize a teammate after their query completes. If they called notify_done,
   * emit the done events now. Otherwise treat as an implicit completion.
   */
  finalizeTeammate(id: string): void {
    const entry = this.teammates.get(id);
    if (!entry || entry.status === "done" || entry.status === "cancelled" || entry.status === "error") return;

    const summary = entry.doneSummary || "Completed";
    entry.status = "done";

    this.emitFn(this.sessionId, {
      type: "teammate_done",
      teammateId: id,
      teammateName: entry.role,
      summary,
    });
    this.updateStatus(id, "done");
    this.notifyIndividualCompletion(id, entry.role, "done", summary);
    this.checkTeamCompletion();
  }

  /**
   * Block until all teammates have called notify_done.
   */
  async waitForTeam(): Promise<Array<{ role: string; summary: string }>> {
    // Check if all already done
    const allDone = Array.from(this.teammates.values()).every(
      (t) => t.status === "done" || t.status === "error" || t.status === "cancelled",
    );
    if (allDone) {
      return this.collectSummaries();
    }

    return new Promise<Array<{ role: string; summary: string }>>((resolve) => {
      this.teamWaiters.push({ resolve });
    });
  }

  /**
   * Return current status of all teammates (non-blocking).
   */
  getTeamStatus(): Array<{ id: string; role: string; status: TeammateStatus; summary?: string }> {
    return Array.from(this.teammates.values()).map((t) => ({
      id: t.id,
      role: t.role,
      status: t.status,
      ...(t.doneSummary ? { summary: t.doneSummary } : {}),
    }));
  }

  /**
   * Block until the next teammate completes (done/error/cancelled).
   * Returns immediately if there's already a completion in the queue that
   * hasn't been consumed yet.
   */
  async waitForNextCompletion(): Promise<{ id: string; role: string; status: TeammateStatus; summary?: string }> {
    // Check if there's already a queued completion
    if (this.completionQueue.length > 0) {
      return this.completionQueue.shift()!;
    }

    // Check if all teammates are already terminal (nothing left to wait for)
    const anyActive = Array.from(this.teammates.values()).some(
      (t) => t.status === "working" || t.status === "waiting",
    );
    if (!anyActive) {
      throw new Error("No active teammates to wait for — all have already completed.");
    }

    return new Promise<{ id: string; role: string; status: TeammateStatus; summary?: string }>((resolve) => {
      this.completionWaiters.push({ resolve });
    });
  }

  /**
   * Cancel a specific teammate.
   */
  cancelTeammate(id: string): boolean {
    const entry = this.teammates.get(id);
    if (!entry || entry.status === "done" || entry.status === "cancelled") return false;
    entry.abortController.abort();
    entry.status = "cancelled";
    this.messageBus.rejectWaitersFor(id);
    this.updateStatus(id, "cancelled");
    this.notifyIndividualCompletion(id, entry.role, "cancelled");
    this.checkTeamCompletion();
    return true;
  }

  /**
   * Cancel all teammates (user pressed stop).
   */
  cancelAll(): void {
    for (const [id, entry] of this.teammates) {
      if (entry.status === "working" || entry.status === "waiting") {
        entry.abortController.abort();
        entry.status = "cancelled";
        this.updateStatus(id, "cancelled");
      }
    }
    this.messageBus.dispose();
  }

  /**
   * Broadcast a message from the orchestrator to all teammates.
   */
  broadcast(from: string, content: string): void {
    this.messageBus.broadcast(from, content, this.allTeammateIds);
  }

  /**
   * Dispose and clean up all resources.
   */
  dispose(): void {
    this.cancelAll();
    this.messageBus.dispose();
    this.teammates.clear();
    this.teamWaiters = [];
    this.completionQueue = [];
    this.completionWaiters = [];
    this.firstTeammateCreated = false;
    // Reset the bus so it can be reused if the orchestrator creates a new team
    this.messageBus.reset();
  }

  private updateStatus(id: string, status: TeammateStatus): void {
    const entry = this.teammates.get(id);
    if (entry) entry.status = status;
    this.emitFn(this.sessionId, {
      type: "teammate_status",
      teammateId: id,
      teammateName: entry?.role ?? id,
      status,
    });
  }

  private notifyIndividualCompletion(id: string, role: string, status: TeammateStatus, summary?: string): void {
    const completion = { id, role, status, ...(summary ? { summary } : {}) };
    if (this.completionWaiters.length > 0) {
      const waiter = this.completionWaiters.shift()!;
      waiter.resolve(completion);
    } else {
      this.completionQueue.push(completion);
    }
  }

  private checkTeamCompletion(): void {
    const allDone = Array.from(this.teammates.values()).every(
      (t) => t.status === "done" || t.status === "error" || t.status === "cancelled",
    );
    if (allDone) {
      if (this.teamWaiters.length > 0) {
        const summaries = this.collectSummaries();
        for (const waiter of this.teamWaiters) {
          waiter.resolve(summaries);
        }
        this.teamWaiters = [];
      }
      if (this.onAllTeammateDoneFn) {
        this.onAllTeammateDoneFn();
        this.onAllTeammateDoneFn = undefined;
      }
    }
  }

  private collectSummaries(): Array<{ role: string; summary: string }> {
    return Array.from(this.teammates.values())
      .filter((t) => t.doneSummary)
      .map((t) => ({ role: t.role, summary: t.doneSummary! }));
  }

  private getSessionCwd(): string {
    const wts = this.session.worktrees;
    if (wts && Object.keys(wts).length > 0) {
      const entries = Object.values(wts);
      if (entries.length === 1) return entries[0];
      return this.session.worktreePath || process.cwd();
    }
    return this.session.worktreePath || process.cwd();
  }

  private getSessionAdditionalDirs(): string[] {
    const wts = this.session.worktrees;
    if (wts && Object.keys(wts).length > 1) {
      return Object.values(wts);
    }
    return [];
  }
}
