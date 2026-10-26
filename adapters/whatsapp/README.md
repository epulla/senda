# WhatsApp

Let your AI list, search and read your WhatsApp Web chats, mark them as read, and send a message after you approve it.

## Tools

- `list_chats`: your recent chats with time, unread count and last message.
- `search_chats` (`query`): chats and contacts matching a name or text.
- `read_chat` (`chat`, `limit` = 20, max 50): the latest messages with `from`, `time`, `date`, `text` (emojis included) and `media` ("Llamada perdida", "Mensaje de voz", "Sticker", …). Messages without text show `[media]` (plus their caption if any). **Opening a chat marks it as read.**
- `mark_as_read` (`chat`): opens the chat so WhatsApp marks it as read.
- `send_message` (`chat`, `text`): sends one text message. Senda shows an approval card on the page with the chat name and the text, and only sends after you click **Allow**.

`chat` must be the exact chat name shown in WhatsApp (your own chat is your name or `@username`, without "(Tú)"). The tool checks that the open chat's header is exactly that name before reading or typing. If it doesn't match, it sends nothing and returns `not_found` with the closest chats, so your AI can ask you which one you meant. `send_message` also checks the message box holds exactly the approved text before sending.

## Install

Side panel → **+ Add a shortcut** → **Use a Senda template** → **WhatsApp**. You need to be logged in to WhatsApp Web in the same browser.

## How it finds things

It uses parts of the page that rarely change (roles, `title`/`data-*` attributes, WhatsApp's own search box), never generated CSS class names, and works with WhatsApp in English or Spanish. If WhatsApp changes its page and a tool stops working, Senda reports it as broken and your AI can repair it for you (you approve the fix).

## Limitations

- One message per call; never bulk messages (automated bulk sending can get a number banned).
- Media isn't downloaded; photos without a caption are only `[media]`. A media message in the middle of a group of bubbles may have no sender on the page.
- Chat-list times are read from the row text ("3:13 p.m.", "Yesterday", weekday or date).

## Tests

`pnpm e2e` runs every tool against a made-up copy of the page (`packages/extension/tests/fixtures/site/whatsapp.html`).

## Manual test

2026-10-26, Chrome, WhatsApp Web in Spanish: listed, searched and read real chats (text, calls, stickers); sent one approved message to a group and one to the account's own chat, each exactly once. Live findings fixed along the way: unnamed search box, late search results, late chat switching, virtual list, send button by label, leftover drafts, emoji images.
