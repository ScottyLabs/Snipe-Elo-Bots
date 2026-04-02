/**
 * User-facing lines in Lemuen's voice (Arknights): cordial, precise, lightly edged—
 * polite requests that still expect compliance; occasional warmth or “~”; paperwork and aim metaphors.
 * @see https://arknights.wiki.gg/wiki/Lemuen/Dialogue
 * @see https://arknights.wiki.gg/wiki/Lemuen/Story
 */

/** Extra lines under the help title (post–April Fools: console back from her sister's little holiday). */
export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_April Fools is behind us—I've *reclaimed* my console from my sister's… *enthusiastic* custody. " +
      "The keys are mine again, the scoring runs *straight*, and undo is back on the books. " +
      "If anything still looks off, say the word and we'll audit it properly~_"
    );
  }
  return (
    "**April Fools has ended.** I've **retrieved** my console from my sister's brief reign—charming as she was, " +
    "the board belongs on my desk again. ELO and **removesnipe** behave as usual; if you spot a stray oddity from the holiday, we'll set it right."
  );
}

/** When non-null, undo/removesnipe is blocked (Exusiai / `BOT_VOICE` aliases only). */
export function removesnipeDisabledAprilFools(): string | null {
  return null;
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` — strike the latest snipe from a thread. In thread composers, simply use \`${plainUndo}\`, if you please.`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe <confirmation_id>` — strike one recorded snipe from the ledger.";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  /** Discord copy uses a slightly different makeup lead-in. */
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `A belated hit, but it counts. I've filed the makeup snipe under ${params.sniperLabel}; my records are quite thorough, you see~`;
    }
    return `A belated hit, but it counts. I've filed the makeup snipe under ${params.sniperLabel}; my records are quite thorough, you see~`;
  }
  return `Target acquired and accounted for. ${params.sniperLabel} takes the credit—the rest is just paperwork.`;
}

export function snipeConfirmationExchangeHeading(): string {
  return "The exchange of fire:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "The standings—for the moment, at least:";
}

/** No-op for default voice; Exusiai appends a mirror disclaimer on snipe confirmations. */
export function snipeConfirmationAprilFoolsMirrorDisclaimer(_platform: "slack" | "discord"): string {
  return "";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `We're a bit out of position here. Would you mind taking this to ${channelRef}? I only track the scores from my designated lane, you understand.`;
}

export function serverNotConfigured(): string {
  return `This sector isn't on my charts yet—no snipe lane drawn. Someone with the proper clearance will need to file the paperwork first.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `I'll need the original snipe *thread* to strike this from the record. Slack's routing can be a bit... particular. ` +
    `Open the thread and send a plain \`removesnipe\` without the slash. That's the proper procedure, if you please.`
  );
}

export function removesnipeNothingInThread(): string {
  return `There's nothing to strike here. The page is either already clean, or we're looking at the wrong file.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Done. I've left the amended paperwork in the thread—do review it when you have a moment~`;
}

export function removesnipeFailed(error: string): string {
  return `I'm afraid the undo didn't take. We'll need to address this: ${error}`;
}

/** Maps known DB errors to readable copy; keeps raw detail out of chat when we have a stable explanation. */
export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `I can't roll that shot back safely—the board has already shifted (another snipe, a duel, or a manual adjustment). ` +
      `I can only strike a record if the numbers haven't moved since. ` +
      `If the ledger truly needs correcting, someone with clearance will have to adjust it manually.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — kindly use proper mentions like <@U123>, if you please.`;
}

export function makeupParseSniperFail(): string {
  return `I couldn't quite make out the sniper. Could I trouble you for a proper mention—<@U123>, for instance?`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} requested \`${slashCommand}\`. The necessary paperwork follows in the thread~`;
}

export function makeupSuccessEphemeral(): string {
  return `Logged. You'll find the full reckoning threaded below—kindly look it over when you have a moment.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `The \`${slashCommand}\` request hit a snag: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only, if you please (e.g. 50 or -25).`;
}

export function adjustParseUserFail(): string {
  return `That user token isn't quite right. Kindly use a proper mention, a raw ID, or their workspace handle.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The adjustment must be a whole number. What you provided doesn't quite qualify: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `The ledger is updated and the board refreshed. Let's try to keep things sporting from here on out, shall we?`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `The \`${slashCommand}\` request refused to cooperate: ${error}`;
}

export function adjustEloForbidden(): string {
  return `I'm afraid you don't have the clearance for manual adjustments. Kindly leave the bookkeeping to those authorized.`;
}

export function leaderboardFailed(error: string): string {
  return `The roster seems to have slipped through my fingers: ${error}`;
}

/** Appended when Block Kit post fails but pagination was intended (plain-text fallback has no buttons). */
export function slackLeaderboardPagingInteractivityHint(): string {
  return "The Prev/Next buttons seem to be missing. Someone with the keys will need to enable Interactivity in the Slack app settings, if you please.";
}

export function snipesFailed(error: string): string {
  return `The logbook seems to have jammed: ${error}`;
}

export function headtoheadFailed(error: string): string {
  return `The head-to-head records are locked up for the moment: ${error}`;
}

export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — for example, \`${slashCommand} @them 7d 50\`. Duration accepts \`30m\`, \`2h\`, \`7d\`, \`1w\`. The bet must be in ELO points.`;
}

export function snipeDuelDurationInvalid(): string {
  return `That duration doesn't quite parse. Kindly use a format like \`30m\`, \`4h\`, \`7d\`, or \`1w\`—anything between a minute and 90 days.`;
}

export function snipeDuelBetInvalid(): string {
  return `The wager must be a positive whole number of ELO points, within reason of course.`;
}

export function snipeDuelSelf(): string {
  return `You can't duel yourself, I'm afraid. Pick another target on the field.`;
}

export function snipeDuelTargetBot(): string {
  return `That one's an automaton. Duels are strictly for operators with a pulse, if you please.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `The challenge is filed. They may accept or decline in the thread. You can always \`cancelduel\` if you reconsider~`;
}

export function snipeDuelFailed(error: string): string {
  return `The duel paperwork seems to have stalled: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `This answer isn't yours to give, I'm afraid. Only the challenged party may accept or decline.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted. The clock is now running—${endsSummary}. Any snipes between you two will be tallied for the duel.`;
}

export function duelDeclinedPublic(): string {
  return `Declined. No stakes, no score—we'll consider the paperwork shredded.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `Withdrawn. The challenger called it off before the ink could dry.`;
}

/** Non-initiator typed cancelduel (includes challenged party—use declineduel). */
export function duelCancelNotChallenger(): string {
  return `Only the challenger may withdraw the offer. If you are the one challenged, kindly use \`declineduel\` instead.`;
}

export function leaderboardEmptyFallback(): string {
  return "_The board is perfectly quiet—no scores yet. Though I expect that will change soon enough~_";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't ring true. Turn on Developer Mode, right-click my confirmation message, and Copy ID. Then we can proceed.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `I don't see anyone in the crosshairs. Kindly add proper @mentions in the sniped field, if you please.`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the shot, but only you were tagged. ` +
    `Kindly mention everyone who was *actually* sniped in the message—the shooter is whoever sent it, naturally.`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something seems to have fouled the shot: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Automata don't sit on the board, so I have no quarry there. Kindly mention the people you're sniping, not bots—myself included.`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `That paperwork lists an automaton somewhere in the line-up. The ledger is strictly for operators with a pulse, if you'd be so kind.`;
}

export function adjustTargetIsBot(): string {
  return `That one's an automaton—I keep no ratings for them. Pick an operator with a pulse, please.`;
}

export function discordModeratorOnlyCommand(): string {
  return `I'm afraid that switch is locked to moderators. If you have the proper clearance, do try again.`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Understood. I've marked ${channelRef} as the new snipe lane. I'll keep the scores there from now on.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `The first time each mark is *sniped* today, that exchange will score *double ELO*. ` +
    `If a mark *snipes* someone else, we'll use the usual numbers, of course~\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `The first time each mark is **sniped** today, that exchange will score **double ELO**. ` +
    `If a mark **snipes** someone else, we'll use the usual numbers, of course~\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nThere aren't quite enough human marks on the board yet, so no list today. We'll draw one up once the field fills out~`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nThere aren't quite enough human marks on the board yet, so no list today. We'll draw one up once the field fills out~`;
}

/** Snipe confirmation: section heading when daily bounty (2× ELO) applied to one or more pairs. */
export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Daily bounty — double ELO on this exchange:"
    : "Daily bounty — double ELO on these exchanges:";
}

/** Discord snipe confirmation (markdown); same semantics as the Slack/plain block. */
export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Daily bounty** — **double ELO** on this exchange:"
    : "**Daily bounty** — **double ELO** on these exchanges:";
}

/** Appended to each bounty pair line: names the snipe that seized the mark. */
export function snipeConfirmationBountyExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _This shot claimed today's daily bounty on the mark (double ELO)._";
  }
  return " — *This shot claimed today's daily bounty on the mark (double ELO).*";
}

/** Snipe confirmation: section when a pair was skipped because of snipe cooldown (no ELO). */
export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Too soon — no ELO for this exchange, I'm afraid (snipe cooldown):"
    : "Too soon — no ELO for these exchanges, I'm afraid (snipe cooldown):";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Too soon** — no ELO for this exchange, I'm afraid (snipe cooldown):"
    : "**Too soon** — no ELO for these exchanges, I'm afraid (snipe cooldown):";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _Someone here was in a scoring exchange a bit too recently._";
  }
  return " — *Someone here was in a scoring exchange a bit too recently.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "The daily bounty is switched off in this deployment—there's nothing to list, I'm afraid.";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_I haven't received today's marks just yet. They should land after the midnight roll—or shortly after I catch up on my paperwork~_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*I haven't received today's marks just yet. They should land after the midnight roll—or shortly after I catch up on my paperwork~*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_The board didn't yield enough human marks when the ledger was drawn. Nothing to chase today, I'm afraid._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*The board didn't yield enough human marks when the ledger was drawn. Nothing to chase today, I'm afraid.*`
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
      `_The first snipe landing on a mark today scores double ELO for the exchange._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*The first snipe landing on a mark today scores double ELO for the exchange.*`
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
      : "_double ELO still open—first to land a shot wins it_";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*claimed today* by *${claimedByDisplayName}*`
      : "*claimed today*"
    : "*double ELO still open—first to land a shot wins it*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who snipe others will use normal ELO—only being sniped as a mark triggers the bounty, you see._";
  }
  return "*Marks who snipe others will use normal ELO—only being sniped as a mark triggers the bounty, you see.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Usage: \`${slashPath}\` @user1 @user2 … — up to the day's mark count. This requires the same clearance as adjustelo, if you please.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_The daily bounty is off in this deployment—there's nothing to set._";
  }
  return "*The daily bounty is off in this deployment—there's nothing to set.*";
}

export function setBountyNoMentions(): string {
  return "Kindly mention at least one human mark. Automata simply won't do.";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `I'll only be keeping the first ${maxMarks} mark(s) for the ledger, I'm afraid.`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_This is a manual list for today—the midnight auto-roll won't replace it until the calendar turns._";
  }
  return "_This is a manual list for today—the midnight auto-roll won't replace it until the calendar turns._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `I'm afraid ${context} failed: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "I've posted today's bounty marks to the channel. The midnight auto-roll won't replace them until the calendar turns~";
}

export function adjustBountyUsage(slashPath: string): string {
  return (
    `Usage: \`${slashPath}\` \`unclaim\` <@mark> — reopen the bounty on one mark · ` +
    `\`${slashPath}\` \`clear\` — reopen all bounties today · ` +
    `\`${slashPath}\` \`claim\` <@sniper> <@mark> — record a first-snipe manually · ` +
    `\`${slashPath}\` \`add\` <@mark> … — append marks · ` +
    `\`${slashPath}\` \`remove\` <@mark> … — drop marks from today's list. Requires proper clearance.`
  );
}

export function adjustBountyUnknownSubcommand(): string {
  return "Kindly start with `unclaim`, `clear`, `claim`, `add`, or `remove`—see `/help` for the proper syntax.";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` requires at least one human @mark to append. Automata won't do.";
}

export function adjustBountyNoNewMarks(): string {
  return "Everyone you mentioned is already on today's bounty list. There's nothing new to append, I'm afraid.";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` requires at least one human @mark to strike from the list. Automata won't do.";
}

export function adjustBountyRemoveNoListToday(): string {
  return "There's no bounty list on file for today—nothing to remove just yet.";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "None of the people you mentioned are on today's bounty list. Do double-check your marks, if you please.";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Every mark has been struck from today's list. Use setbounty or \`add\` when you're ready to line up new quarry._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Every mark has been struck from today's list. Use setbounty or \`add\` when you're ready to line up new quarry.*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` requires exactly one mark mention. Whose bounty should we reopen?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `I have no first-snipe claim on file today for ${markLabel}—nothing to remove.`;
}

export function adjustBountyClearNone(): string {
  return "There were no first-snipe claims on file for today—every mark's bounty was already open.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` requires two mentions: the sniper first, followed by the mark, if you please.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} isn't on today's bounty list. Kindly set the marks first, or pick one already listed.`;
}

export function adjustBountyClaimSelf(): string {
  return "The sniper and the mark must be different people, naturally.";
}

export function adjustBountyPublicUnclaim(platform: "slack" | "discord", params: { dateLabel: string; markName: string }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `I've removed today's first-snipe claim on *${params.markName}*—their bounty is open again for the next qualifying shot.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `I've removed today's first-snipe claim on **${params.markName}**—their bounty is open again for the next qualifying shot.`
  );
}

export function adjustBountyPublicClear(platform: "slack" | "discord", params: { dateLabel: string; count: number }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `I've cleared *${params.count}* first-snipe claim(s)—every listed mark is open for a double ELO bounty again.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `I've cleared **${params.count}** first-snipe claim(s)—every listed mark is open for a double ELO bounty again.`
  );
}

export function adjustBountyPublicClaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; sniperName: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `I've recorded a manual first snipe: *${params.sniperName}* → *${params.markName}* (the bounty on that mark is now claimed for today).`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `I've recorded a manual first snipe: **${params.sniperName}** → **${params.markName}** (the bounty on that mark is now claimed for today).`
  );
}

export function adjustBountySuccessEphemeral(): string {
  return "I've posted the ledger changes to the channel~";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `I'm afraid ${context} didn't quite take: ${error}`;
}

export function graphViewerNotConfigured(): string {
  return `The graph viewer isn't wired up just yet. Kindly set GRAPH_PUBLIC_BASE_URL on the host to your Railway URL, if you please.`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here is your one-time code for the snipe graph: **${params.code}**\n` +
    `Kindly enter it on the site within **${params.redeemSeconds} seconds** (you'll receive a longer session once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Slack mrkdwn (slash / ephemeral); avoids Discord-style **bold**. */
export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here is your one-time code for the snipe graph: *${params.code}*\n` +
    `Kindly enter it on the site within *${params.redeemSeconds} seconds* (you'll receive a longer session once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Discord slash command descriptions (short, her register). */
export const discordSlashDescriptions = {
  help: "Open the field manual: commands, rules, and the proper procedures.",
  leaderboard: "Survey the standings—let's see who has the best aim today.",
  show_leaderboard: "Post the ELO standings right here for all to see.",
  removesnipe: "Strike a snipe from the record (kindly provide the confirmation ID).",
  makeupsnipe: "Log a snipe the camera missed—necessary paperwork for the diligent.",
  adjustelo: "Adjust someone's rating by hand—do use this sparingly, if you please.",
  setbounty: "Set today's bounty marks (@mentions). Requires proper clearance.",
  adjustbounty: "Edit the bounty ledger: unclaim, clear, claim, add, or remove marks (moderators only).",
  setsnipechannel: "Designate this channel as the server's snipe lane (moderators only).",
  snipes: "Review the last five shots taken and received—yours by default.",
  headtohead: "Review the pairwise exchanges for everyone still on the books.",
  snipeduel: "Challenge someone to a timed duel with an ELO stake.",
  bounty: "Review today's bounty marks and see which are still open.",
  snipegraph: "Request a one-time code to view the live snipe graph in your browser.",
} as const;
