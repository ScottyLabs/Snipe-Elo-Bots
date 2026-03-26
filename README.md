# Snipe ELO Slack Bot

This Slack bot stores an ELO rating for each player and updates a Slack Canvas leaderboard in a single configured channel. It also reacts to “implicit snipes” (mentions + an image attachment in the same message), supports undo, and supports manual “make up” snipes.

## Configure
Copy `.env.example` to `.env` and set:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_CHANNEL_ID` (the only channel the bot will operate in)

Optional:

- `SLACK_APP_TOKEN` (Socket Mode). If set, the bot will run in Socket Mode.

## Slack slash commands

### Commands don’t show up / “nothing is generated” — is it scopes?

**No.** OAuth **scopes** control what the bot token may *do* (post messages, read history, etc.). They do **not** create or list slash commands for you.

Slack also **does not** read your Bolt `app.command(...)` handlers and auto-register commands. The composer only shows `/leaderboard`, `/removesnipe`, etc. after those commands exist **in the Slack app configuration**.

Do one of the following:

1. **Manifest (fastest):** [Create an app from a manifest](https://api.slack.com/apps?new_app=1) and paste/adapt `slack-app-manifest.example.json` (command names must match your env defaults, or edit the manifest to match `UNDO_COMMAND`, `MAKEUP_COMMAND`, etc.).
2. **Manual:** [Your app](https://api.slack.com/apps) → **Slash Commands** → **Create New Command** for each row in the table below.

**Socket Mode:** Delivery goes over the websocket; you still **must** define each slash command in the app so Slack shows it in the UI. When Slack asks for a Request URL on each command, you can use a placeholder `https://example.com/slack/events` if you rely on Socket Mode for delivery (see Slack’s current docs for your workspace).

**HTTP mode:** Set every slash command’s Request URL to your Bolt receiver, usually `https://<your-host>/slack/events`.

---

Slack only treats user-facing “commands” as **slash commands** registered on your app (plain messages starting with `/` are handled by Slack’s own UI, not as normal channel text).

In [your Slack app](https://api.slack.com/apps) → **Slash Commands**, create commands whose names match your env (defaults), or use the example manifest above:

| Command | Hint text (example) |
|--------|----------------------|
| `/leaderboard` | Show ELO leaderboard in channel |
| `/removesnipe` | Undo last snipe in this thread |
| `/makeupsnipe` | Args: `<sniper> <sniped1> …` (mentions) |
| `/adjustelo` | Args: `<user> <delta>` (integer). **Slack:** only user IDs in `ADJUSTELO_ALLOWED_SLACK_USER_IDS` (default `U09E6EHA5R8`). |

- **Request URL** (HTTP mode): same base as Events API, usually `https://<host>/slack/events` for Bolt.
- **Socket Mode**: commands are still delivered over the socket; you must still create each slash command in the app so Slack shows them in the composer.

Override names with `SLACK_LEADERBOARD_COMMAND`, `UNDO_COMMAND`, `MAKEUP_COMMAND`, `ADJUSTELO_COMMAND` (with or without a leading `/` in env; the bot normalizes to `/name`).

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

Run **`/removesnipe`** from **inside the snipe thread** (open the thread under the bot confirmation, then invoke the slash command there). The bot posts the undo result in the thread and refreshes the canvas.

## Make up a snipe

Use **`/makeupsnipe`** with arguments: `<sniper> <sniped1> <sniped2> …` as Slack mentions (`<@U12345>`). The bot posts a short parent message in the channel and records the makeup in that message’s thread.

## Manual ELO adjust

Use **`/adjustelo`** with `<user mention> <integer delta>` (e.g. `<@U123> 50` or `<@U123> -25`). On Slack, only members listed in `ADJUSTELO_ALLOWED_SLACK_USER_IDS` may run it (comma-separated; built-in default if unset).

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
