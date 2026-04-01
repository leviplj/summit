# Summit Architecture Refactor

This document describes the design patterns, module boundaries, and migration plan for two interconnected refactors:

1. **Provider Abstraction** — decouple the query engine from the Claude Agent SDK so alternative providers (Codex, etc.) can be plugged in
2. **Team Management Restructuring** — decompose the monolithic `TeamManager` into focused modules with pluggable communication protocols

Both refactors share the same core principle: **`AppEvent` is the boundary**. Everything above it (UI, SSE streaming, session store) never touches SDK or team internals. Everything below it (providers, protocols) never touches UI types.

---

## Table of Contents

- [Current State](#current-state)
- [Part 1: Provider Abstraction](#part-1-provider-abstraction)
  - [Problem](#problem)
  - [Design Patterns](#design-patterns)
  - [Target Directory Structure](#target-directory-structure)
  - [Core Interfaces](#core-interfaces)
  - [Provider Implementation Contract](#provider-implementation-contract)
  - [Query Manager Changes](#query-manager-changes)
  - [Event Translation](#event-translation)
  - [Frontend Changes](#frontend-changes)
  - [Data Model Changes](#data-model-changes)
  - [Adding a New Provider](#adding-a-new-provider)
- [Part 2: Team Management Restructuring](#part-2-team-management-restructuring)
  - [Problem](#problem-1)
  - [Design Patterns](#design-patterns-1)
  - [Target Directory Structure](#target-directory-structure-1)
  - [Core Interfaces](#core-interfaces-1)
  - [TeamCoordinator (Mediator)](#teamcoordinator-mediator)
  - [Communication Protocols (Strategy)](#communication-protocols-strategy)
  - [TeammateRunner (Adapter)](#teammaterunner-adapter)
  - [Team Event Emitter (Observer)](#team-event-emitter-observer)
  - [Tool Definitions (Command)](#tool-definitions-command)
  - [System Prompts](#system-prompts)
  - [Frontend Event Routing](#frontend-event-routing)
  - [Query Manager Integration](#query-manager-integration)
- [Migration Plan](#migration-plan)
- [Testing Strategy](#testing-strategy)
- [Appendix: Current Coupling Map](#appendix-current-coupling-map)

---

## Current State

### SDK coupling points

The `@anthropic-ai/claude-agent-sdk` is directly imported in two files:

| File | Usage |
|------|-------|
| `server/utils/queries.ts` | `query()` — main agent session and orchestrator |
| `server/utils/teamManager.ts` | `query()` — teammate agent sessions |
| `server/utils/teamTools.ts` | `tool()`, `createSdkMcpServer()` — MCP tool definitions |
| `server/routes/api/.../generate-message.post.ts` | `query()` — one-shot commit message generation |

### Team management coupling points

`TeamManager` (467 lines) is a god class handling: teammate registry, SDK query execution, event forwarding, completion tracking, message delivery + UI events, cancellation, and session CWD resolution (duplicated from `queries.ts`).

`queries.ts` (380 lines) has absorbed team orchestration: system prompt construction (30+ lines of instruction text), team manager lifecycle across turns, and `turn_done` vs `done` semantics.

### What already works well

- `AppEvent` is a clean boundary — the frontend never touches SDK types
- `agentEvents.ts` is a proper event translator (SDK messages → AppEvent)
- `MessageBus` is well-designed with cycle detection and blocking receive
- SSE streaming layer (`stream.get.ts`, `useStream.ts`) is fully provider-agnostic
- Session storage and worktree management are independent of the SDK

---

## Part 1: Provider Abstraction

### Problem

Every `query()` call is a direct import from `@anthropic-ai/claude-agent-sdk`. Adding a second provider (e.g., OpenAI Codex SDK) would require forking `queries.ts` and `teamManager.ts`, duplicating all the lifecycle logic. The SDK's raw event format leaks through `agentEvents.ts` into the rest of the system.

### Design Patterns

| Pattern | Role |
|---------|------|
| **Strategy** | Each provider implements the same `AgentProvider` interface; the query manager selects the right one at runtime based on `session.provider` |
| **Adapter** | Each provider adapts its SDK's raw event stream into `AppEvent` via a provider-specific translator |
| **Registry** | A simple `Map<string, AgentProvider>` with `getProvider(name)` lookup — no DI container needed |
| **Async Iterator** | `QueryResult.stream` yields `AppEvent` via `AsyncIterable` — natural fit for streaming SDKs |

### Target Directory Structure

```
server/
├── providers/
│   ├── types.ts                 # AgentProvider interface, QueryContext, etc.
│   ├── registry.ts              # Provider map + getProvider() + listProviders()
│   │
│   ├── claude-code/
│   │   ├── index.ts             # AgentProvider implementation
│   │   ├── events.ts            # translateMessage() — current agentEvents.ts content
│   │   └── models.ts            # Available model IDs and display labels
│   │
│   └── codex/                   # Future: second provider
│       ├── index.ts
│       ├── events.ts
│       └── models.ts
│
├── utils/
│   ├── queryManager.ts          # Query lifecycle — provider-agnostic
│   ├── eventBus.ts              # emit/subscribe/listen (extracted from queries.ts)
│   └── interactions.ts          # AskUser + Elicitation promise resolution
```

### Core Interfaces

```ts
// server/providers/types.ts

/**
 * Everything the query manager passes to a provider to start an agent session.
 * Plain data — no SDK types leak in or out.
 */
export interface QueryContext {
  prompt: string;
  cwd: string;
  additionalDirs: string[];
  systemPromptSuffix: string;
  model: string | null;
  resumeSessionId: string | null;
  abortSignal: AbortSignal;
  /** MCP servers to inject (e.g., orchestrator tools). Provider-specific format. */
  mcpServers?: Record<string, unknown>;
  /** Tool name patterns to allow (e.g., "mcp__orchestrator__*"). */
  allowedTools?: string[];
}

/**
 * Callbacks the provider invokes when the agent needs user input.
 * The provider doesn't know HOW these get resolved — it just awaits the result.
 */
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

/**
 * What a provider returns from runQuery(). The stream yields AppEvents
 * that the query manager emits directly to SSE listeners.
 */
export interface QueryResult {
  /** Async iterable of AppEvent — the provider owns translation from raw SDK events */
  stream: AsyncIterable<AppEvent>;
  /** Provider-specific session ID for resume support. Called after stream ends. */
  getSessionId: () => string | null;
  /** Accumulated assistant text after stream ends. Used for persistence. */
  getAssistantText: () => string;
  /** Accumulated metadata (cost, tokens) after stream ends. */
  getAssistantMeta: () => { duration_ms?: number; cost_usd?: number; output_tokens?: number } | null;
}

/**
 * The contract every provider implements.
 */
export interface AgentProvider {
  readonly name: string;
  readonly models: ProviderModel[];

  /** Check if this provider supports a given capability */
  supports(capability: ProviderCapability): boolean;

  /** Start a streaming agent query */
  runQuery(ctx: QueryContext, hooks: InteractionHooks): QueryResult;

  /**
   * One-shot completion for non-interactive tasks (commit message generation, etc.).
   * Simpler than runQuery — no streaming, no tools, no interaction hooks.
   */
  complete(prompt: string, model?: string): Promise<string>;

  /**
   * Create MCP tool definitions that reference provider-specific SDK functions.
   * Used by the team system to create orchestrator/teammate tools.
   * Returns an opaque object that gets passed back via QueryContext.mcpServers.
   */
  createMcpServer(config: { name: string; tools: ToolDefinition[] }): unknown;
}

export interface ProviderModel {
  id: string;
  label: string;
  default?: boolean;
}

export type ProviderCapability =
  | "resume"           // Can resume a previous agent session
  | "elicitation"      // Supports MCP elicitation callbacks
  | "ask_user"         // Supports interactive multi-choice questions
  | "tool_streaming"   // Streams individual tool_use/tool_result events
  | "mcp_tools"        // Supports injecting custom MCP tool servers
  | "system_prompt"    // Supports system prompt customization

/**
 * Abstract tool definition passed to createMcpServer.
 * Provider-specific implementations convert this to their SDK's format.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;   // JSON Schema for parameters
  handler: (args: any) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
}
```

### Provider Implementation Contract

Each provider must:

1. **Implement `runQuery()`** — call its SDK, iterate the raw stream, translate each raw event into one or more `AppEvent`s, and yield them. The translation logic lives inside the provider (e.g., `claude-code/events.ts`).

2. **Implement `complete()`** — a simple prompt-in, text-out function for non-interactive tasks.

3. **Implement `createMcpServer()`** — wrap the abstract `ToolDefinition` list into the SDK's native MCP server format. For Claude, this calls `tool()` + `createSdkMcpServer()`. For SDKs without MCP support, this could be a no-op or a polyfill.

4. **Declare capabilities** — `supports()` lets the query manager and UI gate features. A provider without `"elicitation"` support won't get elicitation hooks wired in.

5. **Declare models** — the `models` array drives the model selector UI.

#### Claude Code Provider (sketch)

```ts
// server/providers/claude-code/index.ts

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { createStreamState, translateMessage } from "./events";
import { MODELS } from "./models";
import type { AgentProvider, QueryContext, InteractionHooks, QueryResult } from "../types";

export const claudeCodeProvider: AgentProvider = {
  name: "claude-code",
  models: MODELS,

  supports(cap) {
    return ["resume", "elicitation", "ask_user", "tool_streaming", "mcp_tools", "system_prompt"].includes(cap);
  },

  runQuery(ctx: QueryContext, hooks: InteractionHooks): QueryResult {
    const state = createStreamState();
    let capturedSessionId: string | null = null;

    const sdkQuery = query({
      prompt: ctx.prompt,
      options: {
        abortController: abortControllerFrom(ctx.abortSignal),
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
        ...(ctx.resumeSessionId ? { resume: ctx.resumeSessionId } : {}),
        ...(ctx.model ? { model: ctx.model } : {}),
        ...(ctx.mcpServers ? { mcpServers: ctx.mcpServers } : {}),
        ...(ctx.allowedTools ? { allowedTools: ctx.allowedTools } : {}),
        toolConfig: { askUserQuestion: { previewFormat: "html" } },
        canUseTool: async (toolName, input) => {
          if (toolName === "AskUserQuestion") {
            const answers = await hooks.onAskUser(input.questions);
            return { behavior: "allow", updatedInput: { ...input, answers } };
          }
          return { behavior: "allow" };
        },
        onElicitation: async (request) => {
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
            capturedSessionId = event.sessionId as string;
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

  async complete(prompt, model) {
    let result = "";
    const q = query({
      prompt,
      options: { maxTurns: 1, model: model ?? "haiku", allowedTools: [] },
    });
    for await (const ev of q) {
      if (ev.type === "result" && "result" in ev) {
        result = (ev as any).result;
        break;
      }
    }
    return result;
  },

  createMcpServer(config) {
    const sdkTools = config.tools.map((t) =>
      tool(t.name, t.description, t.schema, t.handler)
    );
    return createSdkMcpServer({ name: config.name, version: "1.0.0", tools: sdkTools });
  },
};
```

### Query Manager Changes

The current `runQuery` function in `queries.ts` (lines 171-380) splits into provider-agnostic orchestration:

```ts
// server/utils/queryManager.ts (sketch of the core loop)

async function runQuery(session: StoredSession, text: string, sessionId: string) {
  const provider = getProvider(session.provider ?? "claude-code");
  const abortController = new AbortController();
  abortControllers.set(sessionId, abortController);

  // Build interaction hooks (AskUser, Elicitation)
  const hooks = buildInteractionHooks(sessionId);

  // Build system prompt suffix
  const systemPrompt = buildSystemPrompt(session, teamCoordinator);

  // Build query context
  const ctx: QueryContext = {
    prompt: text,
    cwd: getSessionCwd(session),
    additionalDirs: getSessionAdditionalDirs(session),
    systemPromptSuffix: systemPrompt,
    model: session.model,
    resumeSessionId: session.agentSessionId,
    abortSignal: abortController.signal,
    // Team tools injected if coordinator exists
    ...(teamMcpServer ? { mcpServers: { orchestrator: teamMcpServer } } : {}),
    ...(teamMcpServer ? { allowedTools: ["mcp__orchestrator__*"] } : {}),
  };

  const result = provider.runQuery(ctx, hooks);
  const errorMessages: Array<{ id: string; role: "error"; content: string }> = [];

  try {
    for await (const appEvent of result.stream) {
      if (appEvent.type === "init" && !session.agentSessionId) {
        session.agentSessionId = result.getSessionId();
      }
      if (appEvent.type === "error") {
        errorMessages.push({ id: String(Date.now()), role: "error", content: appEvent.text as string });
      }
      emit(sessionId, appEvent);
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

  // Persist using provider's accumulated state
  session.messages.push({ id: String(Date.now() - 1), role: "user", content: text });
  const assistantText = result.getAssistantText();
  if (assistantText) {
    session.messages.push({
      id: String(Date.now()),
      role: "assistant",
      content: assistantText,
      ...(result.getAssistantMeta() ? { meta: result.getAssistantMeta()! } : {}),
    });
  }
  session.messages.push(...errorMessages);

  // Title from first message
  if (session.messages.filter((m) => m.role === "user").length === 1) {
    session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
  }

  await saveSession(session);

  // Team-aware finalization
  if (coordinator?.hasActiveTeammates) {
    emit(sessionId, { type: "turn_done" });
    coordinator.onAllDone(() => {
      emit(sessionId, { type: "done" });
      finalize(sessionId);
    });
  } else {
    emit(sessionId, { type: "done" });
    finalize(sessionId);
  }
}
```

Key difference: **no SDK imports, no SDK types, no SDK options construction**. All of that lives inside the provider.

### Event Translation

Each provider owns its own event translator. For Claude Code, this is the current `agentEvents.ts` — it moves to `providers/claude-code/events.ts` unchanged. A Codex provider would have its own `events.ts` that maps Codex's streaming format to `AppEvent`.

The `AgentStreamState` type (tracking `currentToolName`, `currentToolInput`, `assistantText`, `assistantMeta`) is internal to each provider's translator — it never leaks out.

### Frontend Changes

Minimal. The `AppEvent` contract doesn't change. Specific additions:

1. **Provider selector** — a new component alongside the model selector, or the model selector becomes provider-aware (grouped by provider).

2. **Dynamic model list** — fetched from a new `/api/providers` endpoint that returns:
   ```ts
   Array<{
     name: string;
     models: Array<{ id: string; label: string; default?: boolean }>;
     capabilities: string[];
   }>
   ```

3. **Capability gating** — the UI checks provider capabilities to show/hide features:
   - Hide elicitation UI if provider doesn't support `"elicitation"`
   - Hide team features if provider doesn't support `"mcp_tools"`
   - Disable resume if provider doesn't support `"resume"`

### Data Model Changes

```ts
// shared/types.ts — additions

export interface StoredSession {
  // ... existing fields
  provider: string;    // "claude-code" | "codex" | etc. Defaults to "claude-code"
}

export interface SessionListItem {
  // ... existing fields
  provider: string;
}
```

The `provider` field defaults to `"claude-code"` for backwards compatibility. Existing sessions without the field are treated as Claude Code.

### Adding a New Provider

Checklist for adding a provider (e.g., Codex):

1. Create `server/providers/codex/` directory
2. Implement `index.ts` with `AgentProvider` interface
3. Implement `events.ts` to translate raw SDK events → `AppEvent`
4. Implement `models.ts` with available model list
5. Register in `server/providers/registry.ts`
6. (Optional) Implement `createMcpServer` if the SDK supports custom tools

No changes needed to: query manager, SSE streaming, session storage, frontend composables, or UI components (beyond the provider selector).

---

## Part 2: Team Management Restructuring

### Problem

`TeamManager` is a 467-line class with 7+ responsibilities. It directly imports the Claude SDK, duplicates query execution logic from `queries.ts`, owns the communication protocol, and mixes event emission with business logic. `queries.ts` has absorbed 60+ lines of orchestrator system prompt and team lifecycle management.

Specific issues:

1. **SDK coupling duplicated** — `teamManager.ts:175-198` has its own `query()` call with nearly identical options to `queries.ts:288-312`. Changing provider means changing two places.

2. **Communication model hardwired** — `teamTools.ts` defines the mailbox protocol inside MCP tool handlers. Swapping to a pipeline or pub/sub pattern requires rewriting tools.

3. **No separation between topology and protocol** — the system only supports flat peer mesh. Pipeline (A→B→C), hub-spoke (orchestrator mediates all), and hierarchical topologies would require structural changes.

4. **TeamManager takes raw function references** — `EmitFn`, `CanUseToolFn`, `OnElicitationFn` as constructor args with `updateHandlers()` to swap between turns. This indicates the class is entangled with concerns that belong elsewhere.

5. **CWD resolution duplicated** — `getSessionCwd()` and `getSessionAdditionalDirs()` appear in both `queries.ts` and `teamManager.ts`.

### Design Patterns

| Pattern | Where | What it solves |
|---------|-------|---------------|
| **Mediator** | `TeamCoordinator` | Decouples teammates, tools, protocol, and events — nothing talks directly to anything else |
| **Strategy** | `CommunicationProtocol` | Swap mailbox for pipeline/pub-sub without touching tools or lifecycle |
| **Adapter** | `TeammateRunner` | Uses `AgentProvider` interface — SDK-agnostic teammate queries |
| **Observer** | `TeamEventEmitter` | Centralized event emission instead of scattered `emitFn` calls |
| **Command** | MCP tools → coordinator methods | Tools are thin wrappers that delegate to coordinator |
| **Dispatcher** | Frontend event router | Replaces fragile fall-through routing with type-based dispatch |

### Target Directory Structure

```
server/
├── team/
│   ├── types.ts                    # Team-specific types
│   ├── coordinator.ts              # Mediator: owns lifecycle, delegates to protocol
│   ├── teammateRunner.ts           # Runs a single teammate via AgentProvider
│   ├── eventEmitter.ts             # Team event emission
│   ├── prompts.ts                  # System prompt templates
│   ├── protocols/
│   │   ├── types.ts                # CommunicationProtocol interface
│   │   ├── mailbox.ts              # Current MessageBus (blocking receive, cycle detection)
│   │   └── pipeline.ts             # Future: sequential handoff
│   └── tools/
│       ├── types.ts                # Abstract tool definitions
│       ├── orchestrator.ts         # Orchestrator MCP tools
│       └── teammate.ts             # Teammate MCP tools
```

### Core Interfaces

```ts
// server/team/types.ts

export interface TeammateConfig {
  id: string;
  role: string;
  systemPrompt: string;
  scopePath?: string;
  model?: string;
}

/**
 * A handle to a running teammate. Returned by spawnTeammate().
 * The coordinator holds these; tools and UI interact through the coordinator.
 */
export interface TeammateHandle {
  readonly id: string;
  readonly role: string;
  status: TeammateStatus;
  doneSummary?: string;
  abort(): void;
  /** Resolves when the teammate's query finishes (done/error/cancelled) */
  readonly done: Promise<TeammateResult>;
}

export interface TeammateResult {
  id: string;
  role: string;
  status: TeammateStatus;
  summary?: string;
}
```

```ts
// server/team/protocols/types.ts

/**
 * A communication protocol defines HOW teammates exchange messages.
 * The coordinator and tools don't know the mechanism — they call
 * send/receive and the protocol handles the rest.
 *
 * Implementations:
 * - MailboxProtocol: current behavior (blocking receive, cycle detection)
 * - PipelineProtocol: enforced sequential handoff (A can only send to B)
 * - PubSubProtocol: topic-based channels
 */
export interface CommunicationProtocol {
  /**
   * Send a message from one participant to another.
   * May throw if the protocol doesn't allow this communication path
   * (e.g., pipeline protocol rejects out-of-order sends).
   */
  send(from: string, to: string, content: string): void;

  /**
   * Block until a message arrives for this participant.
   * May throw on cycle detection or timeout.
   *
   * @param participantId - who is receiving
   * @param from - optional filter: only receive from this sender
   * @param timeoutMs - how long to wait before throwing
   */
  receive(participantId: string, from?: string, timeoutMs?: number): Promise<TeamMessage>;

  /** Send to all participants except sender */
  broadcast(from: string, content: string, allIds: string[]): void;

  /** Clean up when a participant is removed (cancel waiters, flush mailbox) */
  removeParticipant(id: string): void;

  /** Full cleanup */
  dispose(): void;

  /** Reset for reuse after dispose */
  reset(): void;
}
```

```ts
// server/team/eventEmitter.ts

/**
 * Centralized team event emission. All team-related AppEvents go through here,
 * ensuring consistent teammateId/teammateName tagging and preventing scattered
 * emit calls across the codebase.
 */
export interface TeamEventEmitter {
  /** Emit a team lifecycle event (team_created, teammate_status, teammate_done) */
  emitLifecycle(type: string, data: Record<string, unknown>): void;

  /** Emit an inter-agent message event to both sender and recipient UI streams */
  emitMessage(from: string, to: string, content: string): void;

  /** Emit a provider AppEvent tagged with teammate identity */
  emitTeammateEvent(teammateId: string, teammateName: string, event: AppEvent): void;
}
```

### TeamCoordinator (Mediator)

The coordinator is the central hub. Nothing in the team system talks directly to anything else — teammates don't know about the protocol implementation, tools don't know about teammate handles, and the event emitter doesn't know about lifecycle state.

```ts
// server/team/coordinator.ts

/**
 * Mediates all team interactions.
 *
 * Owns:
 * - Teammate registry (Map<id, TeammateHandle>)
 * - Lifecycle transitions (spawn, cancel, done, dispose)
 * - Completion tracking (individual and team-wide)
 *
 * Delegates to:
 * - CommunicationProtocol for message routing
 * - TeammateRunner for starting agent queries
 * - TeamEventEmitter for all UI notifications
 *
 * Does NOT own:
 * - SDK calls (that's the runner via AgentProvider)
 * - Event translation (that's the provider)
 * - System prompt construction (that's prompts.ts)
 * - Tool definitions (that's tools/*.ts)
 */
export class TeamCoordinator {
  private teammates = new Map<string, TeammateHandle>();
  private teamWaiters: Array<{ resolve: (results: TeammateResult[]) => void }> = [];
  private completionQueue: TeammateResult[] = [];
  private completionWaiters: Array<{ resolve: (result: TeammateResult) => void }> = [];

  constructor(private config: {
    sessionId: string;
    protocol: CommunicationProtocol;
    runner: TeammateRunner;
    emitter: TeamEventEmitter;
  }) {}

  // --- Lifecycle ---

  async spawnTeammate(teammateConfig: TeammateConfig): Promise<TeammateHandle>;
  cancelTeammate(id: string): boolean;
  cancelAll(): void;
  dispose(): void;

  // --- Communication (delegates to protocol) ---

  send(from: string, to: string, content: string): void;
  receive(participantId: string, from?: string, timeoutMs?: number): Promise<TeamMessage>;
  broadcast(from: string, content: string): void;

  // --- Completion tracking ---

  async waitForTeam(): Promise<TeammateResult[]>;
  async waitForNextCompletion(): Promise<TeammateResult>;
  getTeamStatus(): Array<{ id: string; role: string; status: TeammateStatus; summary?: string }>;

  // --- Queries ---

  get hasActiveTeammates(): boolean;
  get allTeammateIds(): string[];
  getTeammates(): Teammate[];
  onAllDone(fn: () => void): void;
}
```

Why a mediator:
- Tools call `coordinator.send()`, not `protocol.send()` — the coordinator can add event emission, validation, or logging around the protocol call without tools changing.
- The runner calls `coordinator.markDone()` when a query finishes — the coordinator handles completion tracking, not the runner.
- The emitter is called by the coordinator at the right lifecycle points — it doesn't need to observe the protocol or runner directly.

### Communication Protocols (Strategy)

#### MailboxProtocol

The current `MessageBus` becomes `MailboxProtocol`, implementing `CommunicationProtocol`. The logic is unchanged — mailboxes, blocking receive, FIFO ordering, cycle detection via DFS on the wait graph.

```ts
// server/team/protocols/mailbox.ts

export class MailboxProtocol implements CommunicationProtocol {
  private mailboxes = new Map<string, TeamMessage[]>();
  private waiters = new Map<string, Waiter>();
  private waitsFor = new Map<string, Set<string>>();

  send(from: string, to: string, content: string): void { /* current deliver() logic */ }
  async receive(participantId: string, from?: string, timeoutMs?: number): Promise<TeamMessage> { /* current receive() logic */ }
  broadcast(from: string, content: string, allIds: string[]): void { /* current broadcast() logic */ }
  removeParticipant(id: string): void { /* current rejectWaitersFor() logic */ }
  dispose(): void { /* current dispose() logic */ }
  reset(): void { /* current reset() logic */ }

  // Internal: cycle detection (unchanged)
  private wouldCreateCycle(waiter: string, target: string): string[] | null { /* unchanged */ }
}
```

#### PipelineProtocol (future)

A protocol that enforces sequential handoff. Each participant has a defined position in the pipeline. `send()` only works to the next stage. `receive()` only accepts from the previous stage.

```ts
// server/team/protocols/pipeline.ts (future)

export class PipelineProtocol implements CommunicationProtocol {
  constructor(private stages: string[]) {}  // ordered list of participant IDs

  send(from: string, to: string, content: string): void {
    const fromIdx = this.stages.indexOf(from);
    const toIdx = this.stages.indexOf(to);
    if (toIdx !== fromIdx + 1) {
      throw new Error(`Pipeline protocol: ${from} can only send to ${this.stages[fromIdx + 1]}, not ${to}`);
    }
    // ... deliver logic
  }
  // ...
}
```

No tool changes needed — tools call `coordinator.send()` which delegates to whatever protocol is configured.

### TeammateRunner (Adapter)

The runner adapts the `AgentProvider` interface for teammate queries. It handles:
- Building the teammate's system prompt (via `prompts.ts`)
- Creating the teammate's MCP tool server (via the provider's `createMcpServer`)
- Starting the query and forwarding events through the emitter
- Returning a `TeammateHandle` for lifecycle control

```ts
// server/team/teammateRunner.ts

export class TeammateRunner {
  constructor(
    private provider: AgentProvider,
    private session: StoredSession,
  ) {}

  /**
   * Start a teammate's agent query. Returns a handle for lifecycle control.
   * The coordinator calls this; the runner doesn't know about the team roster.
   */
  start(
    config: TeammateConfig,
    toolServer: unknown,                    // MCP server created by provider
    emitter: TeamEventEmitter,
    hooks: InteractionHooks,
  ): TeammateHandle {
    const abortController = new AbortController();
    const cwd = config.scopePath
      ? (this.session.worktrees[config.scopePath] ?? config.scopePath)
      : getSessionCwd(this.session);

    const result = this.provider.runQuery({
      prompt: config.systemPrompt,          // Full prompt built by prompts.ts
      cwd,
      additionalDirs: getSessionAdditionalDirs(this.session),
      systemPromptSuffix: "",               // Already included in prompt
      model: config.model ?? this.session.model,
      resumeSessionId: null,                // Teammates don't resume
      abortSignal: abortController.signal,
      mcpServers: { team: toolServer },
      allowedTools: ["mcp__team__*"],
    }, hooks);

    // Forward events with teammate identity tagging
    const done = this.consumeStream(config, result, emitter, abortController);

    return {
      id: config.id,
      role: config.role,
      status: "working",
      abort: () => abortController.abort(),
      done,
    };
  }

  private async consumeStream(
    config: TeammateConfig,
    result: QueryResult,
    emitter: TeamEventEmitter,
    abortController: AbortController,
  ): Promise<TeammateResult> {
    try {
      for await (const event of result.stream) {
        if (abortController.signal.aborted) break;
        emitter.emitTeammateEvent(config.id, config.role, event);
      }
      return { id: config.id, role: config.role, status: "done" };
    } catch (err: any) {
      const aborted = abortController.signal.aborted || err?.name === "AbortError";
      return {
        id: config.id,
        role: config.role,
        status: aborted ? "cancelled" : "error",
      };
    }
  }
}
```

Note: `TeammateRunner` uses `AgentProvider.runQuery()`, NOT the SDK directly. Same provider abstraction, same event translation. Swapping the provider for teammate queries is automatic.

### Team Event Emitter (Observer)

```ts
// server/team/eventEmitter.ts

type EmitFn = (sessionId: string, data: AppEvent) => void;

export class TeamEventEmitter implements TeamEventEmitter {
  constructor(
    private sessionId: string,
    private emit: EmitFn,
    private getTeammateRole: (id: string) => string | undefined,
  ) {}

  emitLifecycle(type: string, data: Record<string, unknown>): void {
    this.emit(this.sessionId, { type, ...data } as AppEvent);
  }

  emitMessage(from: string, to: string, content: string): void {
    // Emit to sender's stream
    this.emit(this.sessionId, {
      type: "teammate_message",
      teammateId: from,
      teammateName: this.getTeammateRole(from) ?? from,
      direction: "sent",
      to,
      toName: this.getTeammateRole(to) ?? to,
      content,
    });
    // Emit to recipient's stream
    this.emit(this.sessionId, {
      type: "teammate_message",
      teammateId: to,
      teammateName: this.getTeammateRole(to) ?? to,
      direction: "received",
      from,
      fromName: this.getTeammateRole(from) ?? from,
      content,
    });
  }

  emitTeammateEvent(teammateId: string, teammateName: string, event: AppEvent): void {
    this.emit(this.sessionId, {
      ...event,
      teammateId,
      teammateName,
    });
  }
}
```

This replaces all the scattered `this.emitFn(this.sessionId, { ... })` calls in the current `TeamManager`. The emitter knows the teammate roster (via the `getTeammateRole` callback) so it can resolve IDs to display names without the caller needing to do it.

### Tool Definitions (Command)

Tools become thin wrappers that delegate to the coordinator. They don't import the SDK directly — they return abstract `ToolDefinition` objects that the provider's `createMcpServer` converts to SDK-native format.

```ts
// server/team/tools/teammate.ts

import type { ToolDefinition } from "./types";
import type { TeamCoordinator } from "../coordinator";

export function createTeammateToolDefs(teammateId: string, coordinator: TeamCoordinator): ToolDefinition[] {
  return [
    {
      name: "check_mailbox",
      description: "Wait for and receive a message from another teammate...",
      schema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Only receive from this teammate ID" },
        },
      },
      handler: async (args) => {
        try {
          const msg = await coordinator.receive(teammateId, args.from);
          return {
            content: [{ type: "text", text: `Message from ${msg.from}: ${msg.content}` }],
          };
        } catch (err: any) {
          return {
            content: [{ type: "text", text: err.message }],
            isError: true,
          };
        }
      },
    },
    {
      name: "send_message",
      description: "Send a message to another teammate...",
      schema: {
        type: "object",
        properties: {
          to: { type: "string", description: "The teammate ID to send to" },
          content: { type: "string", description: "The message content" },
        },
        required: ["to", "content"],
      },
      handler: async (args) => {
        coordinator.send(teammateId, args.to, args.content);
        return {
          content: [{ type: "text", text: `Message sent to ${args.to}` }],
        };
      },
    },
    {
      name: "notify_done",
      description: "Signal that you have completed your assigned work...",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Summary of what was accomplished" },
        },
        required: ["summary"],
      },
      handler: async (args) => {
        coordinator.markDone(teammateId, args.summary);
        return {
          content: [{ type: "text", text: "Completion signaled to orchestrator." }],
        };
      },
    },
  ];
}
```

Same pattern for orchestrator tools (`create_teammate`, `broadcast`, `send_message`, `check_mailbox`, `check_team_status`, `wait_for_next_completion`, `cancel_teammate`, `dismiss_team`).

The `ToolDefinition` type is SDK-agnostic. The provider's `createMcpServer()` converts it:

```ts
// In claude-code provider:
createMcpServer(config) {
  const sdkTools = config.tools.map((t) =>
    tool(t.name, t.description, zodSchemaFrom(t.schema), t.handler)
  );
  return createSdkMcpServer({ name: config.name, version: "1.0.0", tools: sdkTools });
}
```

### System Prompts

All system prompt construction moves to `team/prompts.ts`:

```ts
// server/team/prompts.ts

/**
 * Build the orchestrator system prompt suffix.
 * Includes: base instructions, team management guide, repo listing, and existing team state.
 */
export function buildOrchestratorPrompt(config: {
  worktrees: Record<string, string>;
  existingTeammates?: Teammate[];
}): string {
  const repoList = Object.entries(config.worktrees)
    .map(([repo, path]) => `- ${repo}: ${path}`)
    .join("\n");

  let prompt = `IMPORTANT: Your working directory is current working directory.
Always create and edit files within this directory.
...

## Agent Teams
...

**Available repos for scoping:**
${repoList}
`;

  if (config.existingTeammates?.length) {
    prompt += `\n\n## Current Team State\n...`;
  }

  return prompt;
}

/**
 * Build a teammate's full system prompt including role, scope, team roster,
 * and communication tool instructions.
 */
export function buildTeammatePrompt(config: {
  role: string;
  id: string;
  systemPrompt: string;
  scopePath?: string;
  otherTeammates: Array<{ id: string; role: string; scopePath?: string }>;
}): string {
  // ... current logic from teamManager.ts:138-154
}
```

### Frontend Event Routing

Replace the current fall-through pattern in `useChat.ts`:

```ts
// Current (fragile):
if (team.handleTeamEvent(event)) return;
if (team.routeTeammateEvent(event)) return;
// ... handle as session event
```

With an explicit dispatcher:

```ts
// composables/useEventDispatcher.ts

type EventHandler = (event: AppEvent, session: ClientSession) => void;

export function useEventDispatcher() {
  const handlers = new Map<string, EventHandler[]>();

  function on(types: string | string[], handler: EventHandler) {
    const typeList = Array.isArray(types) ? types : [types];
    for (const type of typeList) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
    }
  }

  function dispatch(event: AppEvent, session: ClientSession) {
    // Teammate-scoped events: route by teammateId first
    if (event.teammateId) {
      const teammateHandlers = handlers.get(`teammate:${event.type}`);
      if (teammateHandlers) {
        for (const h of teammateHandlers) h(event, session);
        return;
      }
    }

    // Type-specific handlers
    const typeHandlers = handlers.get(event.type);
    if (typeHandlers) {
      for (const h of typeHandlers) h(event, session);
      return;
    }

    // Fallback
    const fallback = handlers.get("*");
    if (fallback) {
      for (const h of fallback) h(event, session);
    }
  }

  return { on, dispatch };
}
```

Usage in `useChat.ts`:

```ts
const dispatcher = useEventDispatcher();

// Register team lifecycle handlers
dispatcher.on(
  ["team_created", "teammate_status", "teammate_message", "teammate_done"],
  (event, session) => team.handleTeamEvent(event)
);

// Register teammate-scoped event handlers (thinking, tool_use, text, etc.)
dispatcher.on(
  ["teammate:thinking", "teammate:tool_use", "teammate:tool_result",
   "teammate:text", "teammate:result", "teammate:error", "teammate:ask_user"],
  (event, session) => team.routeTeammateEvent(event)
);

// Register session-level handlers
dispatcher.on("init", (event) => { if (event.model) model.value = event.model; });
dispatcher.on("thinking", (event, session) => { session.status = "thinking"; ... });
dispatcher.on("text", (event, session) => { ... });
// etc.
```

Benefits:
- Adding a new event type = adding one `dispatcher.on()` call
- Events that should go to multiple handlers (e.g., both team and session) work naturally
- Event routing is explicit and inspectable

### Query Manager Integration

After both refactors, the query manager's team-related code reduces to:

```ts
// In runQuery():

// Create or reuse team coordinator
let coordinator = teamCoordinators.get(sessionId);
if (!coordinator) {
  const provider = getProvider(session.provider ?? "claude-code");
  coordinator = new TeamCoordinator({
    sessionId,
    protocol: new MailboxProtocol(),
    runner: new TeammateRunner(provider, session),
    emitter: new TeamEventEmitter(sessionId, emit, (id) => coordinator!.getTeammateRole(id)),
  });
  teamCoordinators.set(sessionId, coordinator);
}

// Create orchestrator tools via provider
const orchestratorToolDefs = createOrchestratorToolDefs(coordinator);
const orchestratorMcpServer = provider.createMcpServer({
  name: "orchestrator",
  tools: orchestratorToolDefs,
});

// System prompt built by prompts.ts
const systemPrompt = buildOrchestratorPrompt({
  worktrees: session.worktrees,
  existingTeammates: coordinator.getTeammates(),
});

// The rest is standard provider.runQuery() — no team logic in the loop
```

---

## Migration Plan

The refactor should be done incrementally. Each phase produces a working system.

### Phase 1: Extract utilities from queries.ts

**Goal:** Reduce `queries.ts` complexity without changing behavior.

1. Extract `emit()`, `subscribe()`, `getActiveQuery()`, `finalize()` → `server/utils/eventBus.ts`
2. Extract `resolveAskUser()`, `resolveElicitation()`, pending maps → `server/utils/interactions.ts`
3. Extract `getSessionCwd()`, `getSessionAdditionalDirs()` → `server/utils/sessionHelpers.ts`
4. Extract system prompt strings → `server/team/prompts.ts`

`queries.ts` imports from these modules instead. No behavior change.

### Phase 2: Provider abstraction

**Goal:** SDK is imported in one place per provider.

1. Create `server/providers/types.ts` with interfaces
2. Create `server/providers/claude-code/` with:
   - `events.ts` — move `agentEvents.ts` content here
   - `models.ts` — move model list here
   - `index.ts` — implement `AgentProvider`
3. Create `server/providers/registry.ts`
4. Update `queries.ts` → `queryManager.ts` to use `getProvider()` instead of direct `query()` import
5. Update `generate-message.post.ts` to use `provider.complete()`

### Phase 3: Team module extraction

**Goal:** Team logic lives in `server/team/`, not scattered across `queries.ts` and `teamManager.ts`.

1. Create `server/team/protocols/types.ts` with `CommunicationProtocol` interface
2. Rename `messageBus.ts` → `server/team/protocols/mailbox.ts`, implement interface
3. Create `server/team/eventEmitter.ts`
4. Create `server/team/types.ts`
5. Refactor `TeamManager` → `TeamCoordinator`:
   - Remove SDK `query()` calls (delegate to `TeammateRunner`)
   - Remove `emitFn` / `canUseToolFn` / `onElicitationFn` constructor args
   - Remove `getSessionCwd` / `getSessionAdditionalDirs` duplication
   - Inject protocol + runner + emitter via constructor

### Phase 4: Tool abstraction

**Goal:** Tools are SDK-agnostic.

1. Create `server/team/tools/types.ts` with `ToolDefinition`
2. Rewrite `teamTools.ts` → `server/team/tools/orchestrator.ts` + `teammate.ts` using `ToolDefinition`
3. Add `createMcpServer()` to `AgentProvider` interface
4. Implement in Claude Code provider using `tool()` + `createSdkMcpServer()`

### Phase 5: Frontend event dispatcher

**Goal:** Event routing is explicit and extensible.

1. Create `composables/useEventDispatcher.ts`
2. Refactor `useChat.ts` to use dispatcher instead of switch + fall-through
3. Register team handlers via `dispatcher.on()`

---

## Testing Strategy

### Unit tests (no SDK, no server)

| Module | What to test |
|--------|-------------|
| `MailboxProtocol` | send/receive, blocking, FIFO, filtered receive, cycle detection, timeout, dispose |
| `TeamCoordinator` | spawn/cancel/dispose lifecycle, completion tracking, waitForTeam, waitForNext |
| `TeamEventEmitter` | Correct AppEvent shape for lifecycle, message, teammate events |
| `buildOrchestratorPrompt` | Prompt includes repo list, existing team state, correct instructions |
| `buildTeammatePrompt` | Prompt includes role, scope, teammate roster, tool instructions |
| Event dispatcher | Type-based routing, teammate scoping, fallback, multi-handler |

### Integration tests (mock provider)

| Scenario | What to test |
|----------|-------------|
| Orchestrator creates 2 teammates | Coordinator spawns both via runner, events emitted correctly |
| Teammate A sends message to B | Protocol delivers, emitter emits to both streams |
| Cycle detection | A waits for B, B waits for A → error on second wait |
| Cancel all | All abort controllers fired, protocol cleaned up, events emitted |
| Turn persistence | Team state survives across orchestrator turns |
| Provider swap | Same test with mock provider A vs mock provider B — same events emitted |

### Existing tests to preserve

`server/utils/__tests__/messageBus.test.ts` — these tests should continue to pass when `MessageBus` becomes `MailboxProtocol`. The test file moves to `server/team/protocols/__tests__/mailbox.test.ts`.

---

## Appendix: Current Coupling Map

Visual representation of what imports what today, and what the target state looks like.

### Current

```
queries.ts ──────────────> @anthropic-ai/claude-agent-sdk (query)
    │
    ├── teamManager.ts ──> @anthropic-ai/claude-agent-sdk (query)
    │       │
    │       ├── messageBus.ts
    │       └── teamTools.ts ──> @anthropic-ai/claude-agent-sdk (tool, createSdkMcpServer)
    │
    ├── agentEvents.ts
    ├── sessions.ts
    └── worktrees.ts

useChat.ts
    ├── useSessionStore.ts
    ├── useTeamStore.ts
    └── useStream.ts
```

SDK imported in 3 files. Team logic in queries.ts + teamManager.ts + teamTools.ts.

### Target

```
queryManager.ts ──────────> providers/registry.ts
    │                            │
    │                        providers/claude-code/index.ts ──> @anthropic-ai/claude-agent-sdk
    │                        providers/codex/index.ts ──────> @openai/codex-sdk (future)
    │
    ├── team/coordinator.ts
    │       ├── team/protocols/mailbox.ts
    │       ├── team/teammateRunner.ts ──> providers/types.ts (AgentProvider)
    │       ├── team/eventEmitter.ts
    │       └── team/tools/orchestrator.ts + teammate.ts
    │
    ├── utils/eventBus.ts
    ├── utils/interactions.ts
    ├── utils/sessions.ts
    └── utils/worktrees.ts

useChat.ts
    ├── useSessionStore.ts
    ├── useTeamStore.ts
    ├── useEventDispatcher.ts
    └── useStream.ts
```

SDK imported in 1 file per provider. Team logic fully contained in `server/team/`. Query manager is provider-agnostic.
