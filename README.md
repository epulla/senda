<p align="center">
  <img src="docs/assets/brand/icon-256.png" width="128" alt="Senda icon">
</p>

<h1 align="center">Senda</h1>

<p align="center">
  <b>Trails for your AI through the web.</b><br>
  <a href="https://github.com/epulla/senda/actions/workflows/build.yml"><img src="https://github.com/epulla/senda/actions/workflows/build.yml/badge.svg" alt="Build"></a>
</p>

**Why wire up API keys and a separate connector for every app, when you're already logged in to all of them in your browser?**

Senda is a browser extension plus a local MCP server. Your AI assistant (Patio, Claude Code, Claude Desktop, Cursor, VS Code or any MCP client) can open pages, read them, click and type in your own browser, signed in as you. It works only in tabs it opens, inside a visible "🤖 MCP" tab group, and by default stops to ask you on the page before actions that look like sending, changing or deleting something.

<p align="center">
  <a href="https://chromewebstore.google.com/detail/senda/cmcjkfkendenhffongjoefpiookiocpe"><img src="https://img.shields.io/chrome-web-store/v/cmcjkfkendenhffongjoefpiookiocpe?style=for-the-badge&logo=googlechrome&logoColor=white&label=Download%20for%20Chrome&color=2ea44f" height="48" alt="Download Senda for Chrome"></a><br>
  <sub>Chrome, Brave or Edge · server: <a href="https://github.com/epulla/senda/releases/latest/download/senda-mcp.mjs">senda-mcp.mjs</a> · Claude Desktop bundle: <a href="https://github.com/epulla/senda/releases/latest/download/senda.mcpb">senda.mcpb</a> · <a href="#quick-start">install steps</a> · <a href="https://github.com/epulla/senda/releases">all releases</a></sub>
</p>

<p align="center">
  <img src="docs/assets/brand/mascot.png" alt="Senda mascot: a small orange robot with a green backpack on a winding trail" width="320">
</p>

> **Status:** early release. It works and is tested end to end, but expect rough edges and breaking changes.

<p align="center"><img src="docs/assets/approval.png" alt="Senda approval card on a compose page: your AI wants to click Send, with Allow and Deny buttons and the Send button highlighted" width="720"></p>

## Why Senda

Many browser MCP servers drive a separate, automated browser. Senda takes a different path:

- **Your real browser, your logins.** No new profile, no copied cookies. The AI uses the sites you are already signed into.
- **Only its own tabs.** The AI works in a "🤖 MCP" tab group you can see. Your other tabs stay out of reach.
- **Site shortcuts (adapters).** Your AI can write a small recipe for a site (for example "list my courses") so next time it is one tool call instead of dozens of clicks. Recipes are plain JSON, never code, and nothing is installed until you approve it in the side panel.
- **Approvals on the page.** Clicks that look like sending, paying or deleting (judged by the button's label), form submits and sharing data with a new site pause with a card on the page, with the target highlighted. How much to ask is up to you (side panel → Ask me before). New or changed shortcuts are approved in the side panel. Only real clicks count, so a page script cannot approve for you.
- **Prompt-injection defenses.** Page content is marked as untrusted data for the AI. Suspected injection is flagged ⚠️ and logged, and pages that try it trigger extra approvals.
- **Private fields stay private.** Password, card and one-time-code fields are blurred in screenshots.
- **One button to stop.** "Stop everything" in the side panel disconnects the AI, closes its tabs and pauses every shortcut.

<p align="center">
  <img src="docs/assets/sidepanel.png" alt="Senda side panel with a pending approval and an installed site shortcut" width="320">
  <img src="docs/assets/adapter.png" alt="Site shortcut detail: what your AI can do, which tools only read and which can make changes" width="460">
</p>

## Quick start

Needs a Chromium browser (Chrome, Brave or Edge).

1. **Install the extension** from the [Chrome Web Store](https://chromewebstore.google.com/detail/senda/cmcjkfkendenhffongjoefpiookiocpe) (works in Chrome, Brave and Edge). A setup page opens; pick your AI app there and it shows the steps. You can reopen it from the Senda toolbar icon.

   Or load it unpacked: download `senda-extension-<version>-chrome.zip` from the [latest release](https://github.com/epulla/senda/releases/latest), unzip it into a folder you will keep, open `chrome://extensions` (or `brave://extensions`, `edge://extensions`), turn on Developer mode, click **Load unpacked** and pick the folder.

2. **Add Senda to your AI app.** Pick your AI app on the setup page to see its steps. In short:

   **Patio:** the setup page has a prompt to paste into Patio; your AI there installs and adds Senda for you. By hand: needs [Node.js](https://nodejs.org) 20+ and [`senda-mcp.mjs`](https://github.com/epulla/senda/releases/latest/download/senda-mcp.mjs), saved somewhere you will keep (for example `~/.senda/senda-mcp.mjs`). Open Settings › MCP servers › Add server, choose Local command, set Command to `node` and Arguments to the absolute path of `senda-mcp.mjs`.

   **Claude Code:** needs Node.js 20+ and `senda-mcp.mjs` as above. Then:

   ```sh
   claude mcp add senda -- node /path/to/senda-mcp.mjs
   ```

   **Claude Desktop:** download [`senda.mcpb`](https://github.com/epulla/senda/releases/latest/download/senda.mcpb), open it and click **Install** in Claude. No Node.js needed.

   **Cursor and other MCP clients that take a JSON config:** needs Node.js 20+ and `senda-mcp.mjs` as above. Add:

   ```json
   {
     "mcpServers": {
       "senda": {
         "command": "node",
         "args": ["/path/to/senda-mcp.mjs"]
       }
     }
   }
   ```

   **VS Code (GitHub Copilot):** needs Node.js 20+ and `senda-mcp.mjs` as above. Run **MCP: Add Server** from the Command Palette, choose **Command (stdio)**, enter `node /path/to/senda-mcp.mjs` and name it `senda`.

3. **Pair.** Ask your AI: "Connect Senda". It shows a code; paste it into the Senda setup page and click Save. (Or print the code yourself: `node /path/to/senda-mcp.mjs token`.)

   <p align="center"><img src="docs/assets/setup.png" alt="Senda setup page: pick your AI app, follow its steps, then paste the code" width="460"></p>

4. **Try it.** The Senda icon shows a green "on" badge when connected. Ask your AI: "Open example.com and tell me the title."

### Build from source

Needs [pnpm](https://pnpm.io) as well.

```sh
git clone https://github.com/epulla/senda.git
cd senda
pnpm install
pnpm build
```

Then follow the steps above with `packages/extension/.output/chrome-mv3` as the extension folder and `packages/server/dist/index.js` as the server file. `pnpm bundle:mcpb` builds the Claude Desktop bundle at `packages/server/dist/senda.mcpb`.

The server listens on `127.0.0.1:18765` (set `SENDA_PORT` to change it) and keeps its token in `~/.senda/token`.

## Tools

| Tool | What it does |
| --- | --- |
| `senda_pairing_code` | Show the pairing code to paste into the Senda setup page. |
| `browser_list` | List connected browsers by name and id. |
| `browser_navigate` | Open a URL. |
| `browser_snapshot` | Read the page (or one element) as text with element refs. |
| `browser_click` / `browser_type` | Click an element or type into a field by ref. |
| `browser_scroll` | Scroll the page. |
| `browser_screenshot` | Capture the page or one element as an image, private fields blurred. |
| `browser_back` / `browser_forward` | Move through the tab's history. |
| `browser_tabs` | List, open, select or close tabs. |
| `adapter_schema` | Show the recipe format and authoring notes. |
| `adapter_draft` / `adapter_test` / `adapter_submit` | Write a shortcut, test it, send it to you for approval. |
| `adapter_install` | Install a shared recipe (JSON or HTTPS URL) as a draft for approval. |
| `adapter_list` / `adapter_disable` / `adapter_remove` | Manage installed shortcuts and drafts. |
| `adapter_call` | Run a tool from an installed shortcut. |

Each approved shortcut tool also shows up as its own tool, named `<adapter>__<tool>`. Set `SENDA_ADAPTER_TOOLS=compact` to skip those and use `adapter_call` only.

## Security and privacy

- Senda pauses protected actions for approval with a card on the page your AI is using; the side panel shows the same requests. Only real clicks count, so a page script cannot approve for you.
- Suspected prompt injection is marked ⚠️ and logged; pages can taint a site and trigger extra approval.
- "Never ask" (side panel → Ask me before) skips on-page approvals until Senda suspects prompt injection on a page your AI read. New or changed shortcuts still need your approval. It is not recommended and shows a red badge while on.
- Pages, emails and chats your AI reads (including other people's messages) are sent to your AI provider by your AI client.
- Other MCP servers connected to your AI client (such as Slack or email) are outside Senda's protection. Keep client approvals on for tools that send things.
- The extension talks only to the local server on `127.0.0.1`, except when you or your AI import a shortcut recipe from an HTTPS URL: then it fetches that URL. Details, storage and permissions: [PRIVACY.md](packages/extension/PRIVACY.md).

## Development

```sh
pnpm install
pnpm compile
pnpm test
pnpm build
```

`pnpm test` runs the unit tests. `pnpm e2e` builds the extension and server, then drives them end to end with Playwright: its own Chromium loads the extension, a temporary Senda server and the fixture site run on free ports, and the side panel opens as a normal page. Your real `~/.senda` token and running servers are untouched. First time only: `pnpm --filter @senda/extension exec playwright install chromium`.

`pnpm --filter @senda/extension dev` runs the extension with live reload. Release files: `pnpm build && pnpm --filter @senda/extension zip` makes `packages/extension/.output/senda-extension-<version>-chrome.zip`; `packages/server/dist/index.js` ships as `senda-mcp.mjs`. To regenerate the screenshots above: `SENDA_SHOTS=1 pnpm e2e readme-shots`.

Layout:

- `packages/extension`: the browser extension (WXT, React).
- `packages/server`: the local MCP server.
- `packages/protocol`: messages shared by both.
- `packages/adapter-schema`: the site shortcut recipe format.

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `pnpm compile && pnpm test` (and `pnpm e2e` if you touched the extension), and use [Conventional Commits](https://www.conventionalcommits.org) (`fix(runner): ...`). [AGENTS.md](AGENTS.md) lists the project rules, such as keeping all browser calls out of `src/core` and every UI string in the English and Spanish text files.

## License

[MIT](LICENSE)
