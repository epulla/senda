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
- `packages/extension/entrypoints/sidepanel/`: adapter list and approvals.
- `packages/extension/entrypoints/runner.ts` + `src/injected/runner.ts`: recipe runner injected into agent tabs.
- `packages/extension/src/core/adapters/`: recipe validation, diff, permissions, templates (pure).
- `packages/extension/src/bg/adapters/`: adapter storage and execution.
- `packages/extension/tests/fixtures/server.mjs`: local fixture site (`pnpm fixtures`, 127.0.0.1:18766) with a chat page and a fake Moodle.
- `packages/extension/src/core/`: pure logic; no browser API calls.
- `packages/extension/src/bg/`: browser-facing logic; every storage item lives in `state.ts`.
- `packages/extension/PRIVACY.md`: update when adding a permission, storage item, or network call.

## Domain rules

- `src/core` never imports `browser`.
- Every storage item lives in `src/bg/state.ts`.
- Every Chromium-only function goes through `src/core/capabilities.ts`.
- The runner never evaluates strings as code (no `eval`, `new Function`, `setTimeout(string)`).
- Every recipe passes `validate.ts` before saving or running.
- Adapters run only in agent tabs (the "🤖 MCP" group), never in the user's own tabs.
- Any request for more permissions (new domain, write mode, new endpoint) always requires approval even for official adapters.
- Before finishing a change run `pnpm compile && pnpm test` (extension, server, adapter-schema).
- Update `PRIVACY.md` when adding a permission, storage item or network call.
- Conventional Commits with scope e.g. `feat(runner): ...`.

## UI copy

- Audience is non-technical. Use plain words that say what will happen; avoid jargon.
- Explain permission requests and actions clearly.
- Every user-facing string lives in `src/core/text/en.ts` and `es.ts` (neutral Latin American Spanish, "tú"). UI reads them with `useText()` from `src/ui/i18n.ts`; core functions take the dictionary as a parameter defaulting to English. Text returned to the AI (errors, tool descriptions) and adapter recipes stay English; a recipe may add UI-only translations in `i18n.es` (name, description, site hint, tool descriptions), read with `localize()` from `src/ui/adapterLabels.tsx`.
- Manifest name and description live in `public/_locales/{en,es}/messages.json`.

## Git

- Commits go straight to `main`.
- Use Conventional Commits, scoped when relevant, e.g. `feat(protocol): ...`.
