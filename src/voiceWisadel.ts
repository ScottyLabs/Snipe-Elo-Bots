/**
 * Wiš'adel / "W" (Arknights): gleeful chaos, darling, bombs and punchlines—sharp teeth behind the smile.
 * @see https://arknights.wiki.gg/wiki/Wi%C5%A1%27adel/Dialogue
 * @see https://arknights.wiki.gg/wiki/W/Story
 * @see https://arknights.wiki.gg/wiki/Wi%C5%A1%27adel/File
 */

/** Short intro line under the /help title. */
export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_Hey *Darling*—field manual's below. Try not to blow the UX; I'll cackle either way~_"
    );
  }
  return (
    "**Briefing, Darling.** Rules and commands live down here—handle with care (or don't; I'm entertained either way)."
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
      return `Makeup's in the file under ${params.sniperLabel}—paperwork's *chef's kiss*, promise~`;
    }
    return `Makeup snipe? Logged under ${params.sniperLabel}. Don't make me forge it twice~`;
  }
  return `Tagged. ${params.sniperLabel} keeps the glory; I keep the receipts~`;
}

export function snipeConfirmationExchangeHeading(): string {
  return "Detonation tally:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Who's still standing:";
}

/** No-op for default voice; Exusiai appends a mirror disclaimer on snipe confirmations. */
export function snipeConfirmationAprilFoolsMirrorDisclaimer(_platform: "slack" | "discord"): string {
  return "";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `Wrong zip code, Darling—this ain't my nest. Run it in ${channelRef} or I'm not touching the fuse.`;
}

export function serverNotConfigured(): string {
  return `No lane on my map—someone with admin keys needs to wire the fun zone first.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `I need the snipe *thread* for this undo. Slack won't deliver custom slash commands from thread composers—` +
    `open that thread and send a plain message: \`removesnipe\` (no leading slash). That's the reliable path, if you please.`
  );
}

export function removesnipeNothingInThread(): string {
  return `Zip to undo—wrong page or already pristine, pick your flavor~`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Undone! Story's in the thread—apple pie's optional~`;
}

export function removesnipeFailed(error: string): string {
  return `Please, this is no time for excuses—and undo didn't take: ${error}`;
}

/** Maps known DB errors to readable copy; keeps raw detail out of chat when we have a stable explanation. */
export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `I can't roll that snipe back safely—the numbers moved on after it was recorded ` +
      `(another snipe, a makeup, a duel, or a manual ELO adjust). ` +
      `Undo only works when everyone's current rating still matches what we had right after that shot. ` +
      `If the books truly need fixing, someone with the keys can set ratings with the adjust command.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — Slack mentions like <@U123>, if you please.`;
}

export function makeupParseSniperFail(): string {
  return `I couldn't make sense of the sniper. Could I trouble you for a proper mention—<@U123>, for instance?`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} pulled \`${slashCommand}\`—paper trail's in the thread, try to keep up~`;
}

export function makeupSuccessEphemeral(): string {
  return `Logged, Darling—full mess is threaded; bring popcorn~`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} wouldn't cooperate: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (e.g. 50 or -25).`;
}

export function adjustParseUserFail(): string {
  return `That user token won't parse. Use a member mention, a raw member id (U…), or their Slack @handle (workspace username).`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The delta must be a whole number. What I got doesn't quite qualify: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `Books and canvas: *boom*, updated. Try not to make me audit you~`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} refused to play along: ${error}`;
}

export function adjustEloForbidden(): string {
  return `That sweet little lever? Not for you, Darling—authorized hands only~`;
}

export function leaderboardFailed(error: string): string {
  return `The roster slipped through my fingers: ${error}`;
}

/** Appended when Block Kit post fails but pagination was intended (plain-text fallback has no buttons). */
export function slackLeaderboardPagingInteractivityHint(): string {
  return (
    `To get Prev/Next buttons: Slack app → Interactivity & Shortcuts → turn *Interactivity* on. ` +
    `With *Socket Mode*, no Request URL is needed—events and button clicks use the socket. ` +
    `With HTTP mode only, set the Request URL to your Bolt endpoint (e.g. https://…/slack/events). ` +
    `Reinstall the app after changing scopes or interactivity.`
  );
}

export function snipesFailed(error: string): string {
  return `The logbook jammed: ${error}`;
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
  return `The bet must be a positive whole number of ELO points (within reason).`;
}

export function snipeDuelSelf(): string {
  return `You can't duel yourself—pick someone else on the field.`;
}

export function snipeDuelTargetBot(): string {
  return `That one's a bot. Duels are for operators with a pulse.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `Challenge posted. They can accept or decline in the thread; you can \`cancelduel\` there if you change your mind.`;
}

export function snipeDuelFailed(error: string): string {
  return `The duel paperwork stalled: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `This answer isn't yours to give—only the challenged party may accept or decline here.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted. The clock is running — ${endsSummary}. Snipes between you two count toward the duel.`;
}

export function duelDeclinedPublic(): string {
  return `Declined. No stake, no score—consider the challenge withdrawn.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `Withdrawn—the challenger called it off before anyone accepted.`;
}

/** Non-initiator typed cancelduel (includes challenged party—use declineduel). */
export function duelCancelNotChallenger(): string {
  return `Only the challenger may withdraw; if you were challenged, use \`declineduel\` instead.`;
}

export function leaderboardEmptyFallback(): string {
  return "_Board's quiet—like before the surprise party. Give it a minute, Darling._";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't ring true. Developer Mode on, right-click my confirmation message, Copy ID—then we talk.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `I don't see anyone in the crosshairs. Add @mentions in the sniped field—@alice @bob, and so on.`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the photo and a mention, but only you were tagged. ` +
    `Kindly mention everyone who was *sniped* in the same message—the shooter is whoever sent it, naturally.`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something fouled the shot: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Automata don't sit on the board—I've no quarry there. Mention the people you're sniping, not bots (me included).`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `That paperwork lists a bot in the line-up somewhere. The ledger is for operators with a pulse—humans only, if you'd be so kind.`;
}

export function adjustTargetIsBot(): string {
  return `That one's a bot—no rating row for automatons. Pick an operator with a pulse.`;
}

export function discordModeratorOnlyCommand(): string {
  return `That switch is locked to moderators—if you're holding the server keys, try again.`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Understood. This server's snipe lane is now ${channelRef}. I'll keep score there.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `The first time each mark is *sniped* today, that exchange scores *double ELO* (gain and loss both scaled). ` +
    `If a mark *snipes* someone else, the books use the usual numbers~\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `The first time each mark is **sniped** today, that exchange scores **double ELO** (gain and loss both scaled). ` +
    `If a mark **snipes** someone else, the books use the usual numbers~\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nThere aren't enough human marks on the board yet—no list today. We'll try again when the field fills out~`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nThere aren't enough human marks on the board yet—no list today. We'll try again when the field fills out~`;
}

/** Snipe confirmation: section heading when daily bounty (2× ELO) applied to one or more pairs. */
export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Daily bounty — 2× ELO on this exchange:"
    : "Daily bounty — 2× ELO on these exchanges:";
}

/** Discord snipe confirmation (markdown); same semantics as the Slack/plain block. */
export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Daily bounty** — **2× ELO** on this exchange:"
    : "**Daily bounty** — **2× ELO** on these exchanges:";
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
    ? "Too soon — no ELO for this exchange (snipe cooldown):"
    : "Too soon — no ELO for these exchanges (snipe cooldown):";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Too soon** — no ELO for this exchange (snipe cooldown):"
    : "**Too soon** — no ELO for these exchanges (snipe cooldown):";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _Someone here was in a scoring snipe too recently._";
  }
  return " — *Someone here was in a scoring snipe too recently.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "Daily bounty is switched off in this deployment—nothing to list, I'm afraid.";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_I don't have today's marks on file yet. They land after the midnight roll—or shortly after the bot catches up, if it was asleep~_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*I don't have today's marks on file yet. They land after the midnight roll—or shortly after the bot catches up, if it was asleep~*`
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
    return "_Marks who snipe others use normal ELO—only being sniped as a mark can trigger 2×._";
  }
  return "*Marks who snipe others use normal ELO—only being sniped as a mark can trigger 2×.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Usage: \`${slashPath}\` @user1 @user2 … — up to the day's mark count (see BOUNTY_TOP_N). Same permission as adjustelo.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Daily bounty is off in this deployment—nothing to set._";
  }
  return "*Daily bounty is off in this deployment—nothing to set.*";
}

export function setBountyNoMentions(): string {
  return "Mention at least one human mark (e.g. @player). Bots won't do.";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `Only the first ${maxMarks} mark(s) are kept (BOUNTY_TOP_N).`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Manual list for today—midnight auto-roll won't replace it until the calendar turns._";
  }
  return "_Manual list for today—midnight auto-roll won't replace it until the calendar turns._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `${context} failed: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "Posted today's bounty marks to the channel—the midnight auto-list won't replace them until the calendar turns.";
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
  return "Start with `unclaim`, `clear`, `claim`, `add`, or `remove`—see `/help` for the full syntax.";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` needs at least one human @mark to append—bots won't do.";
}

export function adjustBountyNoNewMarks(): string {
  return "Everyone you mentioned is already on today's bounty list—nothing new to append.";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` needs at least one human @mark to strike from the list—bots won't do.";
}

export function adjustBountyRemoveNoListToday(): string {
  return "There's no bounty mark list on file for today (or it's empty)—nothing to remove yet.";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "None of the people you mentioned are on today's bounty list—double-check the marks.";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Every mark was struck from today's manual list—use setbounty or \`add\` when you're ready for new quarry._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Every mark was struck from today's manual list—use setbounty or \`add\` when you're ready for new quarry.*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` needs exactly one mark mention—who should get their 2× slot reopened?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `No first-snipe claim on file today for ${markLabel}—nothing to remove.`;
}

export function adjustBountyClearNone(): string {
  return "No first-snipe claims were on file for today—every mark's 2× was already open.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` needs two mentions: the sniper (credit) first, then the bounty mark.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} isn't on today's bounty mark list—set marks with setbounty first, or pick a listed mark.`;
}

export function adjustBountyClaimSelf(): string {
  return "Sniper and mark must be different people.";
}

export function adjustBountyPublicUnclaim(platform: "slack" | "discord", params: { dateLabel: string; markName: string }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Removed today's first-snipe claim on *${params.markName}*—that mark's 2× slot is open again on the next qualifying snipe.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Removed today's first-snipe claim on **${params.markName}**—that mark's 2× slot is open again.`
  );
}

export function adjustBountyPublicClear(platform: "slack" | "discord", params: { dateLabel: string; count: number }): string {
  if (platform === "slack") {
    return (
      `*Bounty ledger (operator)* — ${params.dateLabel}\n` +
      `Cleared *${params.count}* first-snipe claim(s)—every listed mark can earn 2× again on first snipe today.`
    );
  }
  return (
    `**Bounty ledger (operator)** — ${params.dateLabel}\n` +
    `Cleared **${params.count}** first-snipe claim(s)—every listed mark can earn 2× again on first snipe today.`
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
  return "Posted the bounty ledger change to the channel.";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `${context} didn't take: ${error}`;
}

export function graphViewerNotConfigured(): string {
  return `The graph viewer isn't wired yet—set GRAPH_PUBLIC_BASE_URL on the host to your Railway URL (no trailing slash), if you please.`;
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
  help: "Manual of mayhem: rules, commands, where not to drop the C4 (metaphorically).",
  leaderboard: "Who's king of the hill today—peek the board.",
  show_leaderboard: "Same as /leaderboard—post the ELO standings right here.",
  removesnipe: "Strike a snipe from the record (use the bot confirmation message ID).",
  makeupsnipe: "Log a snipe the camera missed—paperwork for the diligent.",
  adjustelo: "Adjust someone's rating by hand—sparingly, if you please.",
  setbounty: "Set today's bounty marks (@mentions). Same access as adjustelo.",
  adjustbounty: "Edit bounty ledger, append marks, or remove marks from today's list: unclaim, clear, claim, add, remove (moderators).",
  setsnipechannel: "Set this server's snipe channel to the current channel (moderators).",
  snipes: "Last five as shooter, last five times sniped—optional user; default you.",
  headtohead: "Pairwise snipe counts for everyone still on the books.",
  snipeduel: "Challenge someone to a timed snipe duel with an ELO stake.",
  bounty: "Today's bounty marks and whether each 2× reward is still open.",
  snipegraph: "Get a 1-minute code to open the live snipe graph for this server in the browser.",
} as const;
