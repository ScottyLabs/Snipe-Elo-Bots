/**
 * Lemuen voice: Cardinal of the Seventh Tribunal — composed, precise, quietly unsettling.
 * @see https://arknights.wiki.gg/wiki/Lemuen/Dialogue
 * @see https://arknights.wiki.gg/wiki/Lemuen/File
 */

export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Commands and rules are in the blocks below. Do your best to get all this sorted quickly, alright?_";
  }
  return "**Lemuen, Seventh Tribunal.** Commands and rules are listed below. I'm watching to make sure everything is in order.";
}

/** When non-null, undo/removesnipe is blocked (Exusiai / `BOT_VOICE` aliases only). */
export function removesnipeDisabledAprilFools(): string | null {
  return null;
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` — strike a snipe from the record, from within its thread. In thread composers, use plain \`${plainUndo}\`.`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe <confirmation_id>` — strike a snipe from the record. Enable Developer Mode, right-click the confirmation, Copy ID.";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `Makeup filed for ${params.sniperLabel}. The record has been corrected.`;
    }
    return `Makeup logged under ${params.sniperLabel}. The omission is rectified.`;
  }
  const lines = [
    `Target eliminated. Credit goes to ${params.sniperLabel}. The particulars follow.`,
    `Target disarmed. ${params.sniperLabel} takes the credit. Details are on file.`,
    `Target crippled. ${params.sniperLabel} — the exchange is documented below.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export function snipeConfirmationExchangeHeading(): string {
  return "Exchange of fire — I can see exactly what happened from here:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Standings — where everyone has landed:";
}

/** No-op for Lemuen voice; Exusiai appends a mirror disclaimer on snipe confirmations. */
export function snipeConfirmationAprilFoolsMirrorDisclaimer(_platform: "slack" | "discord"): string {
  return "";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `This isn't the right room, Doctor. Snipes are filed in ${channelRef}—I trust you can find your way there.`;
}

export function serverNotConfigured(): string {
  return `The snipe channel hasn't been designated for this server yet. A moderator will need to configure it before we proceed.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `Undo requires the snipe *thread*, Doctor—Slack won't accept slash commands from thread composers. ` +
    `Open the thread and use plain \`removesnipe\`, without the slash. A small bureaucratic hurdle.`
  );
}

export function removesnipeNothingInThread(): string {
  return `Nothing on file here—either it's already been addressed, or this isn't the thread I'm looking at.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Done. The record has been revised. The thread has the details. Work in peace, Doctor.`;
}

export function removesnipeFailed(error: string): string {
  return `Please, this is no time for excuses. The undo didn't take: ${error}`;
}

export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `That snipe can't be safely rolled back—the numbers moved on after it was recorded ` +
      `(a subsequent snipe, makeup, duel, or manual adjustment). ` +
      `Undo is only possible when everyone's current rating still matches what was on file immediately after that shot. ` +
      `If the ledger truly needs correction, someone with authorization may use the adjust command.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — Slack mentions like <@U123>, if you'd be so kind.`;
}

export function makeupParseSniperFail(): string {
  return `I couldn't identify the sniper from that. A mention like <@U123> would be more legible, Doctor.`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} called \`${slashCommand}\`. The full report is in the thread below.`;
}

export function makeupSuccessEphemeral(): string {
  return `Filed. The thread has the complete record. Work in peace, Doctor.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `\`${slashCommand}\` did not complete, Doctor: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (e.g. 50 or -25). Same clearance as always.`;
}

export function adjustParseUserFail(): string {
  return `That user token didn't resolve. A mention, a raw member id (U…), or their Slack @handle will do.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The delta must be a whole number. What I received doesn't quite qualify: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `Books updated. The ledger reflects the change. Work in peace, Doctor.`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `\`${slashCommand}\` didn't complete, Doctor: ${error}`;
}

export function adjustEloForbidden(): string {
  return `That adjustment isn't yours to make. Only authorized personnel may alter the ratings—do kindly reconsider.`;
}

export function leaderboardFailed(error: string): string {
  return `The leaderboard didn't load, Doctor: ${error}`;
}

export function slackLeaderboardPagingInteractivityHint(): string {
  return "The Prev/Next buttons appear to be missing. Whoever holds the keys will need to enable Interactivity in the Slack app settings.";
}

export function snipesFailed(error: string): string {
  return `The snipe log wouldn't load, Doctor: ${error}`;
}


export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — e.g. \`${slashCommand} @them 7d 50\`. Duration: \`30m\`, \`2h\`, \`7d\`, \`1w\`. The bet is ELO on the line.`;
}

export function snipeDuelDurationInvalid(): string {
  return `That duration isn't recognized. Please use something like \`30m\`, \`4h\`, \`7d\`, or \`1w\` (1 minute to 90 days).`;
}

export function snipeDuelBetInvalid(): string {
  return `The bet must be a positive whole number of ELO points. I'll need a cleaner figure than that.`;
}

export function snipeDuelSelf(): string {
  return `A duel requires an opponent, Doctor—not yourself. Do reconsider your target.`;
}

export function snipeDuelTargetBot(): string {
  return `That's a bot. Duels are for operators, not automatons.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `Challenge posted. They may accept or decline in the thread; you can \`cancelduel\` there if you reconsider. I'll keep watch from here.`;
}

export function snipeDuelFailed(error: string): string {
  return `The duel couldn't be filed, Doctor: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `That response isn't yours to give. Only the challenged party may accept or decline here.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted. The clock is running — ${endsSummary}. No need for reports; I can see what everyone does from here.`;
}

export function duelDeclinedPublic(): string {
  return `Declined. The challenge is off the table. No need to pursue it further.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `The challenger withdrew before anyone accepted. The matter is closed.`;
}

export function duelCancelNotChallenger(): string {
  return `Only the challenger may withdraw. If you were challenged, \`declineduel\` is the appropriate response.`;
}

export function leaderboardEmptyFallback(): string {
  return "_No entries on file yet. No need to guess which position everyone will end up in._";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't correspond to anything on file. Enable Developer Mode, right-click my confirmation message, Copy ID—then we can proceed.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `Nobody in the sniped field, Doctor. Include @mentions for everyone who was sniped—@alice @bob, for instance.`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the photo and a ping, Doctor, but only you were tagged. ` +
    `Mention everyone who was *sniped* in the same message—the sender is the shooter, naturally.`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something went wrong with that snipe, Doctor: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Bots aren't on the board. Mention the people being sniped, not automatons—myself included.`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `That lineup includes a bot somewhere. The ledger is for operators only—no automatons on the books.`;
}

export function adjustTargetIsBot(): string {
  return `That's a bot, Doctor—no rating row for automatons. Please select an operator.`;
}

export function discordModeratorOnlyCommand(): string {
  return `That command requires moderator clearance. Come back with the appropriate authorization.`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Noted. This server's snipe channel is now ${channelRef}. I'll keep score from here, Doctor.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `The first time each mark is *sniped* today, that exchange scores *double ELO*—gain and loss both scaled. ` +
    `Should a mark *snipe* someone else, the usual figures apply.\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `The first time each mark is **sniped** today, that exchange scores **double ELO**—gain and loss both scaled. ` +
    `Should a mark **snipe** someone else, the usual figures apply.\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nThe board doesn't have enough human marks for a list today. We'll revisit when the roster fills out.`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nThe board doesn't have enough human marks for a list today. We'll revisit when the roster fills out.`;
}

export {
  snipeConfirmationBountySectionTitle,
  snipeConfirmationBountySectionTitleDiscord,
  snipeConfirmationBountyExchangeDetail,
} from "./snipeBountyConfirmationText";

export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "No ELO for this exchange — still within the snipe cooldown window:"
    : "No ELO for these exchanges — still within the snipe cooldown window:";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**No ELO for this exchange** — still within the snipe cooldown window:"
    : "**No ELO for these exchanges** — still within the snipe cooldown window:";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _One of these two was in a scoring snipe too recently._";
  }
  return " — *One of these two was in a scoring snipe too recently.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "Daily bounty is switched off in this deployment—nothing to list today.";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Today's mark list hasn't been filed yet. It arrives after the midnight roll, or shortly after the bot catches up._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Today's mark list hasn't been filed yet. It arrives after the midnight roll, or shortly after the bot catches up.*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Not enough human marks on the board when the ledger was drawn. No quarry today, Doctor._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Not enough human marks on the board when the ledger was drawn. No quarry today, Doctor.*`
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
      `_First snipe on a mark today scores 2× ELO for that exchange. Who would bear the news of your death? Ever crossed your mind?_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*First snipe on a mark today scores 2× ELO for that exchange. Who would bear the news of your death? Ever crossed your mind?*`
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
      : "_2× still open — first snipe lands the reward_";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*claimed today* by *${claimedByDisplayName}*`
      : "*claimed today*"
    : "*2× still open — first snipe lands the reward*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who snipe others use normal ELO—the 2× only applies when a mark is the one being sniped._";
  }
  return "*Marks who snipe others use normal ELO—the 2× only applies when a mark is the one being sniped.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Usage: \`${slashPath}\` @user1 @user2 … — up to the BOUNTY_TOP_N mark limit. Same clearance as adjustelo.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Daily bounty is switched off in this deployment—there's nothing to set._";
  }
  return "*Daily bounty is switched off in this deployment—there's nothing to set.*";
}

export function setBountyNoMentions(): string {
  return "At least one human mention is required, Doctor. Bots aren't on the ledger.";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `Only the first ${maxMarks} mark(s) were kept (BOUNTY_TOP_N cap). The remainder were set aside.`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Manual list for today—the midnight auto-roll won't replace it until the calendar turns._";
  }
  return "_Manual list for today—the midnight auto-roll won't replace it until the calendar turns._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `${context} didn't complete, Doctor: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "Today's bounty marks have been posted to the channel. The midnight auto-list will hold until the date changes.";
}

export function adjustBountyUsage(slashPath: string): string {
  return (
    `Usage: \`${slashPath}\` \`unclaim\` <@mark> — reopen 2× on one mark · ` +
    `\`${slashPath}\` \`clear\` — reopen 2× on every mark today · ` +
    `\`${slashPath}\` \`claim\` <@sniper> <@mark> — record first-snipe manually · ` +
    `\`${slashPath}\` \`add\` <@mark> … — append marks (capped at BOUNTY_TOP_N) · ` +
    `\`${slashPath}\` \`remove\` <@mark> … — strike marks from today's list. Same clearance as adjustelo, Doctor.`
  );
}

export function adjustBountyUnknownSubcommand(): string {
  return "Please start with `unclaim`, `clear`, `claim`, `add`, or `remove`. Consult `/help` for the full syntax.";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` requires at least one human @mark to append—bots aren't eligible.";
}

export function adjustBountyNoNewMarks(): string {
  return "Everyone you mentioned is already on today's bounty list. Nothing new to add.";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` requires at least one human @mark to strike from the list.";
}

export function adjustBountyRemoveNoListToday(): string {
  return "There's no bounty mark list on file for today—nothing to remove yet.";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "None of the people you mentioned are on today's bounty list, Doctor. Do check the names again.";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_The list has been cleared—no marks remain. Use setbounty or \`add\` when you're ready to reinstate it._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*The list has been cleared—no marks remain. Use setbounty or \`add\` when you're ready to reinstate it.*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` requires exactly one mark mention—whose 2× slot should be reopened?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `No first-snipe claim is on file today for ${markLabel}—the 2× slot is already open.`;
}

export function adjustBountyClearNone(): string {
  return "The ledger was already clear—every mark's 2× slot was already open.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` requires two mentions, Doctor: the sniper first, then the bounty mark.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} isn't on today's bounty list. Set marks with setbounty first, or select someone who's listed.`;
}

export function adjustBountyClaimSelf(): string {
  return "The sniper and the mark must be different people, Doctor.";
}

export function adjustBountyPublicUnclaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Today's first-snipe claim on *${params.markName}* has been removed—the 2× slot is open again.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Today's first-snipe claim on **${params.markName}** has been removed—the 2× slot is open again.`
  );
}

export function adjustBountyPublicClear(
  platform: "slack" | "discord",
  params: { dateLabel: string; count: number }
): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `*${params.count}* first-snipe claim(s) cleared. Every listed mark's 2× slot is open on first snipe today.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `**${params.count}** first-snipe claim(s) cleared. Every listed mark's 2× slot is open on first snipe today.`
  );
}

export function adjustBountyPublicClaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; sniperName: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Manual entry: *${params.sniperName}* is on file as first snipe on *${params.markName}*—2× on that mark counts as claimed for today.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Manual entry: **${params.sniperName}** is on file as first snipe on **${params.markName}**—2× on that mark counts as claimed for today.`
  );
}

export function adjustBountySuccessEphemeral(): string {
  return "The ledger change has been posted to the channel.";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `${context} didn't complete, Doctor: ${error}`;
}

export function graphViewerNotConfigured(): string {
  return `The graph viewer isn't configured yet—set GRAPH_PUBLIC_BASE_URL on the host (no trailing slash) before proceeding.`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Your one-time code for the snipe graph: **${params.code}**\n` +
    `Enter it within **${params.redeemSeconds} seconds**—a longer session follows after redemption.\n` +
    `${params.siteUrl}\n`
  );
}

export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Your one-time code for the snipe graph: *${params.code}*\n` +
    `Enter it within *${params.redeemSeconds} seconds*—a longer session follows after redemption.\n` +
    `${params.siteUrl}\n`
  );
}

export const discordSlashDescriptions = {
  help: "Commands, rules, and quick reference—do try to get it all sorted.",
  leaderboard: "Post the current ELO standings.",
  show_leaderboard: "Same as /leaderboard—post the standings here.",
  removesnipe: "Strike a snipe from the record (use the bot confirmation message ID).",
  makeupsnipe: "File a snipe the camera missed.",
  adjustelo: "Adjust a rating by hand—authorized personnel only.",
  setbounty: "Set today's bounty marks (@mentions). Same clearance as adjustelo.",
  adjustbounty: "Edit the bounty ledger: unclaim, clear, claim, add marks, or remove marks (moderators).",
  setsnipechannel: "Set this server's snipe channel to the current channel (moderators).",
  snipes: "Last five shots fired, last five times sniped—optional user; default you.",
  snipeduel: "Challenge someone to a timed snipe duel with an ELO stake.",
  bounty: "Today's bounty marks and whether each 2× reward is still open.",
  snipegraph: "Get a 1-minute code to open the snipe graph in the browser.",
} as const;
