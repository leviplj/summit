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

export function resolveAskUser(sessionId: string, answer: Record<string, string>) {
  const pending = pendingAskUser.get(sessionId);
  if (!pending) return false;
  pending.resolve(answer);
  pendingAskUser.delete(sessionId);
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
  if (existing && !existing.done) return;

  // Set placeholder synchronously to prevent race conditions
  const aq: ActiveQuery = { events: [], done: false, listeners: new Set() };
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

function finalize(sessionId: string) {
  const aq = active.get(sessionId);
  if (aq) {
    aq.done = true;
    aq.listeners.clear();
    setTimeout(() => active.delete(sessionId), 60_000);
  }
  abortControllers.delete(sessionId);
  pendingAskUser.delete(sessionId);
  const tm = teamManagers.get(sessionId);
  if (tm) {
    tm.dispose();
    teamManagers.delete(sessionId);
  }
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
        emit(sessionId, { type: "ask_user", questions: input.questions, ...extraEmitFields });
        const answers = await new Promise<Record<string, string>>((resolve) => {
          pendingAskUser.set(sessionId, { resolve });
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

    // Initialize team manager and orchestrator MCP server
    const teamManager = new TeamManager(sessionId, session, emit, canUseToolHandler, onElicitationHandler);
    teamManagers.set(sessionId, teamManager);
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

You have orchestrator tools available to create a team of specialized agents when the task benefits from parallel work across different domains (e.g., backend + frontend, or multiple services).

**When to create a team:**
- The task involves changes across multiple repos or distinct areas of a monorepo
- Parallel work by specialists would be more efficient than doing it all yourself
- There are clear domain boundaries (backend API, frontend UI, QA testing, etc.)

**When NOT to create a team (just do it yourself):**
- Simple single-file changes
- Tasks contained within one domain
- Quick fixes, refactors, or questions

**How to create a team:**
1. Analyze the request and decide what roles are needed
2. Use create_teammate for each role with a detailed system prompt that includes:
   - Their specific responsibilities
   - Which directory/repo they should work in
   - What to coordinate with other teammates
3. Use wait_for_next_completion to process each teammate as they finish — call it in a loop so you can react to each result individually
4. Optionally use check_team_status at any time to see the current state of all teammates without blocking
5. Summarize the results to the user

**Teammate scoping:**
- Multi-repo projects: Scope each teammate to their repo path
- Monorepo projects: Scope each teammate to their subdirectory (e.g., packages/backend, packages/frontend)
- For shared code: Instruct one teammate to handle it and message others when done

**Available repos for scoping:**
${repoList}
`;

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
          append: orchestratorPromptAppend,
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
  emit(sessionId, { type: "done" });
  finalize(sessionId);
}
