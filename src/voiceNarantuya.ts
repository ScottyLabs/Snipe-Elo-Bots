/**
 * Narantuya Kapudan (Arknights): Sargon sky-reader—"Hehe", "Haha!", "Man,", blades/sand/treasure swagger.
 * @see https://arknights.wiki.gg/wiki/Narantuya/Dialogue
 */

/** Short intro line under the /help title. */
export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_The sky's clear, and the wind's right. Here's how we play—keep your blades sharp and your eyes open. Hehe._"
    );
  }
  return (
    "**Under the open sky:** the rules of the hunt. I'll read the stars, you bring the treasure. Haha!"
  );
}

/** When non-null, undo/removesnipe is blocked (Exusiai / `BOT_VOICE` aliases only). */
export function removesnipeDisabledAprilFools(): string | null {
  return null;
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` — take back a shot in a thread. In thread composers, just drop a plain \`${plainUndo}\`. Man, make up your mind.`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe <confirmation_id>` — scrub a snipe from the sands.";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  /** Discord copy uses a slightly different makeup lead-in. */
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `Late claim filed under ${params.sniperLabel}. The stars remember—no hiding it now.`;
    }
    return `Makeup for ${params.sniperLabel}? Logged. The sands don't miss a step.`;
  }
  return `Bam—target marked. ${params.sniperLabel} claims the prize; the tally's written in the dunes.`;
}

export function snipeConfirmationExchangeHeading(): string {
  return "Blades in the wind—the exchange:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Standings—sun's right for reading the fortunes:";
}

/** No-op for default voice; Exusiai appends a mirror disclaimer on snipe confirmations. */
export function snipeConfirmationAprilFoolsMirrorDisclaimer(_platform: "slack" | "discord"): string {
  return "";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `Wrong dune, Doctor. Take it to ${channelRef}—I only read the winds where I'm told to.`;
}

export function serverNotConfigured(): string {
  return `No camp staked here yet—someone with the map needs to draw the lines first. Man, paperwork.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `Undo needs the snipe *thread*—Slack won't let you slash from thread composers. ` +
    `Open it, plain \`removesnipe\`, no slash. Relax, I've got your back.`
  );
}

export function removesnipeNothingInThread(): string {
  return `Nothing to sweep away—sands are already clear. Just testing the wind, yeah?`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Wiped from the record—read the sky before you gamble your treasure again.`;
}

export function removesnipeFailed(error: string): string {
  return `Man, this is no time for excuses—the undo didn't take: ${error}`;
}

/** Maps known DB errors to readable copy; keeps raw detail out of chat when we have a stable explanation. */
export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `I can't roll that one back—the winds have already shifted ` +
      `(another snipe, makeup, duel, or manual adjustment happened). ` +
      `Undo only works when the stars are exactly as we left them. ` +
      `If the tally really needs fixing, someone with the authority can adjust the ratings directly.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — Slack mentions like <@U123>, if you please. Let's keep it clean.`;
}

export function makeupParseSniperFail(): string {
  return `Couldn't read your shooter from the stars—gimme a clean mention, <@U123>. I read the sky, not minds.`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} called \`${slashCommand}\`—the full haul is in the thread. Haha, let's see what you got.`;
}

export function makeupSuccessEphemeral(): string {
  return `Carved in stone. Thread's got the full haul—man, everyone's so eager for treasure today.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} blew away in the sandstorm: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (e.g. 50 or -25). Don't get greedy.`;
}

export function adjustParseUserFail(): string {
  return `That user token's buried in the sand. Use a member mention, a raw member id (U…), or their Slack @handle.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The treasure needs to be a whole number. What you gave me is just dust: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `Books balanced; the sky knows. Good—a reliable crew deserves an honest count.`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} refused to budge: ${error}`;
}

export function adjustEloForbidden(): string {
  return `That blade's not yours to swing—only the camp leaders get to mess with the tallies.`;
}

export function leaderboardFailed(error: string): string {
  return `The roster scattered in the wind: ${error}. We'll try again when the dust settles.`;
}

/** Appended when Block Kit post fails but pagination was intended (plain-text fallback has no buttons). */
export function slackLeaderboardPagingInteractivityHint(): string {
  return (
    `To get Prev/Next buttons: Slack app → Interactivity & Shortcuts → turn *Interactivity* on. ` +
    `With *Socket Mode*, no Request URL is needed. ` +
    `With HTTP mode only, set the Request URL to your Bolt endpoint. ` +
    `Reinstall the app after changing the map.`
  );
}

export function snipesFailed(error: string): string {
  return `The logbook got buried: ${error}`;
}

export function headtoheadFailed(error: string): string {
  return `Head-to-head's lost in a mirage right now: ${error}`;
}

export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — e.g. \`${slashCommand} @them 7d 50\`. Duration: \`30m\`, \`2h\`, \`7d\`, \`1w\`. Bet is ELO points. Show me your swagger.`;
}

export function snipeDuelDurationInvalid(): string {
  return `That duration makes no sense under this sun. Use something like \`30m\`, \`4h\`, \`7d\`, or \`1w\` (between 1 minute and 90 days).`;
}

export function snipeDuelBetInvalid(): string {
  return `The bet must be a positive whole number of ELO points. We don't deal in half-measures.`;
}

export function snipeDuelSelf(): string {
  return `You can't duel yourself—find a real opponent in the dunes.`;
}

export function snipeDuelTargetBot(): string {
  return `That one's a machine. Duels are for flesh and blood with real treasure to lose.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `Challenge thrown. They can accept or decline in the thread; you can \`cancelduel\` there if you lose your nerve. Hehe.`;
}

export function snipeDuelFailed(error: string): string {
  return `The duel paperwork blew away: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `Keep your blade sheathed—only the challenged party gets to answer this.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted. The sun is high, the clock is running — ${endsSummary}. Every snipe counts now. Haha!`;
}

export function duelDeclinedPublic(): string {
  return `Declined. No treasure, no glory—consider the challenge buried.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `Withdrawn—the challenger backed down before the blades crossed.`;
}

/** Non-initiator typed cancelduel (includes challenged party—use declineduel). */
export function duelCancelNotChallenger(): string {
  return `Only the challenger can call it off; if you were the one challenged, use \`declineduel\` instead. Man, read the room.`;
}

export function leaderboardEmptyFallback(): string {
  return "_The sands are untouched—no shots counted yet. The stars will fill in soon enough._";
}

export function discordInvalidConfirmationId(): string {
  return `That ID is a mirage. Developer Mode on, right-click my confirmation message, Copy ID—then we can talk business.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `I don't see anyone in your sights. Add @mentions in the sniped field—@alice @bob, and so on. Don't make me guess.`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the shot, but you only tagged yourself. ` +
    `Kindly mention everyone you actually sniped—the shooter is whoever sent it. Let's keep the records clean.`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something fouled the winds: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Machines don't carry treasure. Mention the people you're sniping, not bots (me included). Haha.`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `You've got a bot in that lineup. The ledger is for real operators with a pulse—humans only, if you please.`;
}

export function adjustTargetIsBot(): string {
  return `That one's a bot—no treasure for automatons. Pick someone with a pulse.`;
}

export function discordModeratorOnlyCommand(): string {
  return `That tent is for the camp leaders only—if you've got the keys, try again.`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Understood. This camp's snipe lane is now ${channelRef}. I'll read the stars from here.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `The first time each mark is *sniped* today, the exchange yields *double ELO* (gain and loss both scaled). ` +
    `If a mark *snipes* someone else, we use the usual numbers. Show me your swagger~\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `The first time each mark is **sniped** today, the exchange yields **double ELO** (gain and loss both scaled). ` +
    `If a mark **snipes** someone else, we use the usual numbers. Show me your swagger~\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nNot enough human marks in the dunes yet—no list today. We'll read the stars again when the camp grows.`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nNot enough human marks in the dunes yet—no list today. We'll read the stars again when the camp grows.`;
}

/** Snipe confirmation: section heading when daily bounty (2× ELO) applied to one or more pairs. */
export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Daily bounty — 2× ELO on this exchange. A rich haul:"
    : "Daily bounty — 2× ELO on these exchanges. A rich haul:";
}

/** Discord snipe confirmation (markdown); same semantics as the Slack/plain block. */
export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Daily bounty** — **2× ELO** on this exchange. A rich haul:"
    : "**Daily bounty** — **2× ELO** on these exchanges. A rich haul:";
}

/** Appended to each bounty pair line: names the snipe that seized the mark. */
export function snipeConfirmationBountyExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _This snipe claimed today's bounty on the mark (2× ELO). Hehe._";
  }
  return " — *This snipe claimed today's bounty on the mark (2× ELO). Hehe.*";
}

/** Snipe confirmation: section when a pair was skipped because of snipe cooldown (no ELO). */
export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Too soon — no ELO for this exchange (snipe cooldown). The winds haven't reset:"
    : "Too soon — no ELO for these exchanges (snipe cooldown). The winds haven't reset:";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Too soon** — no ELO for this exchange (snipe cooldown). The winds haven't reset:"
    : "**Too soon** — no ELO for these exchanges (snipe cooldown). The winds haven't reset:";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _Someone here was in a scoring snipe too recently. Patience, man._";
  }
  return " — *Someone here was in a scoring snipe too recently. Patience, man.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "Daily bounty is disabled in this camp—no extra treasure to chase today.";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_I haven't read today's stars yet. The marks will land after the midnight roll—or whenever I catch up._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*I haven't read today's stars yet. The marks will land after the midnight roll—or whenever I catch up.*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_The sands were empty when I drew the ledger. No extra treasure to hunt today._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*The sands were empty when I drew the ledger. No extra treasure to hunt today.*`
  );
}

export function bountySlashListHeader(
  platform: "slack" | "discord",
  dateLabel: string,
  timeZoneIana: string
): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel} (_${timeZoneIana}_)\n` +
      `_First snipe landing on a mark today scores 2× ELO. Bring me a good show._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*First snipe landing on a mark today scores 2× ELO. Bring me a good show.*`
  );
}

export function bountySlashMarkLine(
  platform: "slack" | "discord",
  rank: number,
  displayName: string,
  claimed: boolean,
  claimedByDisplayName?: string | null
): string {
  if (platform === "slack") {
    const status = claimed
      ? claimedByDisplayName
        ? `_claimed today by ${claimedByDisplayName}_`
        : "_claimed today_"
      : "_2× still open—first blade to strike wins it_";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*claimed today* by *${claimedByDisplayName}*`
      : "*claimed today*"
    : "*2× still open—first blade to strike wins it*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who snipe others use normal ELO—only being sniped as a mark triggers the 2× treasure._";
  }
  return "*Marks who snipe others use normal ELO—only being sniped as a mark triggers the 2× treasure.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Usage: \`${slashPath}\` @user1 @user2 … — up to the day's mark limit (BOUNTY_TOP_N). Same access as adjustelo. Let's paint targets.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Daily bounty is off in this camp—nothing to set._";
  }
  return "*Daily bounty is off in this camp—nothing to set.*";
}

export function setBountyNoMentions(): string {
  return "Mention at least one human mark (e.g. @player). Bots don't carry treasure.";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `Only the first ${maxMarks} mark(s) are kept (BOUNTY_TOP_N). The rest are lost in the sand.`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Manual list for today—the midnight stars won't overwrite it until tomorrow._";
  }
  return "_Manual list for today—the midnight stars won't overwrite it until tomorrow._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `${context} got buried: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "Posted today's bounty marks to the camp—the midnight roll won't touch them until the calendar turns. Haha!";
}

export function adjustBountyUsage(slashPath: string): string {
  return (
    `Usage: \`${slashPath}\` \`unclaim\` <@mark> — reopen 2× on one mark · ` +
    `\`${slashPath}\` \`clear\` — reopen 2× on every mark today · ` +
    `\`${slashPath}\` \`claim\` <@sniper> <@mark> — record first-snipe manually · ` +
    `\`${slashPath}\` \`add\` <@mark> … — append marks (deduped, capped at BOUNTY_TOP_N) · ` +
    `\`${slashPath}\` \`remove\` <@mark> … — drop marks from today's list. Same access as adjustelo.`
  );
}

export function adjustBountyUnknownSubcommand(): string {
  return "Start with `unclaim`, `clear`, `claim`, `add`, or `remove`—see `/help` for the full map.";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` needs at least one human @mark to append—bots don't bleed.";
}

export function adjustBountyNoNewMarks(): string {
  return "Everyone you mentioned is already on today's bounty list. Give me fresh targets.";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` needs at least one human @mark to strike from the list. Man, pay attention.";
}

export function adjustBountyRemoveNoListToday(): string {
  return "There's no bounty list on the winds today (or it's empty)—nothing to remove.";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "None of those people are on today's bounty list. Double-check your marks.";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Every mark was struck from today's list—use setbounty or \`add\` when you're ready to hunt again._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Every mark was struck from today's list—use setbounty or \`add\` when you're ready to hunt again.*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` needs exactly one mark mention—who's getting their 2× treasure reopened?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `No first-snipe claim on file today for ${markLabel}—nothing to undo.`;
}

export function adjustBountyClearNone(): string {
  return "No first-snipe claims were on file today—every mark's 2× was already ripe for the taking.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` needs two mentions: the sniper who takes the glory first, then the bounty mark.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} isn't on today's bounty list—set marks with setbounty first, or pick someone who's actually a target.`;
}

export function adjustBountyClaimSelf(): string {
  return "Sniper and mark must be different people. You can't claim your own bounty, man.";
}

export function adjustBountyPublicUnclaim(platform: "slack" | "discord", params: { dateLabel: string; markName: string }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Removed today's first-snipe claim on *${params.markName}*—that mark's 2× treasure is back on the table.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Removed today's first-snipe claim on **${params.markName}**—that mark's 2× treasure is back on the table.`
  );
}

export function adjustBountyPublicClear(platform: "slack" | "discord", params: { dateLabel: string; count: number }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Cleared *${params.count}* first-snipe claim(s)—every listed mark's 2× bounty is open again.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Cleared **${params.count}** first-snipe claim(s)—every listed mark's 2× bounty is open again.`
  );
}

export function adjustBountyPublicClaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; sniperName: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Recorded a manual first snipe: *${params.sniperName}* → *${params.markName}* (2× on that mark is now claimed for today).`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Recorded a manual first snipe: **${params.sniperName}** → **${params.markName}** (2× on that mark is now claimed for today).`
  );
}

export function adjustBountySuccessEphemeral(): string {
  return "Posted the bounty ledger changes to the camp. Hehe.";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `${context} blew away: ${error}`;
}

export function graphViewerNotConfigured(): string {
  return `The sky-chart isn't wired yet—set GRAPH_PUBLIC_BASE_URL on the host to your Railway URL (no trailing slash), if you please.`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here's your one-time code for the sky-chart: **${params.code}**\n` +
    `Enter it on the site within **${params.redeemSeconds} seconds** (you'll get a longer look once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Slack mrkdwn (slash / ephemeral); avoids Discord-style **bold**. */
export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here's your one-time code for the sky-chart: *${params.code}*\n` +
    `Enter it on the site within *${params.redeemSeconds} seconds* (you'll get a longer look once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Discord slash command descriptions (short, her register). */
export const discordSlashDescriptions = {
  help: "Camp laws: commands, rules, how we count the treasure. Hehe.",
  leaderboard: "Who's riding highest today—the sky reads the same for everyone.",
  show_leaderboard: "Same as /leaderboard—post the ELO standings right here in the sand.",
  removesnipe: "Scrub a snipe from the record (use the bot confirmation message ID).",
  makeupsnipe: "Log a snipe the camera missed—paperwork for the diligent.",
  adjustelo: "Adjust someone's rating by hand—sparingly, if you please.",
  setbounty: "Set today's bounty marks (@mentions). Same access as adjustelo.",
  adjustbounty: "Edit bounty ledger, append marks, or remove marks from today's list (moderators).",
  setsnipechannel: "Set this camp's snipe channel to the current channel (moderators).",
  snipes: "Last five as shooter, last five times sniped—optional user; default you.",
  headtohead: "Pairwise snipe counts for everyone still walking the dunes.",
  snipeduel: "Challenge someone to a timed snipe duel with an ELO stake. Show your swagger.",
  bounty: "Today's bounty marks and whether each 2× treasure is still open.",
  snipegraph: "Get a 1-minute code to open the live snipe sky-chart for this camp in the browser.",
} as const;
