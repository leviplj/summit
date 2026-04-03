## 1. Event Timestamps

- [ ] 1.1 Add `timestamp: number` to `StreamEvent` in `packages/summit-types/src/index.ts`
- [ ] 1.2 Update `emit()` in `eventBus.ts` to set `timestamp: Date.now()` when creating StreamEvent
- [ ] 1.3 Update `StreamEvent` in `eventBus.ts` local interface to include `timestamp`

## 2. onBeforeQuery Hook

- [ ] 2.1 Add `events.onBeforeQuery` to the `ExtensionAPI` interface in `packages/summit-types/src/index.ts`
- [ ] 2.2 Add `onBeforeQuery` listener set and registration function to `eventBus.ts`
- [ ] 2.3 Fire onBeforeQuery hooks in `queryManager.ts` after `initQuery()` succeeds, before provider `runQuery()` — wrap in try/catch so hook errors don't block the query
- [ ] 2.4 Wire `onBeforeQuery` into `createExtensionAPI.ts`

## 3. Stream Hold

- [ ] 3.1 Add `events.holdStream` to the `ExtensionAPI` interface in `packages/summit-types/src/index.ts`
- [ ] 3.2 Add `holds: number` field to internal `ActiveQuery` in `eventBus.ts` (initialize to 0)
- [ ] 3.3 Implement `holdStream(sessionId)` in `eventBus.ts` — increment holds, return release function with safety timeout (5 min auto-release with warning log)
- [ ] 3.4 Modify `finalize()` in `eventBus.ts` — if `holds > 0`, mark done but skip `stream.end()` and cleanup scheduling
- [ ] 3.5 In the release function, when holds reaches 0 and query is done, call `stream.end()` and schedule cleanup
- [ ] 3.6 Wire `holdStream` into `createExtensionAPI.ts`

## 4. Sub-Query Execution

- [ ] 4.1 Add `queries.run` to the `ExtensionAPI` interface in `packages/summit-types/src/index.ts` with signature `run(sessionId: string, prompt: string, opts: { agentId: string; source?: string }): Promise<void>`
- [ ] 4.2 Add `agentId?: string` to `ChatMessage` interface in `packages/summit-types/src/index.ts`
- [ ] 4.3 Implement `runSubQuery()` in `queryManager.ts` — bypasses `initQuery()`, uses existing ActiveQuery stream, tags events with `agentId`, auto-holds/releases stream, collects messages locally and appends atomically on completion
- [ ] 4.4 Wire `queries.run` into `createExtensionAPI.ts`

## 5. askId Routing

- [ ] 5.1 Update `interactions.createPendingAskUser` and `interactions.resolveAskUser` signatures in `packages/summit-types/src/index.ts` to accept optional `askId` parameter
- [ ] 5.2 Modify `createPendingAskUser()` in `interactions.ts` — use composite key `sessionId:askId` when askId provided
- [ ] 5.3 Modify `resolveAskUser()` in `interactions.ts` — look up by composite key when askId provided
- [ ] 5.4 In `runSubQuery()`, wire interaction hooks to use `agentId` as `askId` and include `askId` in emitted ask_user events
- [ ] 5.5 Wire updated interaction methods into `createExtensionAPI.ts`

## 6. Verification

- [ ] 6.1 TypeScript compiles with no errors related to new types
- [ ] 6.2 Existing queries (single-agent, no agentId) work unchanged — no regressions
