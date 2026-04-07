## 1. Package scaffolding

- [ ] 1.1 Create `packages/summit-core/` with `package.json`, `tsconfig.json`, and `src/index.ts` entry point
- [ ] 1.2 Rename `frontend/` to `packages/summit-web/` and update root `package.json` workspaces
- [ ] 1.3 Add `summit-core` as workspace dependency in `summit-web`'s `package.json`
- [ ] 1.4 Verify `bun install` resolves all workspace dependencies

## 2. Extract core subsystems

- [ ] 2.1 Move `eventBus.ts` to `summit-core/src/eventBus.ts`, remove H3/Nitro imports if any
- [ ] 2.2 Move `sessions.ts` to `summit-core/src/sessions.ts`
- [ ] 2.3 Move `interactions.ts` to `summit-core/src/interactions.ts`
- [ ] 2.4 Move `worktrees.ts` to `summit-core/src/worktrees.ts`
- [ ] 2.5 Move `projects.ts` to `summit-core/src/projects.ts`
- [ ] 2.6 Move `queryManager.ts` to `summit-core/src/queryManager.ts`
- [ ] 2.7 Move `providers/` directory to `summit-core/src/providers/` (registry + claude-code provider)
- [ ] 2.8 Move `extensions/` directory to `summit-core/src/extensions/` (loader, API, bundled extensions)

## 3. Core factory API

- [ ] 3.1 Implement `createSummit(config)` factory in `summit-core/src/index.ts` that initializes all subsystems and returns a typed `Summit` instance
- [ ] 3.2 Export `Summit` type and `createSummit` from package entry point
- [ ] 3.3 Ensure all subsystem cross-references use the factory instance (no module-level singletons)

## 4. Web adapter layer

- [ ] 4.1 Create Nuxt server plugin that calls `createSummit()` and stores the instance
- [ ] 4.2 Create `useCore()` utility that returns the initialized core instance
- [ ] 4.3 Refactor API routes to use `useCore()` and delegate to core subsystems (no business logic in routes)
- [ ] 4.4 Update `shared/types.ts` re-exports if needed

## 5. Optional OIDC authentication

- [ ] 5.1 Add `nuxt-auth-utils` or equivalent OIDC library as optional dependency
- [ ] 5.2 Create auth server middleware that checks `SUMMIT_AUTH_ENABLED` env var and no-ops when disabled
- [ ] 5.3 Implement OIDC token validation using `SUMMIT_OIDC_ISSUER`, `SUMMIT_OIDC_CLIENT_ID`, `SUMMIT_OIDC_CLIENT_SECRET`
- [ ] 5.4 Add startup validation that errors on missing OIDC env vars when auth is enabled

## 6. Build and verify

- [ ] 6.1 Verify `summit-core` builds independently with `bun run build`
- [ ] 6.2 Verify `summit-web` builds and starts with core as dependency
- [ ] 6.3 Verify existing functionality works end-to-end (session CRUD, chat, events, extensions)
- [ ] 6.4 Verify auth-disabled mode behaves identically to current behavior
