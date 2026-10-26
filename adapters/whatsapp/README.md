# WhatsApp

Let your AI list, search and read your WhatsApp Web chats, mark them as read, and send a message after you approve it.

## Tools

- `list_chats`: your recent chats with time, unread count and last message.
- `search_chats` (`query`): chats and contacts matching a name or text.
- `read_chat` (`chat`, `limit` = 20, max 50): the latest messages, with sender, time and date. Photos, voice notes and other attachments appear as `[media]` (plus their caption if any). **Opening a chat marks it as read.**
- `mark_as_read` (`chat`): opens the chat so WhatsApp marks it as read.
- `send_message` (`chat`, `text`): sends one text message. Senda shows an approval card on the page with the chat name and the text, and only sends after you click **Allow**.

`chat` must be the exact chat name shown in WhatsApp. If it doesn't match exactly, the tool sends nothing and returns `not_found` with the closest chats, so your AI can ask you which one you meant.

## Install

Side panel → **+ Add a shortcut** → **Use a Senda template** → **WhatsApp**. You need to be logged in to WhatsApp Web in the same browser.

## How it finds things

It uses parts of the page that rarely change (roles, `title`/`data-*` attributes, WhatsApp's own search box), never generated CSS class names, and works with WhatsApp in English or Spanish. If WhatsApp changes its page and a tool stops working, Senda reports it as broken and your AI can repair it for you (you approve the fix).

## Limitations

- One message per call; never bulk messages (automated bulk sending can get a number banned).
- Media isn't downloaded or described beyond `[media]` and captions.
- Chat-list times are read from the row text ("3:13 p.m.", "Yesterday", weekday or date).

## Tests

`pnpm e2e` runs every tool against a made-up copy of the page (`packages/extension/tests/fixtures/site/whatsapp.html`).

## Manual test

TODO: live check on a real account (PROJ-79 T4).
