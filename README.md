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

## Try it (Chrome, Brave, Edge)

1. `pnpm build`, then load `packages/extension/.output/chrome-mv3` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked).
2. Add the server to your MCP client, e.g. Claude Code:
   `claude mcp add senda -- node /path/to/senda/packages/server/dist/index.js`
3. Run `node packages/server/dist/index.js token` and paste the code in the Senda setup page.
4. The Senda icon turns green when connected. Ask: "Open example.com and tell me the title."

Pages, emails and chats your AI reads (including other people's messages) are sent to your AI provider.

# Security

Senda pauses protected actions for approval in its side panel. Suspected prompt injection is marked ⚠️ and logged; pages can taint a site and trigger extra approval. Other MCP servers connected to your AI client (such as Slack or email) are outside Senda's protection. Keep client approvals enabled for outbound tools.
