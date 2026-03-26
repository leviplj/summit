## Why

Summit currently uses whatever model the SDK defaults to. Users need the ability to choose which Claude model to use per session — for example, using Haiku for quick tasks and Opus for complex ones, or testing against specific model versions.

## What Changes

- Add a **model selector dropdown** in the header or session settings
- Model selection is stored per session and passed to the SDK's `query()` options
- Show the active model name in the UI (already partially shown via the `model` field from the SDK)
- Provide a sensible default model with the ability to override

## Capabilities

### New Capabilities
- `model-selection`: Allow users to select a Claude model for each session. The selection persists on the session and is sent to the SDK on every query. UI provides a dropdown with available model options.

### Modified Capabilities

_None — no existing specs to modify._

## Impact

- **Server**: Pass model option to SDK `query()` call, store `model` on `StoredSession`
- **Shared types**: Add `model` field to `StoredSession`
- **Frontend**: Model selector dropdown component, update header or session settings
