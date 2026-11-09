# Senda

Browser extension and local MCP server that let an AI assistant navigate and use the web with user approval. Stack: WXT 0.21, React 19, Tailwind v4, TypeScript, Vitest, Playwright, esbuild, pnpm.

## Commands

Use pnpm only. `pnpm-lock.yaml` is the only lockfile.

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Compile all | `pnpm compile` |
| Unit tests all | `pnpm test` |
| Build extension + server | `pnpm build` |
| E2E (builds, then Playwright) | `pnpm e2e` |
| E2E, one spec | `pnpm e2e <spec>` e.g. `pnpm e2e approvals` |
| E2E browser, first time | `pnpm --filter @senda/extension exec playwright install chromium` |
| README + store screenshots | `SENDA_SHOTS=1 pnpm e2e readme-shots` |
| Fixture site alone | `pnpm fixtures` (127.0.0.1:18766) |
| Extension dev (Chrome/Firefox/Edge) | `pnpm --filter @senda/extension dev` / `dev:firefox` / `dev:edge` |
| Claude Desktop bundle | `pnpm bundle:mcpb` → `packages/server/dist/senda.mcpb` |
| Extension release zip | `pnpm --filter @senda/extension zip` |
| Chrome Web Store zip (no `key`) | `pnpm --filter @senda/extension zip:store` |
| Package compile/test | `pnpm --filter <package> compile` / `test` (`@senda/protocol`, `@senda/adapter-schema`, `@senda/extension`, `senda-mcp`) |
| Add dependency | `pnpm --filter <package> add <pkg>` / `add -D <pkg>` |
| Run a binary | `pnpm exec <bin>` or `pnpm dlx <pkg>` |

Before finishing a change, run `pnpm compile && pnpm test`. Run e2e only for the specs the change touches (`pnpm e2e <spec>`). E2E uses its own Chromium, a temporary server and token, and fixture ports; it never touches `~/.senda`.

## Layout

- `packages/protocol/`: shared message types, schemas, error codes, `DEFAULT_PORT` (18765).
- `packages/adapter-schema/`: versioned adapter (site shortcut) recipe contract.
- `packages/server/`: local MCP server (`src/index.ts`) and `senda` command; build output `dist/index.js`. `mcpb/`: Claude Desktop bundle manifest and `pack.mjs`.
- `packages/extension/entrypoints/`: `background.ts`, `popup/`, `onboarding/` (setup page), `sidepanel/` (approvals, shortcuts, settings), `adapter/` (shortcut detail page), `runner.ts`.
- `packages/extension/src/core/`: pure logic; no browser API calls. `core/adapters/`: recipe validation, diff, permissions, `{{args.x}}` rendering. `core/text/`: UI strings (`en.ts`, `es.ts`).
- `packages/extension/src/bg/`: browser-facing logic; `commands/` (one file per browser tool), `adapters/` (storage, run, recipe fetch); every storage item lives in `state.ts`.
- `packages/extension/src/injected/`: code injected into agent tabs (runner, snapshot, actions, approval card, screenshot).
- `packages/extension/src/ui/`: shared React bits (theme, language, i18n hooks).
- `packages/extension/tests/`: Vitest unit tests. `tests/fixtures/server.mjs`: fixture site with a chat page, a fake Moodle and `site/*.html` test pages; `tests/fixtures/adapters/`: fixture recipes.
- `packages/extension/e2e/`: Playwright specs; `fixtures.ts` starts Chromium with the built extension, the fixture site and a temporary server. `readme-shots.spec.ts` is skipped unless `SENDA_SHOTS=1`.
- `packages/extension/PRIVACY.md`: update when adding a permission, storage item, or network call.
- `docs/assets/`: README screenshots (`approval.png`, `sidepanel.png`, `adapter.png`, `setup.png`), `brand/` (icon, mascot, wordmarks, logos, avatar, social preview, banner), `store/` (store promos, OG image, 1280×800 `screenshots/`).
- `.github/workflows/build.yml`: CI (compile, test, build) on push to `main` and PRs.

## Domain rules

- `src/core` never imports `browser`.
- Every storage item lives in `src/bg/state.ts`.
- Every Chromium-only function goes through `src/core/capabilities.ts`.
- The runner never evaluates strings as code (no `eval`, `new Function`, `setTimeout(string)`).
- Every recipe passes `validate.ts` before saving or running.
- Adapters run only in agent tabs (the "🤖 MCP" group), never in the user's own tabs.
- Any request for more permissions (new domain, write mode, new endpoint) always requires approval even for official adapters.
- Update `PRIVACY.md` when adding a permission, storage item or network call.

## Maintain senda-mcp.mjs

- The released server is one standalone file, `senda-mcp.mjs` (= `packages/server/dist/index.js`), that runs with `node senda-mcp.mjs` on Node 20+ with no `node_modules`. Keep the `.mjs` name: it makes Node load the file as ESM without a package.json (a `.js` file fails on Node 20.0–20.18 and 22.0–22.11).
- Bundle every runtime dependency. Never add `--external` for a runtime dependency or a native-only package; the only externals are ws's optional `bufferutil` / `utf-8-validate`.
- If a new dependency cannot be bundled, stop and ask.
- Any server change: before release, copy `senda-mcp.mjs` to an empty temp dir and check `node senda-mcp.mjs token`, pairing with the extension, and one tool call.
- `senda.mcpb` wraps the same file as `server/senda-mcp.mjs`; the bundle adds only `manifest.json` and `icon.png`.
- README install steps, the setup page download links and the release asset names stay in sync.

## Release

- Tags and releases need Erick's approval of the version and the release notes.
- Version lives in `packages/extension/package.json` (`version`, also the manifest version), `packages/server/package.json` (`version`) and `packages/server/src/index.ts` (`McpServer` version). The `.mcpb` manifest takes its version from `packages/server/package.json` when packed.
- Build assets: `pnpm build && pnpm --filter @senda/extension zip` → `packages/extension/.output/senda-extension-<version>-chrome.zip`; copy `packages/server/dist/index.js` to `senda-mcp.mjs`; `pnpm bundle:mcpb` and copy `packages/server/dist/senda.mcpb`.
- Before tagging, test the assets from an empty temp dir: unzip and Load unpacked, `node senda-mcp.mjs token`, pair, one tool call; install `senda.mcpb` in Claude Desktop, say "Connect Senda", pair, one tool call.
- Publish: `git tag v<version> && git push origin v<version>`, then `gh release create v<version> senda-extension-<version>-chrome.zip senda-mcp.mjs senda.mcpb --title "Senda v<version>" --notes-file <notes>` (personal account `epulla`).
- The README Download button points to `releases/latest`; `senda-mcp.mjs` and `senda.mcpb` are linked via `releases/latest/download/<file>` (README and setup page), so keep those names unversioned.
- Chrome Web Store: `pnpm --filter @senda/extension zip:store` → `packages/extension/.output/senda-extension-<version>-chrome-store.zip` (same build, manifest without `key`; the store rejects it). Upload that zip, never the release zip. Screenshots: `docs/assets/store/screenshots/`. Listing setup line: "Install, then pick your AI app on the setup page." Keep app lists alphabetical and neutral everywhere (setup page, README, store): no app recommended or named first as easiest.
- No store publishing without a separate go.

## UI copy

- Audience is non-technical. Use plain words that say what will happen; avoid jargon.
- Explain permission requests and actions clearly.
- Every user-facing string lives in `src/core/text/en.ts` and `es.ts` (neutral Latin American Spanish, "tú"). UI reads them with `useText()` from `src/ui/i18n.ts`; core functions take the dictionary as a parameter defaulting to English. Text returned to the AI (errors, tool descriptions) and adapter recipes stay English; a recipe may add UI-only translations in `i18n.es` (name, description, site hint, tool descriptions), read with `localize()` from `src/ui/adapterLabels.tsx`.
- Manifest name and description live in `public/_locales/{en,es}/messages.json`.

## Git

- Commits go straight to `main`.
- Use Conventional Commits, scoped when relevant, e.g. `feat(protocol): ...`.
