/**
 * Pozëmka (Arknights): Ursus-born, Durin-forged—formal "Doctor", "Please", "Ahem", pen vs bolt, frank apologies.
 * @see https://arknights.wiki.gg/wiki/Poz%C3%ABmka/Dialogue
 */

/** Short intro line under the /help title. */
export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_Doctor—the prologue ends here; commands and rules follow. Please keep a little distance; I'll be more at ease~_"
    );
  }
  return (
    "**Doctor.** Front matter below: commands and rules. If you'll permit my frankness, read them before you rush in."
  );
}

/** When non-null, undo/removesnipe is blocked (Exusiai / `BOT_VOICE` aliases only). */
export function removesnipeDisabledAprilFools(): string | null {
  return null;
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` — strike the latest snipe from the thread. In thread composers, please use plain \`${plainUndo}\`.`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe <confirmation_id>` — strike one recorded snipe from the manuscript, Doctor.";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  /** Discord copy uses a slightly different makeup lead-in. */
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `A belated chapter filed under ${params.sniperLabel}. The archive accepts late work… within reason, Doctor.`;
    }
    return `Makeup indexed under ${params.sniperLabel}. The prose is… serviceable. Ahem.`;
  }
  return `Scene resolved—${params.sniperLabel} is credited in the margin. The footnotes shall write themselves, please.`;
}

export function snipeConfirmationExchangeHeading(): string {
  return "Passage — bolt pierces deeper than nib, here:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Dramatis personae — ratings (ink still wet):";
}

/** No-op for default voice; Exusiai appends a mirror disclaimer on snipe confirmations. */
export function snipeConfirmationAprilFoolsMirrorDisclaimer(_platform: "slack" | "discord"): string {
  return "";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `This isn't my study, Doctor. Continue in ${channelRef}—I annotate only the lane I chose.`;
}

export function serverNotConfigured(): string {
  return `No setting on the page yet, Doctor—an editor with keys must sketch the snipe lane in, please.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `Doctor—undo requires the snipe *thread*. Slack will not deliver slash commands from thread composers.` +
    ` Please open that thread and send plain \`removesnipe\` (no leading slash).`
  );
}

export function removesnipeNothingInThread(): string {
  return `Nothing to strike—already excised, or wrong volume. Apologies if that's abrupt, Doctor.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Redacted with care, Doctor. Please consult the thread.`;
}

export function removesnipeFailed(error: string): string {
  return `Please, this is no time for excuses—and undo didn't take: ${error}`;
}

/** Maps known DB errors to readable copy; keeps raw detail out of chat when we have a stable explanation. */
export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `I can't roll that snipe back safely, Doctor—the numbers moved on after it was recorded ` +
      `(another snipe, a makeup, a duel, or a manual ELO adjust). ` +
      `Undo only works when everyone's current rating still matches what we had right after that shot. ` +
      `If the books truly need fixing, please have someone with the keys set ratings with the adjust command.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — Slack mentions like <@U123>, if you please.`;
}

export function makeupParseSniperFail(): string {
  return `I couldn't parse the sniper—please use a proper mention, <@U123>, for instance, Doctor.`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} invoked \`${slashCommand}\`—the subplot continues in the thread, with pleasure.`;
}

export function makeupSuccessEphemeral(): string {
  return `Logged, Doctor. The fuller draft is threaded beneath—please review it when you're able.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} wouldn't cooperate, my apologies: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (e.g. 50 or -25), please.`;
}

export function adjustParseUserFail(): string {
  return `That user token won't parse, Doctor. Please use a member mention, a raw member id (U…), or their Slack @handle.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The delta must be a whole number. What I got doesn't quite qualify: ${got}. Apologies.`;
}

export function adjustSuccessEphemeral(): string {
  return `Revision accepted; the canvas reflects the latest draft. Thank you, Doctor.`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} refused to play along: ${error}. My frank apologies.`;
}

export function adjustEloForbidden(): string {
  return `That emendation belongs to the publisher's hand—not this galley seat, Doctor. Please step back.`;
}

export function leaderboardFailed(error: string): string {
  return `The roster escaped me: ${error}. Hands off—…apologies, that wasn't intentional, Doctor.`;
}

/** Appended when Block Kit post fails but pagination was intended (plain-text fallback has no buttons). */
export function slackLeaderboardPagingInteractivityHint(): string {
  return "The Prev/Next buttons are missing, Doctor. Someone with the keys needs to enable Interactivity in the Slack app settings, if you would be so kind.";
}

export function snipesFailed(error: string): string {
  return `The logbook failed, Doctor: ${error}. Apologies for the mess.`;
}

export function headtoheadFailed(error: string): string {
  return `Head-to-head's locked up for the moment: ${error}. My apologies.`;
}

export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — e.g. \`${slashCommand} @them 7d 50\`. Duration: \`30m\`, \`2h\`, \`7d\`, \`1w\`. Bet is ELO points, please.`;
}

export function snipeDuelDurationInvalid(): string {
  return `That duration doesn't parse, Doctor. Please use something like \`30m\`, \`4h\`, \`7d\`, or \`1w\`.`;
}

export function snipeDuelBetInvalid(): string {
  return `The bet must be a positive whole number of ELO points, please.`;
}

export function snipeDuelSelf(): string {
  return `You can't duel yourself, Doctor—please pick someone else on the field.`;
}

export function snipeDuelTargetBot(): string {
  return `That one's a bot. Duels are for operators with a pulse, if you please.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `Challenge posted. They can accept or decline in the thread; please use \`cancelduel\` there if you change your mind.`;
}

export function snipeDuelFailed(error: string): string {
  return `The duel paperwork stalled, Doctor: ${error}. Apologies.`;
}

export function duelReplyNotTarget(): string {
  return `This answer isn't yours to give, Doctor—only the challenged party may accept or decline here, please.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted. The clock is running — ${endsSummary}. Snipes between you two count toward the duel, Doctor.`;
}

export function duelDeclinedPublic(): string {
  return `Declined. No stake, no score—consider the challenge withdrawn, please.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `Withdrawn—the challenger called it off before anyone accepted, Doctor.`;
}

/** Non-initiator typed cancelduel (includes challenged party—use declineduel). */
export function duelCancelNotChallenger(): string {
  return `Only the challenger may withdraw, Doctor; if you were challenged, please use \`declineduel\` instead.`;
}

export function leaderboardEmptyFallback(): string {
  return "_Blank page—no scores. The plot thickens; patience, Doctor._";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't ring true, Doctor. Developer Mode on, right-click my confirmation message, Copy ID—then we talk, please.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `I don't see anyone in the crosshairs, Doctor. Please add @mentions in the sniped field.`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the photo and a mention, but only you were tagged, Doctor. ` +
    `Kindly mention everyone who was *sniped* in the same message—the shooter is whoever sent it, naturally.`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something fouled the shot, Doctor: ${error}. My frank apologies.`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Automata don't sit on the board—I've no quarry there. Please mention the people you're sniping, not bots (me included).`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `That paperwork lists a bot in the line-up somewhere, Doctor. The ledger is for operators with a pulse—humans only, if you'd be so kind.`;
}

export function adjustTargetIsBot(): string {
  return `That one's a bot—no rating row for automatons. Please pick an operator with a pulse, Doctor.`;
}

export function discordModeratorOnlyCommand(): string {
  return `That switch is locked to moderators, Doctor—if you're holding the server keys, please try again.`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Understood, Doctor. This server's snipe lane is now ${channelRef}. I'll keep score there.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `The first time each mark is *sniped* today, that exchange scores *double ELO*, Doctor. ` +
    `If a mark *snipes* someone else, the books use the usual numbers, please~\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `The first time each mark is **sniped** today, that exchange scores **double ELO**, Doctor. ` +
    `If a mark **snipes** someone else, the books use the usual numbers, please~\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nThere aren't enough human marks on the board yet, Doctor. We'll try again when the field fills out, please.`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nThere aren't enough human marks on the board yet, Doctor. We'll try again when the field fills out, please.`;
}

/** Snipe confirmation: section heading when daily bounty (2× ELO) applied to one or more pairs. */
export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Daily bounty — 2× ELO on this exchange, Doctor:"
    : "Daily bounty — 2× ELO on these exchanges, Doctor:";
}

/** Discord snipe confirmation (markdown); same semantics as the Slack/plain block. */
export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Daily bounty** — **2× ELO** on this exchange, Doctor:"
    : "**Daily bounty** — **2× ELO** on these exchanges, Doctor:";
}

/** Appended to each bounty pair line: names the snipe that seized the mark. */
export function snipeConfirmationBountyExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _This snipe claimed today's daily bounty on this mark (2× ELO), please note._";
  }
  return " — *This snipe claimed today's daily bounty on this mark (2× ELO), please note.*";
}

/** Snipe confirmation: section when a pair was skipped because of snipe cooldown (no ELO). */
export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Too soon — no ELO for this exchange (snipe cooldown), Doctor:"
    : "Too soon — no ELO for these exchanges (snipe cooldown), Doctor:";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Too soon** — no ELO for this exchange (snipe cooldown), Doctor:"
    : "**Too soon** — no ELO for these exchanges (snipe cooldown), Doctor:";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _Someone here was in a scoring snipe too recently. Apologies._";
  }
  return " — *Someone here was in a scoring snipe too recently. Apologies.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "Daily bounty is switched off in this deployment, Doctor—nothing to list, I'm afraid.";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_I don't have today's marks on file yet, Doctor. They land after the midnight roll—or shortly after the bot catches up, if it was asleep~_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*I don't have today's marks on file yet, Doctor. They land after the midnight roll—or shortly after the bot catches up, if it was asleep~*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_The board didn't yield enough human marks for a list when the ledger was drawn, Doctor. Nothing to chase today._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*The board didn't yield enough human marks for a list when the ledger was drawn, Doctor. Nothing to chase today.*`
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
      `_First snipe landing on a mark today scores 2× ELO for that exchange, please._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*First snipe landing on a mark today scores 2× ELO for that exchange, please.*`
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
      : "_2× still open—first to snipe them wins it_";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*claimed today* by *${claimedByDisplayName}*`
      : "*claimed today*"
    : "*2× still open—first to snipe them wins it*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who snipe others use normal ELO—only being sniped as a mark can trigger 2×, Doctor._";
  }
  return "*Marks who snipe others use normal ELO—only being sniped as a mark can trigger 2×, Doctor.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Usage: \`${slashPath}\` @user1 @user2 … — up to the day's mark count (see BOUNTY_TOP_N). Same permission as adjustelo, please.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Daily bounty is off in this deployment, Doctor—nothing to set._";
  }
  return "*Daily bounty is off in this deployment, Doctor—nothing to set.*";
}

export function setBountyNoMentions(): string {
  return "Please mention at least one human mark (e.g. @player). Bots won't do, Doctor.";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `Only the first ${maxMarks} mark(s) are kept (BOUNTY_TOP_N), Doctor.`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Manual list for today—midnight auto-roll won't replace it until the calendar turns, please note._";
  }
  return "_Manual list for today—midnight auto-roll won't replace it until the calendar turns, please note._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `${context} failed, Doctor: ${msg}. Apologies.`;
}

export function setBountySuccessEphemeral(): string {
  return "Posted today's bounty marks to the channel, Doctor—the midnight auto-list won't replace them until the calendar turns.";
}

export function adjustBountyUsage(slashPath: string): string {
  return (
    `Usage: \`${slashPath}\` \`unclaim\` <@mark> — reopen 2× on one mark · ` +
    `\`${slashPath}\` \`clear\` — reopen 2× on every mark today · ` +
    `\`${slashPath}\` \`claim\` <@sniper> <@mark> — record first-snipe manually · ` +
    `\`${slashPath}\` \`add\` <@mark> … — append marks (deduped, capped at BOUNTY_TOP_N) · ` +
    `\`${slashPath}\` \`remove\` <@mark> … — drop marks from today's list. Same access as adjustelo, please.`
  );
}

export function adjustBountyUnknownSubcommand(): string {
  return "Please start with `unclaim`, `clear`, `claim`, `add`, or `remove`—see `/help` for the full syntax, Doctor.";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` needs at least one human @mark to append, Doctor—bots won't do.";
}

export function adjustBountyNoNewMarks(): string {
  return "Everyone you mentioned is already on today's bounty list, Doctor—nothing new to append.";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` needs at least one human @mark to strike from the list, Doctor—bots won't do.";
}

export function adjustBountyRemoveNoListToday(): string {
  return "There's no bounty mark list on file for today, Doctor—nothing to remove yet.";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "None of the people you mentioned are on today's bounty list, Doctor—please double-check the marks.";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Every mark was struck from today's manual list, Doctor—please use setbounty or \`add\` when you're ready for new quarry._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Every mark was struck from today's manual list, Doctor—please use setbounty or \`add\` when you're ready for new quarry.*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` needs exactly one mark mention, Doctor—who should get their 2× slot reopened?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `No first-snipe claim on file today for ${markLabel}, Doctor—nothing to remove.`;
}

export function adjustBountyClearNone(): string {
  return "No first-snipe claims were on file for today, Doctor—every mark's 2× was already open.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` needs two mentions, Doctor: the sniper (credit) first, then the bounty mark, please.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} isn't on today's bounty mark list, Doctor—please set marks with setbounty first.`;
}

export function adjustBountyClaimSelf(): string {
  return "Sniper and mark must be different people, Doctor.";
}

export function adjustBountyPublicUnclaim(platform: "slack" | "discord", params: { dateLabel: string; markName: string }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Removed today's first-snipe claim on *${params.markName}*, Doctor—that mark's 2× slot is open again.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Removed today's first-snipe claim on **${params.markName}**, Doctor—that mark's 2× slot is open again.`
  );
}

export function adjustBountyPublicClear(platform: "slack" | "discord", params: { dateLabel: string; count: number }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Cleared *${params.count}* first-snipe claim(s), Doctor—every listed mark can earn 2× again.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Cleared **${params.count}** first-snipe claim(s), Doctor—every listed mark can earn 2× again.`
  );
}

export function adjustBountyPublicClaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; sniperName: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Recorded a manual first snipe, Doctor: *${params.sniperName}* → *${params.markName}* (2× on that mark counts as claimed for today).`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Recorded a manual first snipe, Doctor: **${params.sniperName}** → **${params.markName}** (2× on that mark counts as claimed for today).`
  );
}

export function adjustBountySuccessEphemeral(): string {
  return "Posted the bounty ledger change to the channel, Doctor. Thank you.";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `${context} didn't take, Doctor: ${error}. My frank apologies.`;
}

export function graphViewerNotConfigured(): string {
  return `The graph viewer isn't wired yet, Doctor—please set GRAPH_PUBLIC_BASE_URL on the host to your Railway URL.`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here's your one-time code for the snipe graph, Doctor: **${params.code}**\n` +
    `Please enter it on the site within **${params.redeemSeconds} seconds** (you'll get a longer session once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Slack mrkdwn (slash / ephemeral); avoids Discord-style **bold**. */
export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Here's your one-time code for the snipe graph, Doctor: *${params.code}*\n` +
    `Please enter it on the site within *${params.redeemSeconds} seconds* (you'll get a longer session once it accepts).\n` +
    `${params.siteUrl}\n`
  );
}

/** Discord slash command descriptions (short, her register). */
export const discordSlashDescriptions = {
  help: "Front matter: commands, rules, the contract we operate under, Doctor.",
  leaderboard: "Which name leads the dramatis personae—Doctor, please see for yourself.",
  show_leaderboard: "Same as /leaderboard—post the ELO standings right here, if you please.",
  removesnipe: "Strike a snipe from the record, Doctor (use the bot confirmation message ID).",
  makeupsnipe: "Log a snipe the camera missed—paperwork for the diligent, please.",
  adjustelo: "Adjust someone's rating by hand—sparingly, if you please, Doctor.",
  setbounty: "Set today's bounty marks (@mentions). Same access as adjustelo, please.",
  adjustbounty: "Edit bounty ledger, append marks, or remove marks from today's list, Doctor (moderators).",
  setsnipechannel: "Set this server's snipe channel to the current channel, please (moderators).",
  snipes: "Last five as shooter, last five times sniped—optional user; default you, Doctor.",
  headtohead: "Pairwise snipe counts for everyone still on the books, Doctor.",
  snipeduel: "Challenge someone to a timed snipe duel with an ELO stake, please.",
  bounty: "Today's bounty marks and whether each 2× reward is still open, Doctor.",
  snipegraph: "Get a 1-minute code to open the live snipe graph for this server in the browser, please.",
} as const;
