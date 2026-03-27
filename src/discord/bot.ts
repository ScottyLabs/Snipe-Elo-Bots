import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type Message,
} from "discord.js";
import type { EloDb } from "../db";
import { opsLog } from "../opsLog";
import * as L from "../voiceLemuen";
import { discordConfig } from "./configDiscord";
import {
  collectIdsForSnipeConfirmation,
  formatAdjustEloConfirmation,
  formatSnipeConfirmation,
  formatUndoConfirmation,
} from "../snipe";
import { collectMentionedUserIds, messageHasImageAttachment, parseMentionedUserIdsFromContent } from "./parseDiscord";
import {
  escapeDiscordMarkdownChunk,
  resolveDiscordDisplayNames,
  takeTopDiscordHumanLeaderboard,
} from "../discordDisplayNames";
import { purgeDiscordBotPlayersFromDb } from "../purgeBotPlayers";
import { collectIdsFromDirectedPairs, formatHeadToHeadDiscord } from "../headToHead";
import { SNIPES_LOG_LIMIT, collectIdsForSnipeLog, formatDiscordSnipesList } from "../snipeHistory";

const DART = "🎯";
const SNIPE_CHANNEL_META_KEY = "discord_snipe_channel_id";

function getGuildSnipeChannelId(db: EloDb, guildId: string): string | null {
  return db.getMeta(guildId, SNIPE_CHANNEL_META_KEY) ?? discordConfig.guildSnipeChannels.get(guildId) ?? null;
}

function setGuildSnipeChannelId(db: EloDb, guildId: string, channelId: string): void {
  db.setMeta(guildId, SNIPE_CHANNEL_META_KEY, channelId);
}

function isDiscordModerator(interaction: ChatInputCommandInteraction): boolean {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

/** Non-sniper mentions that resolve to human users (fetch on cache miss). */
async function discordHumanSnipedIds(
  message: Message,
  sniperId: string,
  mentionedIds: string[]
): Promise<{ humanSniped: string[]; mentionedSomeoneBesideSniper: boolean }> {
  const candidates = mentionedIds.filter((id) => id !== sniperId);
  const humanSniped: string[] = [];
  for (const id of candidates) {
    const u =
      message.mentions.users.get(id) ?? (await message.client.users.fetch(id).catch(() => null));
    if (!u) {
      humanSniped.push(id);
      continue;
    }
    if (u.bot) continue;
    humanSniped.push(id);
  }
  return { humanSniped, mentionedSomeoneBesideSniper: candidates.length > 0 };
}

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

async function renderLeaderboardText(db: EloDb, guild: Guild): Promise<string[]> {
  const guildId = guild.id;
  const sorted = db.getAllPlayersSorted(guildId);
  const { players, nameMap } = await takeTopDiscordHumanLeaderboard(
    guild,
    sorted,
    discordConfig.leaderboardTopN
  );
  const base = discordConfig.leaderboardTitle;
  const title = guild.name ? `${guild.name} — ${base}` : base;
  if (players.length === 0) return [`**${title}**\n${L.leaderboardEmptyFallback()}`];
  const lines: string[] = [`**${title}**`, ""];
  let rank = 1;
  for (const p of players) {
    const label = escapeDiscordMarkdownChunk(nameMap.get(p.playerId) ?? p.playerId);
    lines.push(`${rank}. ${label} — **${p.rating}**`);
    rank++;
  }
  return chunkLines(lines, 1950);
}

async function replyDiscordLeaderboard(interaction: ChatInputCommandInteraction, db: EloDb) {
  try {
    await interaction.deferReply();
    const parts = await renderLeaderboardText(db, interaction.guild!);
    await interaction.editReply({ content: parts[0] ?? L.leaderboardEmptyFallback() });
    for (let i = 1; i < parts.length; i++) {
      await interaction.followUp({ content: parts[i] });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: L.leaderboardFailed(msg) }).catch(() => {});
    } else {
      await interaction.reply({ content: L.leaderboardFailed(msg), ephemeral: true }).catch(() => {});
    }
  }
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
    guild: Guild;
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
      guildId: args.guild.id,
      kind: args.type,
      channelId: args.channelId,
      threadTs: args.threadTs,
      sniperId: args.sniperId,
      snipedIds: args.snipedIds,
    });

    const result = db.applySnipe({
      guildId: args.guild.id,
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

    const ids = collectIdsForSnipeConfirmation(args.sniperId, result.pairMatches, result.playerChanges);
    const names = await resolveDiscordDisplayNames(args.guild, ids);
    const nameOf = (id: string) => escapeDiscordMarkdownChunk(names.get(id) ?? id);

    const text = formatSnipeConfirmation({
      kind: args.type === "makeup" ? "makeup" : "snipe",
      sniperId: args.sniperId,
      pairMatches: result.pairMatches,
      playerChanges: result.playerChanges,
      nameOf,
    });

    const reply = await args.replyFn(text);
    db.setConfirmationMessageTs(args.guild.id, result.snipeId, reply.id);

    opsLog("discord.snipe.done", {
      guildId: args.guild.id,
      snipeId: result.snipeId,
      channelId: args.channelId,
    });
  }

  client.once(Events.ClientReady, async (c) => {
    console.log(`[snipe-elo-discord] Logged in as ${c.user.tag}`);
    try {
      const purged = await purgeDiscordBotPlayersFromDb(db, c);
      if (purged > 0) console.log(`[snipe-elo-discord] Purged ${purged} bot ELO row(s) from SQLite`);
    } catch (e) {
      console.error("[snipe-elo-discord] Bot ELO purge failed:", e);
      opsLog("elo.purge_bot_players.failed", {
        platform: "discord",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    const rest = new REST().setToken(discordConfig.token);
    const commands = [
      new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription(L.discordSlashDescriptions.leaderboard),
      new SlashCommandBuilder()
        .setName("show_leaderboard")
        .setDescription(L.discordSlashDescriptions.show_leaderboard),
      new SlashCommandBuilder()
        .setName("snipes")
        .setDescription(L.discordSlashDescriptions.snipes)
        .addUserOption((o) =>
          o
            .setName("player")
            .setDescription("Whose snipe log to open (defaults to you)")
            .setRequired(false)
        ),
      new SlashCommandBuilder()
        .setName("headtohead")
        .setDescription(L.discordSlashDescriptions.headtohead),
      new SlashCommandBuilder()
        .setName("removesnipe")
        .setDescription(L.discordSlashDescriptions.removesnipe)
        .addStringOption((o) =>
          o
            .setName("confirmation_id")
            .setDescription("ID of my confirmation message (Developer Mode: Copy ID)")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("makeupsnipe")
        .setDescription(L.discordSlashDescriptions.makeupsnipe)
        .addUserOption((o) => o.setName("sniper").setDescription("Who held the lens, so to speak").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("sniped")
            .setDescription("Who was caught—@mention each, e.g. @a @b")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("adjustelo")
        .setDescription(L.discordSlashDescriptions.adjustelo)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption((o) => o.setName("player").setDescription("Whose line on the ledger to move").setRequired(true))
        .addIntegerOption((o) =>
          o
            .setName("delta")
            .setDescription("Points to add (positive) or shave off (negative)")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("setsnipechannel")
        .setDescription(L.discordSlashDescriptions.setsnipechannel)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    ].map((cmd) => cmd.toJSON());

    try {
      const registerGuildIds = new Set<string>([
        ...discordConfig.guildSnipeChannels.keys(),
        ...c.guilds.cache.keys(),
      ]);
      for (const gid of registerGuildIds) {
        await rest.put(Routes.applicationGuildCommands(discordConfig.applicationId, gid), {
          body: commands,
        });
      }
      console.log(
        `[snipe-elo-discord] Slash commands registered for ${registerGuildIds.size} guild(s)`
      );
    } catch (e) {
      console.error("[snipe-elo-discord] Failed to register slash commands:", e);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    if (interaction.commandName === "leaderboard" || interaction.commandName === "show_leaderboard") {
      await replyDiscordLeaderboard(interaction, db);
      return;
    }

    if (interaction.commandName === "snipes") {
      await interaction.deferReply();
      try {
        const target = interaction.options.getUser("player") ?? interaction.user;
        const asSniper = db.getRecentSnipesForSniper(interaction.guild.id, target.id, SNIPES_LOG_LIMIT);
        const asSniped = db.getRecentSnipesAsSniped(interaction.guild.id, target.id, SNIPES_LOG_LIMIT);
        const snipeIds = collectIdsForSnipeLog(target.id, asSniper, asSniped);
        const snipeNames = await resolveDiscordDisplayNames(interaction.guild, snipeIds);
        const snipeNameOf = (id: string) => escapeDiscordMarkdownChunk(snipeNames.get(id) ?? id);
        const text = formatDiscordSnipesList(asSniper, asSniped, snipeNameOf(target.id), snipeNameOf);
        await interaction.editReply({ content: text });
        opsLog("discord.snipes", {
          guildId: interaction.guild.id,
          targetId: target.id,
          actorId: interaction.user.id,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: L.snipesFailed(msg) });
      }
      return;
    }

    if (interaction.commandName === "headtohead") {
      await interaction.deferReply();
      try {
        const rows = db.getDirectedSnipePairCounts(interaction.guild!.id);
        const h2hIds = collectIdsFromDirectedPairs(rows);
        const h2hNames = await resolveDiscordDisplayNames(interaction.guild, h2hIds);
        const h2hNameOf = (id: string) => escapeDiscordMarkdownChunk(h2hNames.get(id) ?? id);
        const text = formatHeadToHeadDiscord(rows, h2hNameOf);
        const parts = chunkLines(text.split("\n"), 1950);
        await interaction.editReply({ content: parts[0] ?? "(empty)" });
        for (let i = 1; i < parts.length; i++) {
          await interaction.followUp({ content: parts[i] });
        }
        opsLog("discord.headtohead", { guildId: interaction.guild!.id, userId: interaction.user.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: L.headtoheadFailed(msg) });
      }
      return;
    }

    if (interaction.commandName === "removesnipe") {
      const expectedCh = getGuildSnipeChannelId(db, interaction.guild.id);
      if (!expectedCh || interaction.channelId !== expectedCh) {
        await interaction.reply({
          content: expectedCh ? L.wrongSnipeChannel(`<#${expectedCh}>`) : L.serverNotConfigured(),
          ephemeral: true,
        });
        return;
      }

      const rawId = interaction.options.getString("confirmation_id", true).trim();
      const confirmationId = rawId.replace(/[^\d]/g, "");
      if (!/^\d{17,20}$/.test(confirmationId)) {
        await interaction.reply({
          content: L.discordInvalidConfirmationId(),
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        const snipe = db.getUndoableSnipeByConfirmationMessageId(interaction.guild.id, confirmationId);
        if (!snipe) {
          await interaction.editReply({
            content: L.discordNothingToUndo(),
          });
          return;
        }
        const undoResult = db.undoSnipeEvent({
          guildId: interaction.guild.id,
          channelId: interaction.channelId,
          threadTs: snipe.threadTs,
          snipeIdToUndo: snipe.snipeId,
        });
        const undoIds = undoResult.playerChanges.map((c) => c.playerId);
        const undoNames = await resolveDiscordDisplayNames(interaction.guild, undoIds);
        const undoNameOf = (id: string) => escapeDiscordMarkdownChunk(undoNames.get(id) ?? id);
        await interaction.editReply({
          content: formatUndoConfirmation({
            kind: "undo",
            undoingSnipeId: snipe.snipeId,
            playerChanges: undoResult.playerChanges,
            nameOf: undoNameOf,
          }),
        });
        opsLog("discord.removesnipe.ok", { undoesSnipeId: snipe.snipeId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: L.removesnipeFailed(msg) });
      }
      return;
    }

    if (interaction.commandName === "makeupsnipe") {
      const expectedCh = getGuildSnipeChannelId(db, interaction.guild.id);
      if (!expectedCh || interaction.channelId !== expectedCh) {
        await interaction.reply({
          content: expectedCh ? L.wrongSnipeChannel(`<#${expectedCh}>`) : L.serverNotConfigured(),
          ephemeral: true,
        });
        return;
      }

      const sniper = interaction.options.getUser("sniper", true);
      const snipedRaw = interaction.options.getString("sniped", true);
      const snipedIds = parseMentionedUserIdsFromContent(snipedRaw).filter((id) => id !== sniper.id);

      if (snipedIds.length === 0) {
        await interaction.reply({
          content: L.discordNoSnipedInMakeup(),
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        if (sniper.bot) {
          await interaction.editReply({ content: L.snipeMakeupIncludesBot() });
          return;
        }
        for (const id of snipedIds) {
          const u = await interaction.client.users.fetch(id).catch(() => null);
          if (!u || u.bot) {
            await interaction.editReply({ content: L.snipeMakeupIncludesBot() });
            return;
          }
        }
        await handleApplySnipeDiscord({
          guild: interaction.guild,
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
        await interaction.editReply({ content: L.makeupCommandFailed("/makeupsnipe", msg) });
      }
      return;
    }

    if (interaction.commandName === "setsnipechannel") {
      if (!isDiscordModerator(interaction)) {
        await interaction.reply({ content: L.discordModeratorOnlyCommand(), ephemeral: true });
        return;
      }
      setGuildSnipeChannelId(db, interaction.guild.id, interaction.channelId);
      await interaction.reply({ content: L.discordSnipeChannelSet(`<#${interaction.channelId}>`), ephemeral: true });
      opsLog("discord.setsnipechannel.ok", {
        guildId: interaction.guild.id,
        channelId: interaction.channelId,
        actorId: interaction.user.id,
      });
      return;
    }

    if (interaction.commandName === "adjustelo") {
      if (!isDiscordModerator(interaction)) {
        await interaction.reply({ content: L.discordModeratorOnlyCommand(), ephemeral: true });
        return;
      }
      const expectedCh = getGuildSnipeChannelId(db, interaction.guild.id);
      if (!expectedCh || interaction.channelId !== expectedCh) {
        await interaction.reply({
          content: expectedCh ? L.wrongSnipeChannel(`<#${expectedCh}>`) : L.serverNotConfigured(),
          ephemeral: true,
        });
        return;
      }

      const target = interaction.options.getUser("player", true);
      const delta = interaction.options.getInteger("delta", true);

      await interaction.deferReply();

      try {
        if (target.bot) {
          await interaction.editReply({ content: L.adjustTargetIsBot() });
          return;
        }
        const change = db.adjustPlayerRating({
          guildId: interaction.guild.id,
          playerId: target.id,
          delta,
        });
        const adjNames = await resolveDiscordDisplayNames(interaction.guild, [change.playerId]);
        const adjNameOf = (id: string) => escapeDiscordMarkdownChunk(adjNames.get(id) ?? id);
        await interaction.editReply({
          content: formatAdjustEloConfirmation({
            playerId: change.playerId,
            beforeRating: change.beforeRating,
            afterRating: change.afterRating,
            delta: change.delta,
            nameOf: adjNameOf,
          }),
        });
        opsLog("discord.adjustelo.ok", { guildId: interaction.guild.id, playerId: target.id, delta });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: L.adjustCommandFailed("/adjustelo", msg) });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;
      const snipeChannelId = getGuildSnipeChannelId(db, message.guild.id);
      if (!snipeChannelId || message.channelId !== snipeChannelId) return;

      const mentioned = collectMentionedUserIds(message);
      if (mentioned.length === 0) return;

      const sniperId = message.author.id;
      const { humanSniped, mentionedSomeoneBesideSniper } = await discordHumanSnipedIds(
        message,
        sniperId,
        mentioned
      );
      const hasImage = messageHasImageAttachment(message);

      if (discordConfig.snipeRequireImage && !hasImage) return;

      if (humanSniped.length === 0) {
        if (mentionedSomeoneBesideSniper) {
          await message.reply({ content: L.snipeImplicitBotsOnlyDiscord() });
          return;
        }
        if (hasImage) {
          await message.reply({
            content: L.implicitSnipeOnlySelfDiscord(),
          });
        }
        return;
      }

      await handleApplySnipeDiscord({
        guild: message.guild,
        type: "snipe",
        channelId: message.channelId,
        threadTs: message.id,
        sourceMessageTs: message.id,
        sniperId,
        snipedIds: humanSniped,
        reactSource: true,
        sourceMessage: message,
        replyFn: (content) => message.reply({ content }),
      });
    } catch (e) {
      console.error("[snipe-elo-discord] messageCreate error:", e);
    }
  });

  // Keep the process alive on Discord client errors; log and continue.
  client.on(Events.Error, (err) => {
    console.error("[snipe-elo-discord] client error:", err);
  });

  await client.login(discordConfig.token);
}
