# Senda

Trails for your AI through the web.

Senda connects your AI assistant to your browser so it can navigate and interact with pages with your approval.

**Status:** early development

## Develop

```sh
pnpm install
pnpm compile
pnpm test
pnpm build
```

## Testing

`pnpm test` runs the unit tests. `pnpm e2e` builds the extension and server, then drives them end to end with Playwright: its own Chromium loads the extension, a temporary Senda server and the fixture site run on free ports, and the side panel opens as a normal page. Your real `~/.senda` token and running servers are untouched. First time only: `pnpm --filter @senda/extension exec playwright install chromium`.

## Try it (Chrome, Brave, Edge)

1. `pnpm build`, then load `packages/extension/.output/chrome-mv3` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked).
2. Add the server to your MCP client, e.g. Claude Code:
   `claude mcp add senda -- node /path/to/senda/packages/server/dist/index.js`
3. Run `node packages/server/dist/index.js token` and paste the code in the Senda setup page.
4. The Senda icon turns green when connected. Ask: "Open example.com and tell me the title."

Pages, emails and chats your AI reads (including other people's messages) are sent to your AI provider.

# Security

Senda pauses protected actions for approval with a card on the page your AI is using (the side panel shows the same requests). Only real clicks count, so a page script cannot approve for you. Suspected prompt injection is marked ⚠️ and logged; pages can taint a site and trigger extra approval. "Never ask" (side panel → Ask me before) skips every approval, including adapter changes, until your AI reads untrusted content; it is not recommended and shows a red badge while on. Other MCP servers connected to your AI client (such as Slack or email) are outside Senda's protection. Keep client approvals enabled for outbound tools.
