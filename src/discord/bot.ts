import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type Message,
} from "discord.js";
import type { EloDb } from "../db";
import { opsLog } from "../opsLog";
import { isSlashCommandBody } from "../slashCommands";
import { discordConfig } from "./configDiscord";
import {
  formatAdjustEloConfirmation,
  formatSnipeConfirmation,
  formatUndoConfirmation,
} from "./formatDiscord";
import { collectMentionedUserIds, messageHasImageAttachment, parseMentionedUserIdsFromContent } from "./parseDiscord";

const DART = "🎯";

function chunkLines(lines: string[], maxLen = 1900): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > maxLen) {
      if (cur) chunks.push(cur);
      cur = line.length > maxLen ? line.slice(0, maxLen) : line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function renderLeaderboardText(db: EloDb, guildId: string, guildName: string | null): string[] {
  const players = db.getAllPlayersSorted(guildId).slice(0, discordConfig.leaderboardTopN);
  const base = discordConfig.leaderboardTitle;
  const title = guildName ? `${guildName} — ${base}` : base;
  if (players.length === 0) return [`**${title}**\n_No ratings yet._`];
  const lines: string[] = [`**${title}**`, ""];
  let rank = 1;
  for (const p of players) {
    lines.push(`${rank}. <@${p.playerId}> — **${p.rating}**`);
    rank++;
  }
  return chunkLines(lines, 1950);
}

export async function startDiscordBot(db: EloDb): Promise<void> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  async function handleApplySnipeDiscord(args: {
    guildId: string;
    type: "snipe" | "makeup";
    channelId: string;
    threadTs: string;
    sourceMessageTs: string | null;
    sniperId: string;
    snipedIds: string[];
    reactSource?: boolean;
    sourceMessage?: Message;
    replyFn: (content: string) => Promise<Message<boolean>>;
  }) {
    opsLog("discord.snipe.apply", {
      guildId: args.guildId,
      kind: args.type,
      channelId: args.channelId,
      threadTs: args.threadTs,
      sniperId: args.sniperId,
      snipedIds: args.snipedIds,
    });

    const result = db.applySnipe({
      guildId: args.guildId,
      type: args.type,
      channelId: args.channelId,
      threadTs: args.threadTs,
      sourceMessageTs: args.sourceMessageTs,
      sniperId: args.sniperId,
      snipedIds: args.snipedIds,
    });

    if (args.reactSource && args.sourceMessage) {
      await args.sourceMessage.react(DART).catch(() => {});
    }

    const text = formatSnipeConfirmation({
      kind: args.type === "makeup" ? "makeup" : "snipe",
      sniperId: args.sniperId,
      pairMatches: result.pairMatches,
      playerChanges: result.playerChanges,
    });

    const reply = await args.replyFn(text);
    db.setConfirmationMessageTs(args.guildId, result.snipeId, reply.id);

    opsLog("discord.snipe.done", {
      guildId: args.guildId,
      snipeId: result.snipeId,
      channelId: args.channelId,
    });
  }

  client.once(Events.ClientReady, async (c) => {
    console.log(`[snipe-elo-discord] Logged in as ${c.user.tag}`);
    const rest = new REST().setToken(discordConfig.token);
    const commands = [
      new SlashCommandBuilder().setName("leaderboard").setDescription("Show the ELO leaderboard"),
      new SlashCommandBuilder()
        .setName("makeupsnipe")
        .setDescription("Record a makeup snipe (sniper vs mentioned sniped players)")
        .addUserOption((o) => o.setName("sniper").setDescription("Who sniped").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("sniped")
            .setDescription("Who was sniped — use @mentions, e.g. @a @b")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("adjustelo")
        .setDescription("Manually add or subtract ELO for a player")
        .addUserOption((o) => o.setName("player").setDescription("Whose rating to change").setRequired(true))
        .addIntegerOption((o) =>
          o.setName("delta").setDescription("Amount to add (positive) or subtract (negative)").setRequired(true)
        ),
    ].map((cmd) => cmd.toJSON());

    try {
      for (const gid of discordConfig.guildSnipeChannels.keys()) {
        await rest.put(Routes.applicationGuildCommands(discordConfig.applicationId, gid), {
          body: commands,
        });
      }
      console.log(
        `[snipe-elo-discord] Slash commands registered for ${discordConfig.guildSnipeChannels.size} guild(s)`
      );
    } catch (e) {
      console.error("[snipe-elo-discord] Failed to register slash commands:", e);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    if (interaction.commandName === "leaderboard") {
      try {
        const parts = renderLeaderboardText(db, interaction.guild.id, interaction.guild.name);
        await interaction.reply({ content: parts[0] ?? "Empty leaderboard." });
        for (let i = 1; i < parts.length; i++) {
          await interaction.followUp({ content: parts[i] });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.reply({ content: `Failed: ${msg}`, ephemeral: true });
      }
      return;
    }

    if (interaction.commandName === "makeupsnipe") {
      const expectedCh = discordConfig.guildSnipeChannels.get(interaction.guild.id);
      if (!expectedCh || interaction.channelId !== expectedCh) {
        await interaction.reply({
          content: expectedCh
            ? `Use this command in <#${expectedCh}>.`
            : "This server is not configured for snipe ELO (missing guild→channel mapping).",
          ephemeral: true,
        });
        return;
      }

      const sniper = interaction.options.getUser("sniper", true);
      const snipedRaw = interaction.options.getString("sniped", true);
      const snipedIds = parseMentionedUserIdsFromContent(snipedRaw).filter((id) => id !== sniper.id);

      if (snipedIds.length === 0) {
        await interaction.reply({
          content: "No sniped players found. Include @mentions in the `sniped` field (e.g. `@alice @bob`).",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        await handleApplySnipeDiscord({
          guildId: interaction.guild.id,
          type: "makeup",
          channelId: interaction.channelId,
          threadTs: interaction.id,
          sourceMessageTs: null,
          sniperId: sniper.id,
          snipedIds,
          reactSource: false,
          replyFn: (content) => interaction.editReply({ content }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: `makeupsnipe failed: ${msg}` });
      }
      return;
    }

    if (interaction.commandName === "adjustelo") {
      const expectedCh = discordConfig.guildSnipeChannels.get(interaction.guild.id);
      if (!expectedCh || interaction.channelId !== expectedCh) {
        await interaction.reply({
          content: expectedCh
            ? `Use this command in <#${expectedCh}>.`
            : "This server is not configured for snipe ELO (missing guild→channel mapping).",
          ephemeral: true,
        });
        return;
      }

      const target = interaction.options.getUser("player", true);
      const delta = interaction.options.getInteger("delta", true);

      await interaction.deferReply();

      try {
        const change = db.adjustPlayerRating({
          guildId: interaction.guild.id,
          playerId: target.id,
          delta,
        });
        await interaction.editReply({
          content: formatAdjustEloConfirmation({
            playerId: change.playerId,
            beforeRating: change.beforeRating,
            afterRating: change.afterRating,
            delta: change.delta,
          }),
        });
        opsLog("discord.adjustelo.ok", { guildId: interaction.guild.id, playerId: target.id, delta });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: `adjustelo failed: ${msg}` });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;
      const snipeChannelId = discordConfig.guildSnipeChannels.get(message.guild.id);
      if (!snipeChannelId || message.channelId !== snipeChannelId) return;

      const lower = message.content.trim().toLowerCase();
      const refId = message.reference?.messageId;

      const isUndo = refId && isSlashCommandBody(lower, discordConfig.undoCommand);
      if (isUndo) {
        const snipe = db.getUndoableSnipeByConfirmationMessageId(message.guild.id, refId);
        if (!snipe) {
          await message.reply({ content: "Nothing to undo for that message." }).catch(() => {});
          return;
        }
        try {
          const undoResult = db.undoSnipeEvent({
            guildId: message.guild.id,
            channelId: message.channelId,
            threadTs: snipe.threadTs,
            snipeIdToUndo: snipe.snipeId,
          });
          await message.reply({ content: formatUndoConfirmation(undoResult.playerChanges) });
          opsLog("discord.removesnipe.ok", { undoesSnipeId: snipe.snipeId });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await message.reply({ content: `Undo failed: ${msg}` });
        }
        return;
      }

      const mentioned = collectMentionedUserIds(message);
      if (mentioned.length === 0) return;

      const sniperId = message.author.id;
      const snipedIds = mentioned.filter((id) => id !== sniperId);
      const hasImage = messageHasImageAttachment(message);

      if (discordConfig.snipeRequireImage && !hasImage) return;

      if (snipedIds.length === 0) {
        if (hasImage) {
          await message.reply({
            content:
              "I see an image but only you were mentioned. Mention everyone who was sniped in the same message.",
          });
        }
        return;
      }

      await handleApplySnipeDiscord({
        guildId: message.guild.id,
        type: "snipe",
        channelId: message.channelId,
        threadTs: message.id,
        sourceMessageTs: message.id,
        sniperId,
        snipedIds,
        reactSource: true,
        sourceMessage: message,
        replyFn: (content) => message.reply({ content }),
      });
    } catch (e) {
      console.error("[snipe-elo-discord] messageCreate error:", e);
    }
  });

  await client.login(discordConfig.token);
}
