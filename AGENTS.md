# Senda

Browser extension and local MCP server that let an AI assistant navigate and use the web with user approval. Stack: WXT 0.21, React 19, Tailwind v4, TypeScript, Vitest, pnpm.

## Commands

Use pnpm only. `pnpm-lock.yaml` is the only lockfile.

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Compile all | `pnpm -r compile` |
| Test all | `pnpm -r test` |
| Build extension | `pnpm build` |
| Extension dev (Chrome/Firefox/Edge) | `pnpm --filter @senda/extension dev` / `dev:firefox` / `dev:edge` |
| Package compile/test | `pnpm --filter @senda/protocol compile` / `test` (same filters for other packages) |
| Add dependency | `pnpm --filter <package> add <pkg>` / `add -D <pkg>` |
| Run a binary | `pnpm exec <bin>` or `pnpm dlx <pkg>` |

Before finishing a change, run `pnpm compile && pnpm test` (extension, server, adapter-schema).

## Layout

- `packages/protocol/`: shared message types, schemas, and error codes.
- `packages/adapter-schema/`: versioned adapter contract.
- `packages/server/`: local MCP server and `senda` command.
- `packages/extension/entrypoints/background.ts`: browser extension background entry.
- `packages/extension/entrypoints/popup/`: compact extension popup.
- `packages/extension/entrypoints/onboarding/`: setup page.
- `packages/extension/src/core/`: pure logic; no browser API calls.
- `packages/extension/src/bg/`: browser-facing logic; every storage item lives in `state.ts`.
- `packages/extension/PRIVACY.md`: update when adding a permission, storage item, or network call.

## Domain rules

- `src/core` never imports `browser`.
- Every storage item lives in `src/bg/state.ts`.
- Every Chromium-only function goes through `src/core/capabilities.ts`.
- The runner never evaluates strings as code (no `eval`, `new Function`, `setTimeout(string)`).
- Every recipe passes `validate.ts` before saving or running.
- Any request for more permissions (new domain, write mode, new endpoint) always requires approval even for official adapters.
- Before finishing a change run `pnpm compile && pnpm test` (extension, server, adapter-schema).
- Update `PRIVACY.md` when adding a permission, storage item or network call.
- Conventional Commits with scope e.g. `feat(runner): ...`.

## UI copy

- Audience is non-technical. Use plain words that say what will happen; avoid jargon.
- Explain permission requests and actions clearly. No i18n; strings live inline in components.

## Git

- Phase 1 commits go straight to `main`.
- Use Conventional Commits, scoped when relevant, e.g. `feat(protocol): ...`.
