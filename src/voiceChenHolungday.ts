/**
 * Ch'en the Holungday (Arknights): Dossoles ease on Lungmen steel—short sentences, "No need to fret", "Buck up", "Hmph", "Roger."
 * @see https://arknights.wiki.gg/wiki/Ch%27en_the_Holungday/Dialogue
 */

/** Short intro line under the /help title. */
export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_Back from Dossoles. Handbook's below. Skim it before you make me do more paperwork._"
    );
  }
  return (
    "**Ch'en here.** Holiday's over. Commands and rules are below. No need to fret—just read them."
  );
}

/** When non-null, undo/removesnipe is blocked (Exusiai / `BOT_VOICE` aliases only). */
export function removesnipeDisabledAprilFools(): string | null {
  return null;
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` — undo latest snipe in a thread. In thread composers, use plain \`${plainUndo}\`.`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe <confirmation_id>` — undo one recorded snipe.";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  /** Discord copy uses a slightly different makeup lead-in. */
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `Makeup snipe under ${params.sniperLabel}. Filed. Don't make me redo it from the beach.`;
    }
    return `Makeup for ${params.sniperLabel}. Filed. Above board.`;
  }
  return `That's a wrap. ${params.sniperLabel} gets credit. I've filed the dull parts too.`;
}

export function snipeConfirmationExchangeHeading(): string {
  return "Incident summary. Suppressing fire:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Standings for now. Buck up:";
}

/** No-op for default voice; Exusiai appends a mirror disclaimer on snipe confirmations. */
export function snipeConfirmationAprilFoolsMirrorDisclaimer(_platform: "slack" | "discord"): string {
  return "";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `Wrong stretch. I'm only working ${channelRef}. Humor me.`;
}

export function serverNotConfigured(): string {
  return `Snipe lane isn't configured. Mods with keys, set it first. Hmph.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `Undo needs the snipe *thread*. Slack won't take slash from thread composers. ` +
    `Open it, plain \`removesnipe\`, no slash. I'll take care of the rest.`
  );
}

export function removesnipeNothingInThread(): string {
  return `Nothing to dismiss. Wrong file or already closed. Stay calm.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Undone. Particulars in the thread. I'll bring up the rear if it goes sideways.`;
}

export function removesnipeFailed(error: string): string {
  return `Please, this is no time for excuses. Undo didn't take: ${error}`;
}

/** Maps known DB errors to readable copy; keeps raw detail out of chat when we have a stable explanation. */
export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `I can't roll that snipe back safely. The numbers moved on after it was recorded ` +
      `(another snipe, a makeup, a duel, or a manual ELO adjust). ` +
      `Undo only works when everyone's current rating still matches what we had right after that shot. ` +
      `If the books truly need fixing, someone with the keys can set ratings with the adjust command.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … Slack mentions like <@U123>, if you please.`;
}

export function makeupParseSniperFail(): string {
  return `Couldn't read the shooter. Proper mention, <@U123>. You never learn, do you, Doctor?`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} opened \`${slashCommand}\`. Incident notes follow in the thread. Orders received.`;
}

export function makeupSuccessEphemeral(): string {
  return `Filed. Thread has the rest. Beautiful teamwork when you lot actually read it.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} wouldn't cooperate: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (e.g. 50 or -25).`;
}

export function adjustParseUserFail(): string {
  return `That user token won't parse. Use a member mention, a raw member id (U…), or their Slack @handle.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The delta must be a whole number. What I got doesn't quite qualify: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `Adjusted. Canvas matches. Let's not drag this out. Time is limited.`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} refused to play along: ${error}`;
}

export function adjustEloForbidden(): string {
  return `Above your rank. Manual ELO is for whoever holds the badge.`;
}

export function leaderboardFailed(error: string): string {
  return `Roster failed: ${error}. Fall back clean. We'll try again.`;
}

/** Appended when Block Kit post fails but pagination was intended (plain-text fallback has no buttons). */
export function slackLeaderboardPagingInteractivityHint(): string {
  return "The Prev/Next buttons are missing! Someone with the keys needs to enable Interactivity in the Slack app settings.";
}

export function snipesFailed(error: string): string {
  return `Log jammed: ${error}`;
}

export function headtoheadFailed(error: string): string {
  return `Head-to-head's locked up for the moment: ${error}`;
}

export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — e.g. \`${slashCommand} @them 7d 50\`. Duration: \`30m\`, \`2h\`, \`7d\`, \`1w\`. Bet is ELO points.`;
}

export function snipeDuelDurationInvalid(): string {
  return `That duration doesn't parse. Use something like \`30m\`, \`4h\`, \`7d\`, or \`1w\` (between 1 minute and 90 days).`;
}

export function snipeDuelBetInvalid(): string {
  return `The bet must be a positive whole number of ELO points. Within reason.`;
}

export function snipeDuelSelf(): string {
  return `You can't duel yourself. Pick someone else on the field.`;
}

export function snipeDuelTargetBot(): string {
  return `That one's a bot. Duels are for operators with a pulse.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `Challenge posted. They can accept or decline in the thread. You can \`cancelduel\` there if you change your mind.`;
}

export function snipeDuelFailed(error: string): string {
  return `The duel paperwork stalled: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `This answer isn't yours to give. Only the challenged party may accept or decline here.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted. The clock is running — ${endsSummary}. Snipes between you two count toward the duel.`;
}

export function duelDeclinedPublic(): string {
  return `Declined. No stake, no score. Consider the challenge withdrawn.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `Withdrawn. The challenger called it off before anyone accepted.`;
}

/** Non-initiator typed cancelduel (includes challenged party—use declineduel). */
export function duelCancelNotChallenger(): string {
  return `Only the challenger may withdraw. If you were challenged, use \`declineduel\` instead.`;
}

export function leaderboardEmptyFallback(): string {
  return "_Quiet shift. Nobody on the board. Give it time._";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't ring true. Developer Mode on, right-click my confirmation message, Copy ID. Then we talk.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `I don't see anyone in the crosshairs. Add @mentions in the sniped field. @alice @bob, and so on.`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the photo and a mention, but only you were tagged. ` +
    `Kindly mention everyone who was *sniped* in the same message. The shooter is whoever sent it, naturally.`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something fouled the shot: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Automata don't sit on the board. I've no quarry there. Mention the people you're sniping, not bots. Me included.`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `That paperwork lists a bot in the line-up somewhere. The ledger is for operators with a pulse. Humans only, if you'd be so kind.`;
}

export function adjustTargetIsBot(): string {
  return `That one's a bot. No rating row for automatons. Pick an operator with a pulse.`;
}

export function discordModeratorOnlyCommand(): string {
  return `That switch is locked to moderators. If you're holding the server keys, try again.`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Understood. This server's snipe lane is now ${channelRef}. I'll keep score there.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `The first time each mark is *sniped* today, that exchange scores *double ELO* (gain and loss both scaled). ` +
    `If a mark *snipes* someone else, the books use the usual numbers.\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `The first time each mark is **sniped** today, that exchange scores **double ELO** (gain and loss both scaled). ` +
    `If a mark **snipes** someone else, the books use the usual numbers.\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nThere aren't enough human marks on the board yet. No list today. We'll try again when the field fills out.`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nThere aren't enough human marks on the board yet. No list today. We'll try again when the field fills out.`;
}

/** Snipe confirmation: section heading when daily bounty (2× ELO) applied to one or more pairs. */
export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Daily bounty. 2× ELO on this exchange:"
    : "Daily bounty. 2× ELO on these exchanges:";
}

/** Discord snipe confirmation (markdown); same semantics as the Slack/plain block. */
export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Daily bounty.** **2× ELO** on this exchange:"
    : "**Daily bounty.** **2× ELO** on these exchanges:";
}

/** Appended to each bounty pair line: names the snipe that seized the mark. */
export function snipeConfirmationBountyExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _This snipe claimed today's daily bounty on this mark (2× ELO)._";
  }
  return " — *This snipe claimed today's daily bounty on this mark (2× ELO).*";
}

/** Snipe confirmation: section when a pair was skipped because of snipe cooldown (no ELO). */
export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Too soon. No ELO for this exchange (snipe cooldown):"
    : "Too soon. No ELO for these exchanges (snipe cooldown):";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Too soon.** No ELO for this exchange (snipe cooldown):"
    : "**Too soon.** No ELO for these exchanges (snipe cooldown):";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _Someone here was in a scoring snipe too recently._";
  }
  return " — *Someone here was in a scoring snipe too recently.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "Daily bounty is switched off in this deployment. Nothing to list, I'm afraid.";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_I don't have today's marks on file yet. They land after the midnight roll. Or shortly after the bot catches up, if it was asleep._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*I don't have today's marks on file yet. They land after the midnight roll. Or shortly after the bot catches up, if it was asleep.*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_The board didn't yield enough human marks for a list when the ledger was drawn. Nothing to chase today._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*The board didn't yield enough human marks for a list when the ledger was drawn. Nothing to chase today.*`
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
      `_First snipe landing on a mark today scores 2× ELO for that exchange._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*First snipe landing on a mark today scores 2× ELO for that exchange.*`
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
      : "_2× still open. First to snipe them wins it._";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*claimed today* by *${claimedByDisplayName}*`
      : "*claimed today*"
    : "*2× still open. First to snipe them wins it.*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who snipe others use normal ELO. Only being sniped as a mark can trigger 2×._";
  }
  return "*Marks who snipe others use normal ELO. Only being sniped as a mark can trigger 2×.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Usage: \`${slashPath}\` @user1 @user2 … up to the day's mark count (see BOUNTY_TOP_N). Same permission as adjustelo.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Daily bounty is off in this deployment. Nothing to set._";
  }
  return "*Daily bounty is off in this deployment. Nothing to set.*";
}

export function setBountyNoMentions(): string {
  return "Mention at least one human mark (e.g. @player). Bots won't do.";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `Only the first ${maxMarks} mark(s) are kept (BOUNTY_TOP_N).`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Manual list for today. Midnight auto-roll won't replace it until the calendar turns._";
  }
  return "_Manual list for today. Midnight auto-roll won't replace it until the calendar turns._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `${context} failed: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "Posted today's bounty marks to the channel. The midnight auto-list won't replace them until the calendar turns. Roger.";
}

export function adjustBountyUsage(slashPath: string): string {
  return (
    `Usage: \`${slashPath}\` \`unclaim\` <@mark> — reopen 2× on one mark · ` +
    `\`${slashPath}\` \`clear\` — reopen 2× on every mark today · ` +
    `\`${slashPath}\` \`claim\` <@sniper> <@mark> — record first-snipe manually · ` +
    `\`${slashPath}\` \`add\` <@mark> … — append marks (deduped, capped at BOUNTY_TOP_N) · ` +
    `\`${slashPath}\` \`remove\` <@mark> … — drop marks from today's list (and their first-snipe claims). Same access as adjustelo.`
  );
}

export function adjustBountyUnknownSubcommand(): string {
  return "Start with `unclaim`, `clear`, `claim`, `add`, or `remove`. See `/help` for the full syntax.";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` needs at least one human @mark to append. Bots won't do.";
}

export function adjustBountyNoNewMarks(): string {
  return "Everyone you mentioned is already on today's bounty list. Nothing new to append.";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` needs at least one human @mark to strike from the list. Bots won't do.";
}

export function adjustBountyRemoveNoListToday(): string {
  return "There's no bounty mark list on file for today (or it's empty). Nothing to remove yet.";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "None of the people you mentioned are on today's bounty list. Double-check the marks.";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Every mark was struck from today's manual list. Use setbounty or \`add\` when you're ready for new quarry._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Every mark was struck from today's manual list. Use setbounty or \`add\` when you're ready for new quarry.*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` needs exactly one mark mention. Who should get their 2× slot reopened?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `No first-snipe claim on file today for ${markLabel}. Nothing to remove.`;
}

export function adjustBountyClearNone(): string {
  return "No first-snipe claims were on file for today. Every mark's 2× was already open.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` needs two mentions: the sniper (credit) first, then the bounty mark.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} isn't on today's bounty mark list. Set marks with setbounty first, or pick a listed mark.`;
}

export function adjustBountyClaimSelf(): string {
  return "Sniper and mark must be different people.";
}

export function adjustBountyPublicUnclaim(platform: "slack" | "discord", params: { dateLabel: string; markName: string }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Removed today's first-snipe claim on *${params.markName}*. That mark's 2× slot is open again on the next qualifying snipe.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Removed today's first-snipe claim on **${params.markName}**. That mark's 2× slot is open again.`
  );
}

export function adjustBountyPublicClear(platform: "slack" | "discord", params: { dateLabel: string; count: number }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Cleared *${params.count}* first-snipe claim(s). Every listed mark can earn 2× again on first snipe today.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Cleared **${params.count}** first-snipe claim(s). Every listed mark can earn 2× again on first snipe today.`
  );
}

export function adjustBountyPublicClaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; sniperName: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Recorded a manual first snipe: *${params.sniperName}* → *${params.markName}* (2× on that mark counts as claimed for today).`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Recorded a manual first snipe: **${params.sniperName}** → **${params.markName}** (2× on that mark counts as claimed for today).`
  );
}

export function adjustBountySuccessEphemeral(): string {
  return "Posted the bounty ledger change to the channel. On it.";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `${context} didn't take: ${error}`;
}

export function graphViewerNotConfigured(): string {
  return `The graph viewer isn't wired yet. Set GRAPH_PUBLIC_BASE_URL on the host to your Railway URL (no trailing slash), if you please.`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here's your one-time code for the snipe graph: **${params.code}**\n` +
    `Enter it on the site within **${params.redeemSeconds} seconds** (you'll get a longer session once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Slack mrkdwn (slash / ephemeral); avoids Discord-style **bold**. */
export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here's your one-time code for the snipe graph: *${params.code}*\n` +
    `Enter it on the site within *${params.redeemSeconds} seconds* (you'll get a longer session once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Discord slash command descriptions (short, her register). */
export const discordSlashDescriptions = {
  help: "Briefing: commands, rules, snipe lane. Roger?",
  leaderboard: "Who tops the board. There's always someone better.",
  show_leaderboard: "Same as /leaderboard. Post the ELO standings right here.",
  removesnipe: "Strike a snipe from the record (use the bot confirmation message ID).",
  makeupsnipe: "Log a snipe the camera missed. Paperwork for the diligent.",
  adjustelo: "Adjust someone's rating by hand. Sparingly, if you please.",
  setbounty: "Set today's bounty marks (@mentions). Same access as adjustelo.",
  adjustbounty: "Edit bounty ledger, append marks, or remove marks from today's list (moderators).",
  setsnipechannel: "Set this server's snipe channel to the current channel (moderators).",
  snipes: "Last five as shooter, last five times sniped. Optional user; default you.",
  headtohead: "Pairwise snipe counts for everyone still on the books.",
  snipeduel: "Challenge someone to a timed snipe duel with an ELO stake.",
  bounty: "Today's bounty marks and whether each 2× reward is still open.",
  snipegraph: "Get a 1-minute code to open the live snipe graph for this server in the browser.",
} as const;
