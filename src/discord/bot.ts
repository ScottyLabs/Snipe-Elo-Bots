import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
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
  takeDiscordHumanLeaderboardPaged,
} from "../discordDisplayNames";
import { purgeDiscordBotPlayersFromDb } from "../purgeBotPlayers";
import { calendarDateKeyInTimeZone } from "../bounty";
import { bountyEnv } from "../bountyEnv";
import { formatBountyStatusMessage } from "../bountyCommand";
import { startDiscordBountyScheduler } from "../bountySchedule";
import { collectIdsFromDirectedPairs, HEADTOHEAD_EMPTY } from "../headToHead";
import { renderHeadToHeadMatrixPng } from "../headToHeadSlackImage";
import { SNIPES_LOG_LIMIT, collectIdsForSnipeLog, formatDiscordSnipesList } from "../snipeHistory";
import { SLACK_GUILD_ID } from "../tenants";
import { isCommandBody } from "../slashCommands";
import {
  collectActiveDuelsForSnipe,
  formatDuelChallengeBlocksDiscord,
  formatDuelLiveScoreLineShortDiscord,
  formatDuelSettlementMessageDiscord,
  formatDurationLabel,
  parseDurationToMs,
} from "../snipeDuel";

const DART = "🎯";
const SNIPE_CHANNEL_META_KEY = "discord_snipe_channel_id";
const HEADTOHEAD_EMBED_COLOR = 0x5865f2;

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

/** Thread starter or reply-to-message id for a duel challenge posted in the snipe lane. */
async function resolveDuelRootMessageId(message: Message, snipeChannelId: string): Promise<string | null> {
  if (message.channel.isThread()) {
    if (message.channel.parentId !== snipeChannelId) return null;
    const starter = await message.channel.fetchStarterMessage().catch(() => null);
    return starter?.id ?? null;
  }
  if (message.channelId === snipeChannelId && message.reference?.messageId) {
    return message.reference.messageId;
  }
  return null;
}

function discordLeaderboardButtonCustomId(guildId: string, page: number): string {
  return `lb:${guildId}:${page}`;
}

function clampDiscordLeaderboardPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || totalPages < 1) return 1;
  return Math.min(Math.max(1, Math.floor(page)), totalPages);
}

async function buildDiscordLeaderboardPayload(
  db: EloDb,
  guild: Guild,
  page: number
): Promise<{ content: string; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const guildId = guild.id;
  const sorted = db.getAllPlayersSorted(guildId);
  const { allHumans, nameMap } = await takeDiscordHumanLeaderboardPaged(
    guild,
    sorted,
    discordConfig.leaderboardTopN
  );
  const pageSize = discordConfig.leaderboardPageSize;
  const totalPages = allHumans.length === 0 ? 1 : Math.ceil(allHumans.length / pageSize);
  const p = clampDiscordLeaderboardPage(page, totalPages);
  const start = (p - 1) * pageSize;
  const slice = allHumans.slice(start, start + pageSize);
  const base = discordConfig.leaderboardTitle;
  const title = guild.name ? `${guild.name} — ${base}` : base;

  let content: string;
  if (allHumans.length === 0) {
    content = `**${title}**\n${L.leaderboardEmptyFallback()}`;
  } else {
    const lines: string[] = [`**${title}** · _page ${p} of ${totalPages}_`, ""];
    let rank = start + 1;
    for (const pl of slice) {
      const label = escapeDiscordMarkdownChunk(nameMap.get(pl.playerId) ?? pl.playerId);
      lines.push(`${rank}. ${label} — **${pl.rating}**`);
      rank++;
    }
    content = lines.join("\n");
  }

  if (totalPages <= 1) {
    return { content, components: [] };
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(discordLeaderboardButtonCustomId(guildId, p - 1))
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p <= 1),
    new ButtonBuilder()
      .setCustomId(discordLeaderboardButtonCustomId(guildId, p + 1))
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p >= totalPages)
  );
  return { content, components: [row] };
}

function formatDiscordHelpText(guild: Guild, db: EloDb): string {
  const configuredCh = getGuildSnipeChannelId(db, guild.id);
  const snipeLane = configuredCh ? `<#${configuredCh}>` : "_not configured yet_";
  return [
    "**Snipe ELO — Help**",
    "",
    "**Core commands**",
    "• `/leaderboard` / `/show_leaderboard` — post the standings (paged; Prev/Next on the message).",
    "• `/snipes [player]` — latest snipes as shooter and as target.",
    "• `/headtohead` — head-to-head matrix image (active records only).",
    "• `/bounty` — today's bounty marks and whether each 2× reward is still open.",
    "• `/snipegraph` — one-time code (1 min) to open the snipe network graph in the browser (`GRAPH_PUBLIC_BASE_URL` on the host).",
    "",
    "**Scoring / moderation**",
    "• `/makeupsnipe <sniper> <sniped...>` — log a snipe that missed camera.",
    "• `/snipeduel <opponent> <duration> <bet>` — challenge a timed duel (e.g. `7d` stake `50`). Target: `acceptduel` / `declineduel`; challenger: `cancelduel` in the thread.",
    "• `/removesnipe <confirmation_id>` — undo one recorded snipe.",
    "• `/adjustelo <player> <delta>` — manual ELO adjustment (moderators).",
    "• `/setsnipechannel` — set this channel as the server's snipe lane (moderators).",
    "",
    "**Implicit snipe rule**",
    `• In the configured lane (${snipeLane}), a normal message records a snipe when it mentions non-bot target(s)`,
    `  and ${discordConfig.snipeRequireImage ? "includes an image attachment." : "is posted (image not required in this config)."}`,
  ].join("\n");
}

export type DiscordBotOptions = {
  /** Fires after slash commands, duels scheduler, etc. are wired (same tick as ClientReady handler end). */
  onReady?: (client: Client) => void;
};

export async function startDiscordBot(db: EloDb, options?: DiscordBotOptions): Promise<void> {
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

    const nowMs = Date.now();
    const activeDuels = collectActiveDuelsForSnipe(
      db,
      args.guild.id,
      args.sniperId,
      args.snipedIds,
      nowMs
    );
    const duelAppend =
      activeDuels.length > 0
        ? activeDuels
            .map((d) =>
              formatDuelLiveScoreLineShortDiscord({
                duel: d,
                nameOf,
                db,
                guildId: args.guild.id,
                nowMs,
              })
            )
            .join("\n")
        : undefined;

    const text = formatSnipeConfirmation({
      kind: args.type === "makeup" ? "makeup" : "snipe",
      sniperId: args.sniperId,
      pairMatches: result.pairMatches,
      playerChanges: result.playerChanges,
      nameOf,
      duelAppend,
      bountyFirstPairIndices: result.bountyFirstPairIndices,
      discordBountyHeading: true,
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
        .setName("help")
        .setDescription(L.discordSlashDescriptions.help),
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
        .setName("bounty")
        .setDescription(L.discordSlashDescriptions.bounty),
      new SlashCommandBuilder()
        .setName("snipegraph")
        .setDescription(L.discordSlashDescriptions.snipegraph),
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
        .setName("snipeduel")
        .setDescription(L.discordSlashDescriptions.snipeduel)
        .addUserOption((o) => o.setName("opponent").setDescription("Who you’re challenging").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("duration")
            .setDescription("Window after accept: 30m, 4h, 7d, 1w")
            .setRequired(true)
        )
        .addIntegerOption((o) =>
          o
            .setName("bet")
            .setDescription("ELO stake (whole number)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10_000)
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

    const settleDueDiscordSnipeDuels = async () => {
      const due = db.listAllSnipeDuelsDueForSettlement(Date.now());
      for (const duel of due) {
        if (duel.guildId === SLACK_GUILD_ID) continue;
        try {
          const guild = await c.guilds.fetch(duel.guildId).catch(() => null);
          if (!guild) continue;
          const a = duel.challengerId;
          const b = duel.targetId;
          const since = duel.acceptedAt ?? 0;
          const until = duel.endsAt ?? Date.now();
          const aToB = db.countDirectedSnipesInWindow(duel.guildId, a, b, since, until);
          const bToA = db.countDirectedSnipesInWindow(duel.guildId, b, a, since, until);
          const now = Date.now();
          const names = await resolveDiscordDisplayNames(guild, [a, b]);
          const nameOf = (id: string) => escapeDiscordMarkdownChunk(names.get(id) ?? id);

          if (aToB === bToA) {
            db.settleSnipeDuel(duel.duelId, duel.guildId, null, now);
          } else {
            const winnerId = aToB > bToA ? a : b;
            const loserId = aToB > bToA ? b : a;
            db.adjustPlayerRating({ guildId: duel.guildId, playerId: winnerId, delta: duel.betPoints });
            db.adjustPlayerRating({ guildId: duel.guildId, playerId: loserId, delta: -duel.betPoints });
            db.settleSnipeDuel(duel.duelId, duel.guildId, winnerId, now);
          }

          const text = formatDuelSettlementMessageDiscord({ duel, nameOf, db, guildId: duel.guildId });
          const channel = await guild.channels.fetch(duel.channelId).catch(() => null);
          if (channel?.isTextBased()) {
            await channel.send({ content: text });
          }
          opsLog("discord.duel.settled", {
            duelId: duel.duelId,
            guildId: duel.guildId,
            tie: aToB === bToA,
            aToB,
            bToA,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[snipe-elo-discord] duel settle failed ${duel.duelId}: ${msg}`);
          opsLog("discord.duel.settle_failed", { duelId: duel.duelId, error: msg });
        }
      }
    };

    setInterval(() => {
      void settleDueDiscordSnipeDuels();
    }, 60_000);
    void settleDueDiscordSnipeDuels();

    startDiscordBountyScheduler({
      client: c,
      db,
      resolveSnipeChannelId: (guildId) => getGuildSnipeChannelId(db, guildId),
    });

    options?.onReady?.(c);
  });

  async function replyDiscordLeaderboard(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();
      const { content, components } = await buildDiscordLeaderboardPayload(db, interaction.guild!, 1);
      await interaction.editReply({ content, components });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: L.leaderboardFailed(msg) }).catch(() => {});
      } else {
        await interaction.reply({ content: L.leaderboardFailed(msg), ephemeral: true }).catch(() => {});
      }
    }
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      const m = /^lb:(\d+):(\d+)$/.exec(interaction.customId);
      if (m) {
        const guildId = m[1];
        const page = parseInt(m[2], 10);
        if (!interaction.guild || interaction.guild.id !== guildId) {
          await interaction.reply({ content: "That board belongs to another server.", ephemeral: true }).catch(() => {});
          return;
        }
        try {
          await interaction.deferUpdate();
          const { content, components } = await buildDiscordLeaderboardPayload(db, interaction.guild, page);
          await interaction.editReply({ content, components });
          opsLog("discord.leaderboard.page", { guildId, page, userId: interaction.user.id });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await interaction.followUp({ content: L.leaderboardFailed(msg), ephemeral: true }).catch(() => {});
        }
        return;
      }
    }

    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    if (interaction.commandName === "help") {
      await interaction.reply({ content: formatDiscordHelpText(interaction.guild, db), ephemeral: true });
      opsLog("discord.help", { guildId: interaction.guild.id, userId: interaction.user.id });
      return;
    }

    if (interaction.commandName === "leaderboard" || interaction.commandName === "show_leaderboard") {
      await replyDiscordLeaderboard(interaction);
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

    if (interaction.commandName === "snipegraph") {
      if (!interaction.guild) {
        await interaction.reply({ content: L.serverNotConfigured(), ephemeral: true });
        return;
      }
      const base = discordConfig.graphPublicBaseUrl;
      if (!base) {
        await interaction.reply({ content: L.graphViewerNotConfigured(), ephemeral: true });
        return;
      }
      const { code, expiresAtMs } = db.issueGraphPasscode(interaction.guild.id);
      const siteUrl = `${base}/graph/`;
      const redeemSeconds = Math.max(1, Math.round((expiresAtMs - Date.now()) / 1000));
      await interaction.reply({
        content: L.graphCodeEphemeral({ code, siteUrl, redeemSeconds }),
        ephemeral: true,
      });
      opsLog("discord.snipegraph", {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
      });
      return;
    }

    if (interaction.commandName === "bounty") {
      if (!interaction.guild) {
        await interaction.reply({ content: L.serverNotConfigured(), ephemeral: true });
        return;
      }
      await interaction.deferReply();
      try {
        const guildId = interaction.guild.id;
        const dateKey = calendarDateKeyInTimeZone(Date.now(), bountyEnv.timezone);
        const row = db.getDailyBountyAnnouncementRow(guildId, dateKey);
        const bountyIds = row?.targetIds ?? [];
        const bountyNames = await resolveDiscordDisplayNames(interaction.guild, bountyIds);
        const bountyNameOf = (id: string) => escapeDiscordMarkdownChunk(bountyNames.get(id) ?? id);
        const text = formatBountyStatusMessage({
          platform: "discord",
          db,
          guildId,
          nameOf: bountyNameOf,
        });
        await interaction.editReply({ content: text });
        opsLog("discord.bounty", { guildId, userId: interaction.user.id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: `Couldn't read the bounty ledger: ${msg}` }).catch(() => {});
      }
      return;
    }

    if (interaction.commandName === "headtohead") {
      await interaction.deferReply();
      try {
        const rows = db.getDirectedSnipePairCounts(interaction.guild!.id);
        const h2hIds = collectIdsFromDirectedPairs(rows);
        const h2hNames = await resolveDiscordDisplayNames(interaction.guild, h2hIds);
        const nameForMatrix = (id: string) => {
          const n = h2hNames.get(id) ?? id;
          return n.replace(/\n/g, " ").trim() || "—";
        };
        const png = renderHeadToHeadMatrixPng({ pairRows: rows, nameOf: nameForMatrix });
        if (png === null) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(HEADTOHEAD_EMBED_COLOR)
                .setTitle("Head-to-head")
                .setDescription(HEADTOHEAD_EMPTY),
            ],
          });
        } else {
          const file = new AttachmentBuilder(png, { name: "head-to-head.png" });
          await interaction.editReply({
            files: [file],
            embeds: [
              new EmbedBuilder()
                .setColor(HEADTOHEAD_EMBED_COLOR)
                .setTitle("Head-to-head")
                .setDescription("_Snipes still on the books (undone rounds removed)._")
                .setImage("attachment://head-to-head.png"),
            ],
          });
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
        await interaction.editReply({ content: L.formatRemovesnipeError(msg) });
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

    if (interaction.commandName === "snipeduel") {
      const expectedCh = getGuildSnipeChannelId(db, interaction.guild.id);
      if (!expectedCh || interaction.channelId !== expectedCh) {
        await interaction.reply({
          content: expectedCh ? L.wrongSnipeChannel(`<#${expectedCh}>`) : L.serverNotConfigured(),
          ephemeral: true,
        });
        return;
      }

      const ch = interaction.channel;
      if (!ch?.isTextBased() || ch.isDMBased()) {
        await interaction.reply({ content: L.serverNotConfigured(), ephemeral: true });
        return;
      }

      const opponent = interaction.options.getUser("opponent", true);
      const durationRaw = interaction.options.getString("duration", true);
      const bet = interaction.options.getInteger("bet", true);

      await interaction.deferReply({ ephemeral: true });

      const durationMs = parseDurationToMs(durationRaw);
      if (durationMs === null) {
        await interaction.editReply({ content: L.snipeDuelDurationInvalid() });
        return;
      }
      if (opponent.id === interaction.user.id) {
        await interaction.editReply({ content: L.snipeDuelSelf() });
        return;
      }
      if (opponent.bot) {
        await interaction.editReply({ content: L.snipeDuelTargetBot() });
        return;
      }

      try {
        const durationLabel = formatDurationLabel(durationMs);
        const challengerMention = `<@${interaction.user.id}>`;
        const targetMention = `<@${opponent.id}>`;
        const body = formatDuelChallengeBlocksDiscord({
          challengerMention,
          targetMention,
          durationLabel,
          betPoints: bet,
        });
        const duelMsg = await ch.send({ content: body });
        await duelMsg.startThread({
          name: `Duel — ${interaction.user.username} vs ${opponent.username}`.slice(0, 100),
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        });
        db.insertSnipeDuel({
          guildId: interaction.guild.id,
          channelId: interaction.channelId,
          rootMessageTs: duelMsg.id,
          challengerId: interaction.user.id,
          targetId: opponent.id,
          betPoints: bet,
          durationMs,
        });
        await interaction.editReply({ content: L.snipeDuelPostedEphemeral() });
        opsLog("discord.snipeduel.posted", {
          guildId: interaction.guild.id,
          targetId: opponent.id,
          bet,
          durationMs,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await interaction.editReply({ content: L.snipeDuelFailed(msg) });
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
      if (!snipeChannelId) return;

      const raw = message.content.trim();
      if (raw) {
        const duelRootId = await resolveDuelRootMessageId(message, snipeChannelId);
        if (duelRootId) {
          const duel = db.getSnipeDuelByRootMessageTs(message.guild.id, duelRootId);
          if (duel && duel.status === "pending") {
            const lower = raw.toLowerCase();
            if (isCommandBody(lower, "cancelduel")) {
              if (message.author.id !== duel.challengerId) {
                await message.reply({ content: L.duelCancelNotChallenger() });
                return;
              }
              try {
                db.declineSnipeDuel(duel.duelId, message.guild.id);
                await message.reply({ content: L.duelCancelledByChallengerPublic() });
                opsLog("discord.duel.cancel", { duelId: duel.duelId, userId: message.author.id });
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                await message.reply({ content: L.snipeDuelFailed(msg) });
              }
              return;
            }
            if (isCommandBody(lower, "acceptduel") || isCommandBody(lower, "declineduel")) {
              if (message.author.id !== duel.targetId) {
                await message.reply({ content: L.duelReplyNotTarget() });
                return;
              }
              if (isCommandBody(lower, "acceptduel")) {
                try {
                  const acceptedAt = Date.now();
                  const endsAt = acceptedAt + duel.durationMs;
                  db.acceptSnipeDuel(duel.duelId, message.guild.id, acceptedAt, endsAt);
                  const endStr = new Date(endsAt).toISOString().replace("T", " ").slice(0, 16) + " UTC";
                  await message.reply({
                    content: L.duelAcceptedPublic(`window closes _${endStr}_`),
                  });
                  opsLog("discord.duel.accept", { duelId: duel.duelId, userId: message.author.id });
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  await message.reply({ content: L.snipeDuelFailed(msg) });
                }
                return;
              }
              if (isCommandBody(lower, "declineduel")) {
                try {
                  db.declineSnipeDuel(duel.duelId, message.guild.id);
                  await message.reply({ content: L.duelDeclinedPublic() });
                  opsLog("discord.duel.decline", { duelId: duel.duelId, userId: message.author.id });
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  await message.reply({ content: L.snipeDuelFailed(msg) });
                }
                return;
              }
            }
          }
        }
      }

      if (message.channelId !== snipeChannelId) return;

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
