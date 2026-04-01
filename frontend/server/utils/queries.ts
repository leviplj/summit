import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AppEvent } from "~~/shared/types";
import { TeamManager } from "./teamManager";
import { createOrchestratorMcpServer } from "./teamTools";

export interface StreamEvent {
  id: number;
  data: AppEvent;
}

interface ActiveQuery {
  events: StreamEvent[];
  done: boolean;
  listeners: Set<(event: StreamEvent) => void>;
}

interface PendingElicitation {
  resolve: (result: { action: "accept" | "decline"; content?: Record<string, unknown> }) => void;
}

interface PendingAskUser {
  resolve: (answers: Record<string, string>) => void;
}

const active = new Map<string, ActiveQuery>();
const abortControllers = new Map<string, AbortController>();
const pendingElicitations = new Map<string, PendingElicitation>();
const pendingAskUser = new Map<string, PendingAskUser>();
const teamManagers = new Map<string, TeamManager>();

export function resolveAskUser(askId: string, answer: Record<string, string>) {
  const pending = pendingAskUser.get(askId);
  if (!pending) return false;
  pending.resolve(answer);
  pendingAskUser.delete(askId);
  return true;
}

export function resolveElicitation(
  elicitationId: string,
  result: { action: "accept" | "decline"; content?: Record<string, unknown> },
) {
  const pending = pendingElicitations.get(elicitationId);
  if (!pending) return false;
  pending.resolve(result);
  pendingElicitations.delete(elicitationId);
  return true;
}

function emit(sessionId: string, data: AppEvent) {
  const q = active.get(sessionId);
  if (!q) return;
  const event: StreamEvent = { id: q.events.length, data };
  q.events.push(event);
  for (const listener of q.listeners) {
    listener(event);
  }
}

export function getActiveQuery(sessionId: string): ActiveQuery | undefined {
  return active.get(sessionId);
}

export function getActiveSessionIds(): string[] {
  return Array.from(active.entries())
    .filter(([, q]) => !q.done)
    .map(([id]) => id);
}

export function subscribe(
  sessionId: string,
  afterId: number,
  listener: (event: StreamEvent) => void,
): (() => void) | null {
  const q = active.get(sessionId);
  if (!q) return null;

  for (let i = afterId; i < q.events.length; i++) {
    listener(q.events[i]);
  }

  if (q.done) return null;

  q.listeners.add(listener);
  return () => q.listeners.delete(listener);
}

export async function startQuery(sessionId: string, text: string) {
  const existing = active.get(sessionId);
  // Block only if an orchestrator query is actively running (has an abort controller)
  if (existing && !existing.done && abortControllers.has(sessionId)) return;

  // Reuse the existing ActiveQuery if it's alive for teammates, otherwise create new
  const aq: ActiveQuery = (existing && !existing.done)
    ? existing
    : { events: [], done: false, listeners: new Set() };
  active.set(sessionId, aq);

  const session = await getStoredSession(sessionId);
  if (!session) {
    active.delete(sessionId);
    return;
  }

  runQuery(session, text, sessionId).catch((err) => {
    emit(sessionId, { type: "error", text: String(err?.message ?? err) });
    finalize(sessionId);
  });
}

export function cancelQuery(sessionId: string): boolean {
  // Cancel all teammates first if a team is active
  const tm = teamManagers.get(sessionId);
  if (tm) {
    tm.cancelAll();
  }
  const controller = abortControllers.get(sessionId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function getTeamState(sessionId: string) {
  const tm = teamManagers.get(sessionId);
  if (!tm || tm.getTeammates().length === 0) return null;
  return { teammates: tm.getTeammates(), messages: [] };
}

export function disposeSession(sessionId: string): void {
  cancelQuery(sessionId);
  const tm = teamManagers.get(sessionId);
  if (tm) {
    tm.dispose();
    teamManagers.delete(sessionId);
  }
}

function finalize(sessionId: string) {
  const aq = active.get(sessionId);
  if (aq) {
    aq.done = true;
    aq.listeners.clear();
    setTimeout(() => active.delete(sessionId), 60_000);
  }
  abortControllers.delete(sessionId);
  // pendingAskUser entries are keyed by unique askId now, not sessionId — no blanket delete needed
  // Team manager persists across queries — disposed only on session delete
  // or when the user explicitly tells the orchestrator to end the team
}

function getSessionCwd(session: NonNullable<Awaited<ReturnType<typeof getStoredSession>>>): string {
  const wts = session.worktrees;
  if (wts && Object.keys(wts).length > 0) {
    const entries = Object.values(wts);
    // Single repo: use the repo worktree directly
    if (entries.length === 1) return entries[0];
    // Multi repo: use parent folder
    return session.worktreePath || process.cwd();
  }
  return session.worktreePath || process.cwd();
}

function getSessionAdditionalDirs(session: NonNullable<Awaited<ReturnType<typeof getStoredSession>>>): string[] {
  const wts = session.worktrees;
  if (wts && Object.keys(wts).length > 1) {
    return Object.values(wts);
  }
  return [];
}

async function runQuery(session: NonNullable<Awaited<ReturnType<typeof getStoredSession>>>, text: string, sessionId: string) {
  const state = createStreamState();
  const errorMessages: Array<{ id: string; role: "error"; content: string }> = [];
  const abortController = new AbortController();
  abortControllers.set(sessionId, abortController);

  try {
    const resolvedCwd = getSessionCwd(session);
    console.log(`[summit] Query cwd for session ${sessionId}: ${resolvedCwd} (worktrees: ${JSON.stringify(session.worktrees)}, worktreePath: ${session.worktreePath})`);

    // Shared tool handlers (used by both orchestrator and teammates)
    // extraEmitFields allows teammates to attach their identity to emitted events
    const canUseToolHandler = async (toolName: string, input: any, extraEmitFields?: Record<string, unknown>) => {
      if (toolName === "AskUserQuestion") {
        const askId = crypto.randomUUID();
        emit(sessionId, { type: "ask_user", askId, questions: input.questions, ...extraEmitFields });
        const answers = await new Promise<Record<string, string>>((resolve) => {
          pendingAskUser.set(askId, { resolve });
        });
        return { behavior: "allow" as const, updatedInput: { ...input, answers } };
      }
      return { behavior: "allow" as const };
    };

    const onElicitationHandler = async (request: any, extraEmitFields?: Record<string, unknown>) => {
      const elicitationId = crypto.randomUUID();
      emit(sessionId, {
        type: "elicitation",
        elicitationId,
        serverName: request.serverName,
        message: request.message,
        schema: request.requestedSchema,
        ...extraEmitFields,
      });
      return new Promise<any>((resolve) => {
        pendingElicitations.set(elicitationId, { resolve });
      });
    };

    // Reuse existing team manager if one persists from a prior turn, otherwise create new
    let teamManager = teamManagers.get(sessionId);
    if (teamManager) {
      teamManager.updateHandlers(emit, canUseToolHandler, onElicitationHandler);
    } else {
      teamManager = new TeamManager(sessionId, session, emit, canUseToolHandler, onElicitationHandler);
      teamManagers.set(sessionId, teamManager);
    }
    const orchestratorMcpServer = createOrchestratorMcpServer(teamManager);

    const repoList = Object.entries(session.worktrees).map(([repo, path]) => `- ${repo}: ${path}`).join("\n");

    const orchestratorPromptAppend = `IMPORTANT: Your working directory is current working directory.
Always create and edit files within this directory.
Never write files to the user's home directory or any path outside the working directory unless the user explicitly asks you to.

You have access to the following repos:
${repoList}

IMPORTANT: If you are unsure about what to do, ask the user for clarification instead of making assumptions. Always ask before performing any action that could modify files or have side effects.

IMPORTANT: If you have a multiple choices question, use the AskUserQuestion tool to ask the user.

## Agent Teams

You have orchestrator tools available to create a team of specialized agents when the task benefits from parallel work or collaborative discussion.

**When to create a team:**
- The task involves changes across multiple repos or distinct areas of a monorepo
- Parallel work by specialists would be more efficient than doing it all yourself
- The user wants a group discussion, debate, brainstorm, or collaborative exploration of a topic
- There are clear domain boundaries or distinct perspectives to represent

**When NOT to create a team (just do it yourself):**
- Simple single-file changes
- Tasks contained within one domain
- Quick fixes, refactors, or questions

**How to create a team:**
1. Analyze the request and decide what roles are needed
2. Use create_teammate for each role with a detailed system prompt
3. After creating ALL teammates, use broadcast to send the full team roster and initial instructions
4. Tell the user the team is ready
5. **Stay in a loop** — call check_mailbox repeatedly to receive messages from teammates. Process each message (relay info, respond, coordinate) and then call check_mailbox again. Do NOT finish your turn while teammates are still active.

**Communication tools — important distinction:**
- send_message: send a message to a specific teammate
- check_mailbox: block until a teammate sends YOU a message back — use this after every action that might trigger a teammate reply. Always loop on this.
- wait_for_next_completion: block until a teammate calls notify_done (fully finished). Use this only when you're waiting for teammates to finish all their work.
- check_team_status: non-blocking poll of all teammate statuses
- Teammates can also use AskUserQuestion to talk to the user directly — they don't always need to go through you

**IMPORTANT — staying alive as orchestrator:**
- After creating and broadcasting to a team, you MUST loop on check_mailbox to stay available for teammate messages
- Teammates will send you progress updates, results, and questions — if you finish your turn, they get stuck waiting for replies
- Only finish your turn when all teammates have called notify_done (you'll know from wait_for_next_completion or check_team_status)

**Team lifecycle:**
- The team persists across messages — do NOT recreate teammates each turn
- Both you and the teammates loop on check_mailbox — everyone stays alive until work is complete
- When work is done, present the results to the user and KEEP the team alive — do NOT call dismiss_team
- The user may want to ask follow-up questions, continue the discussion, or give new tasks to the team
- ONLY call dismiss_team when the user explicitly asks to end/dismiss/disband the team

**Teammate scoping (for code tasks):**
- Multi-repo projects: Scope each teammate to their repo path
- Monorepo projects: Scope each teammate to their subdirectory

**Available repos for scoping:**
${repoList}
`;

    // Inject current team state if a team already exists
    const existingTeammates = teamManager.getTeammates();
    const teamStateAppend = existingTeammates.length > 0
      ? `\n\n## Current Team State\nYou already have an active team. Do NOT recreate teammates that already exist.\n${existingTeammates.map((t) => `- ${t.role} (ID: ${t.id}) — status: ${t.status}`).join("\n")}\n\nUse send_message to talk to them, check_mailbox to receive their replies.`
      : "";

    const q = query({
      prompt: text,
      options: {
        abortController,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: orchestratorPromptAppend + teamStateAppend,
        },
        cwd: resolvedCwd,
        ...(getSessionAdditionalDirs(session).length > 0
          ? { additionalDirectories: getSessionAdditionalDirs(session) }
          : {}),
        toolConfig: { askUserQuestion: { previewFormat: "html" } },
        mcpServers: { orchestrator: orchestratorMcpServer },
        allowedTools: ["mcp__orchestrator__*"],
        ...(session.agentSessionId ? { resume: session.agentSessionId } : {}),
        ...(session.model ? { model: session.model } : {}),
        canUseTool: canUseToolHandler,
        onElicitation: onElicitationHandler,
      },
    });

    for await (const message of q) {
      const appEvents = translateMessage(message, state);
      for (const appEvent of appEvents) {
        // Capture session ID from init
        if (appEvent.type === "init" && appEvent.sessionId && !session.agentSessionId) {
          session.agentSessionId = appEvent.sessionId as string;
        }
        if (appEvent.type === "error") {
          errorMessages.push({ id: String(Date.now()), role: "error", content: appEvent.text as string });
        }
        emit(sessionId, appEvent);
      }
    }
  } catch (err: any) {
    const aborted = abortController.signal.aborted || err?.name === "AbortError";
    if (aborted) {
      emit(sessionId, { type: "cancelled" });
    } else {
      const text = err.message || String(err);
      emit(sessionId, { type: "error", text });
      errorMessages.push({ id: String(Date.now()), role: "error", content: text });
    }
  }

  // Persist team state if a team was used
  const tm = teamManagers.get(sessionId);
  if (tm && tm.getTeammates().length > 0) {
    session.teamState = {
      teammates: tm.getTeammates(),
      messages: [],
    };
  }

  // Persist
  session.messages.push({ id: String(Date.now() - 1), role: "user", content: text });
  if (state.assistantText) {
    session.messages.push({
      id: String(Date.now()),
      role: "assistant",
      content: state.assistantText,
      ...(state.assistantMeta ? { meta: state.assistantMeta } : {}),
    });
  }
  session.messages.push(...errorMessages);

  if (session.messages.filter((m) => m.role === "user").length === 1) {
    session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
  }

  await saveSession(session);

  // If teammates are still active, keep the stream open — emit turn_done instead of done
  const activeTm = teamManagers.get(sessionId);
  if (activeTm && activeTm.activeTeammateCount > 0) {
    emit(sessionId, { type: "turn_done" });
    // Clean up orchestrator resources but keep ActiveQuery alive for teammate events
    abortControllers.delete(sessionId);
    // When all teammates eventually finish, emit done and finalize
    activeTm.onAllTeammateDone(() => {
      emit(sessionId, { type: "done" });
      finalize(sessionId);
    });
  } else {
    emit(sessionId, { type: "done" });
    finalize(sessionId);
  }
}
