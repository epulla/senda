# Senda Privacy

Senda sends no data outside your machine except to the local Senda server on `127.0.0.1`, which your AI client runs. Page content read by the AI is sent by that client to your chosen AI provider. Screenshots the AI asks for are sent the same way; password, card and one-time-code fields are blurred first, and the agent tab is shown for a moment while it is captured. Senda stores its pairing token, random browser id, installed adapters, and adapter drafts in extension local storage; the id is sent only to the local server. Recipes stay on the device.

When you ask your AI app to connect Senda, it gets the pairing code from the local server and shows it to you, so your AI provider sees that code too. The code only lets the extension talk to the local server on `127.0.0.1`.

When the user or AI asks to import a site shortcut recipe by URL, Senda fetches that URL only.

Approval cards, visited hosts, tabs opened by Senda, taint source, suspected-injection source and panic timestamp use session storage; approval preferences, appearance (light or dark), language (English or Spanish) and activity history use local storage.

## Permissions

- **tabs**: find and select browser tabs.
- **scripting**: read and interact with pages when requested.
- **storage**: store the local pairing token.
- **alarms**: schedule local keepalive checks.
- **tabGroups** (Chromium only): keep the tabs your AI uses in one "🤖 MCP" group.
- **sidePanel** (Chromium only): show your adapters and approval requests in the side panel.
- **All websites**: access pages only to provide browser capabilities requested by your AI.
