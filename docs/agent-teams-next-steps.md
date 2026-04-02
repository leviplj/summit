# Agent Teams — Next Steps

## Auto-resume orchestrator on teammate message

**Problem:** When a teammate sends a message to "orchestrator" while the orchestrator's query is finished (idle), the message sits in the message bus with no consumer. The teammate blocks on `check_mailbox` waiting for a reply that never comes.

**Current behavior:** The orchestrator runs as a `query()` call that completes. Once done, it can't receive messages.

**Proposed solution:** Auto-start a new orchestrator turn when a teammate messages it while idle.

When `messageBus.deliver()` targets "orchestrator" and no orchestrator query is running:
1. Queue the message normally (it will be picked up by `check_mailbox` in the new turn)
2. Auto-trigger a new `startQuery()` with `resume: sessionId` so the orchestrator has full context
3. The orchestrator's prompt would include a note like: "A teammate sent you a message. Call check_mailbox to receive it."

**Alternative — V2 SDK Session:**
The Claude Agent SDK V2 (preview) has `unstable_v2_createSession()` which returns a `Session` object with `send()`/`stream()` methods. This keeps the agent alive across multiple turns within the same process — no need for resume/re-query. The orchestrator session would stay open and we could `send()` into it when a teammate message arrives.

**Alternative — V1 streaming input:**
V1 `query()` accepts an `AsyncIterable` as the prompt. We could keep the orchestrator's query alive indefinitely by feeding it an async generator that yields new messages as they arrive from teammates. The query never finishes because the input stream stays open.

## Other considerations

- The `resume` approach is simplest but starts a new billing turn each time
- The V2 session approach is cleanest but uses an unstable API
- The streaming input approach works with V1 but requires rearchitecting how the orchestrator query is managed
- Need to handle the case where the orchestrator auto-resumes but the user also sends a message at the same time
