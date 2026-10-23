# Senda Privacy

Senda sends no data outside your machine except to the local Senda server on `127.0.0.1`, which your AI client runs. Page content read by the AI is sent by that client to your chosen AI provider. Senda stores its pairing token, random browser id, installed adapters, and adapter drafts in extension local storage; the id is sent only to the local server. Recipes stay on the device.

When the user or AI asks to import a template by URL, Senda fetches that URL only.

Approval cards, visited hosts, tabs opened by Senda, taint source and panic timestamp use session storage; approval preferences, appearance (light or dark), language (English or Spanish) and activity history use local storage.

## Permissions

- **tabs**: find and select browser tabs.
- **scripting**: read and interact with pages when requested.
- **storage**: store the local pairing token.
- **alarms**: schedule local keepalive checks.
- **tabGroups** (Chromium only): keep the tabs your AI uses in one "🤖 MCP" group.
- **sidePanel** (Chromium only): show your adapters and approval requests in the side panel.
- **All websites**: access pages only to provide browser capabilities requested by your AI.
