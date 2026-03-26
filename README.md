# Snipe ELO Slack Bot

This Slack bot stores an ELO rating for each player and updates a Slack Canvas leaderboard in a single configured channel. It also reacts to “implicit snipes” (mentions + an image attachment in the same message), supports undo, and supports manual “make up” snipes.

## Configure
Copy `.env.example` to `.env` and set:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_CHANNEL_ID` (the only channel the bot will operate in)

Optional:

- `SLACK_APP_TOKEN` (Socket Mode). If set, the bot will run in Socket Mode.

## Slack permissions (scopes)
At minimum, your Slack app needs scopes to:

- read/receive messages in the configured channel
- post messages in that channel
- add reactions (:dart:)
- read users (optional for display names; this basic implementation uses user IDs)
- manage canvases (`canvases:read`, `canvases:write`) so it can create/update the leaderboard canvas

The exact scopes depend on your Slack app type, but the bot uses:

- `chat.postMessage`
- `reactions.add`
- `canvases.list`, `canvases.create`, `canvases.edit`

## How “snipes” work

An implicit snipe is detected when:

1. The message is in `SLACK_CHANNEL_ID`
2. The message includes at least one user mention (`<@U...>`)
3. The message also contains an image attachment (`files[]` with `image/*` mimetype)

When detected, the bot will:

- react to the message with `:dart:`
- update ELO ratings (sniper = message author; sniped = mentioned users)
- post a confirmation message in the message thread, including per-target ELO deltas and current ELOs
- update the live Slack Canvas leaderboard

## Undo

To undo a snipe, reply in the thread to the bot’s confirmation message with:

- `/removesnipe` (leading slash required; override with `UNDO_COMMAND`)

The bot will revert the affected ELOs (with a safety check that the ratings haven’t changed since that snipe), post an undo confirmation in the thread, and update the leaderboard canvas.

## Make up a snipe

Use:

- `/makeupsnipe <sniper> <sniped1> <sniped2> ...` (leading slash required; override with `MAKEUP_COMMAND`)

`<sniper>` / `<sniped*>` should be Slack mentions like `<@U12345>`.

## Run

```bash
npm install
npm run dev
```

If you want a production build:

```bash
npm run build
npm start
```

