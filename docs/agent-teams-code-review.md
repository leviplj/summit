# Code Review: Agent Teams Extension

## What was changed

This is a multi-agent "teams" feature that lets a project configure multiple AI agent teammates that run concurrently. It adds:

1. **Types** (`summit-types`) — `TeamConfig`, `BeforeQueryContext`, new team event types on `AppEvent`
2. **Server extension** (`frontend/server/extensions/teams/`) — `MessageBus` for inter-agent communication, `TeamManager` for lifecycle, MCP tool definitions, and an extension entry point that hooks into `onBeforeQuery`
3. **Query infrastructure** (`queryManager.ts`, `eventBus.ts`) — extended to support injecting MCP servers and system prompt suffixes via `BeforeQueryContext` mutation
4. **Frontend UI** (`useTeamStore`, `TeamTabBar.vue`, integration in `useChat.ts` and `index.vue`) — tab bar for viewing per-teammate streams

---

## Issues Found

### Critical / Bugs

#### 1. `createTeammateTools` is never called

`tools.ts:46` exports `createTeammateTools()` but nothing in the codebase calls it. When `TeamManager.spawnTeammate()` calls `api.queries.run()`, it passes no `tools` option. Teammates are spawned without `send_message`/`receive_message` tools, making the entire `MessageBus` unreachable at runtime. The `MessageBus`, cycle detection, and receive timeout — roughly 40% of the new code — are dead code.

#### 2. Broken template nesting in `index.vue`

Lines 493-546: the inner `<div class="mx-auto ...">` lost its closing `</div>`. After the refactor, the nesting is:

```html
<div ref="messagesEl">    <!-- line 492 -->
  <div class="mx-auto">  <!-- line 493 — never closed before line 546 -->
  ...
</div>                    <!-- line 546 — closes messagesEl -->
</div>                    <!-- line 547 — orphan -->
```

The indentation is inconsistent (2-space vs 4-space mix inside the same block), which masks the bug. This will produce broken layout or a Vue template compilation error.

#### 3. Accessing `.value` on refs inside Vue template

`index.vue:486-489` accesses `teamStore.teammates.value`, `teamStore.activeTeammateId.value` etc. In Vue `<template>` blocks, refs are auto-unwrapped — `.value` should not be used. This will either fail at runtime (accessing `.value` on an already-unwrapped primitive) or behave unexpectedly depending on how `useTeamStore` returns the refs.

Similarly in `<script setup>` at lines 102/105: `teamStore.activeTeammate.value` — if `teamStore` is a reactive object returned from a composable, Vue's reactivity auto-unwrapping rules apply inconsistently for nested refs. This needs to be verified against how `useTeamStore` is actually used (it returns raw `ref()`s, not a `reactive()` wrapper, so destructuring matters).

---

### Design Issues

#### 4. `useTeamStore` is not a singleton

`useTeamStore()` creates new `ref()` instances on every call. In `useChat.ts` it's called once, and the returned object is passed through `useChat()`'s return value. But if any other component calls `useTeamStore()` independently, it gets separate state. A composable named `useXxxStore` conventionally implies shared state. The fix is either module-level `ref()` declarations (like a proper Pinia-less store) or using Pinia.

#### 5. Teammate ID collision by design

`teamManager.ts:24`: IDs are derived from `role.toLowerCase().replace(/\s+/g, "-")`. If two teammates have the same role, the second `spawnTeammate()` call will silently overwrite the first in the `Map`. The method should either reject duplicates or append a counter.

#### 6. `team_created` emitted on every spawn, not just the first

`teamManager.ts:33-45`: Despite the comment "Emit team_created on first spawn", the `else` branch also emits `team_created` with an updated roster. The frontend's `handleTeamEvent` will re-run `ensureTeammate` for all existing teammates on every subsequent spawn. This is wasteful and the semantic naming is misleading. It should be `team_updated` or the roster update should use `teammate_status`.

#### 7. `BeforeQueryContext` mutation pattern is fragile

The hook system works by mutating a context object in-place (`ctx.mcpServers = ...`, `ctx.systemPromptSuffix = ...`). Multiple extensions hooking `onBeforeQuery` could overwrite each other's `mcpServers`. The teams extension does `ctx.mcpServers = { ...ctx.mcpServers, ... }` (correct), but this contract isn't enforced — any other extension could do `ctx.mcpServers = { myStuff }` and wipe out the teams' tools.

#### 8. `hookCtx` is optional in `runQuery` but always passed

`queryManager.ts:34`: `hookCtx?: BeforeQueryContext` is optional, but `startQuery` always passes it. Making it optional adds unnecessary null checks. It should be required, or `startQuery` should handle the case where it's not needed.

---

### Minor Issues

#### 9. Excessive type assertions

Throughout `useChat.ts` and `useTeamStore.ts`, there are many `as string`, `as boolean`, `as number` casts on `AppEvent` fields. The `AppEvent` type uses `[key: string]: unknown` as a catch-all, so every field access requires a cast. This is a design smell in the base type — discriminated union types per event would eliminate all the casts and catch errors at compile time.

#### 10. `v-if="!showProjectDetails"` guard removed from input area

`index.vue:549`: The `v-if="!showProjectDetails"` was removed from the input section. This means the input box now shows even when viewing project details, which appears to be an unintentional behavioral change.

#### 11. Message ID generation in `useTeamStore.ts:72`

`String(Date.now()) + id` is not a reliable unique ID. Two messages arriving in the same millisecond for the same agent will collide. The rest of the codebase uses `uid()` — this should too.

#### 12. `handleTeammateEvent` shadows outer variable name

`useChat.ts:201`: `const m = tab.messages.find((m) => ...)` — the arrow parameter `m` shadows the outer `const m`. This works but is confusing.

#### 13. No cleanup of `teammateStreamState`

`useChat.ts:155`: The `teammateStreamState` Map is never cleaned up when sessions change. If the user switches sessions, stale state from old teammates remains in memory.

#### 14. The `createSdkMcpServer` import in `queryManager.ts` is a top-level dependency

`queryManager.ts:6`: This imports from `@anthropic-ai/claude-agent-sdk` unconditionally, adding the SDK as a hard runtime dependency for all queries, not just team queries. The extension pattern was supposed to keep this decoupled — the import should be in the extension, not in core infrastructure. (It's also imported in `teams/index.ts` where it belongs.)

---

## Summary

The architecture is reasonable — extension hooks, message bus with cycle detection, and per-agent event routing are all solid patterns. But the implementation has a critical gap: **teammates can't actually communicate** because `createTeammateTools` is never wired in. The Vue template has a nesting bug and incorrect `.value` usage in templates. The ID generation scheme will break with duplicate roles. The `createSdkMcpServer` import leaked into core infrastructure, coupling the query manager to the agent SDK even when teams aren't used.
