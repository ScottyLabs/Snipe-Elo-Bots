/**
 * Alt operator voice: Exusiai from Arknights — upbeat, guns-and-apple-pie energy,
 * Penguin Logistics swagger, "Leader!", party cadence; mirrored snipe confirmations for fun.
 * @see https://arknights.wiki.gg/wiki/Exusiai/Dialogue
 * @see https://arknights.wiki.gg/wiki/Exusiai_the_New_Covenant/Dialogue
 * @see https://arknights.wiki.gg/wiki/Exusiai/Story
 * @see https://arknights.wiki.gg/wiki/Exusiai/File
 * @see https://arknights.wiki.gg/wiki/Exusiai_the_New_Covenant/File
 */

export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_Penguin Logistics delivery—you've got *Exusiai* on the desk, Leader! Commands and rules are in the blocks below. " +
      "Snipe *confirmations* flip the +/- for a good laugh (sniped \"wins\" on the receipt); *the scoreboard stays honest*. " +
      "Bounty 2× works the usual way. `removesnipe` is *off* on my shift—ask whoever holds the keys to put Lemuen back on the desk when you want undo back, alright?_"
    );
  }
  return (
    "**Exusiai on comms, Leader!** Below: commands and rules. Snipe **confirmations** show a **mirrored** exchange for laughs; **real ELO** lives on **/leaderboard** and the scoreboard. " +
    "**Bounty 2×** is normal. **`removesnipe` is disabled** while this voice is active—ask whoever holds the keys to put Lemuen back on the desk to turn undo back on, got it?"
  );
}

export function removesnipeDisabledAprilFools(): string | null {
  return (
    "_No take-backs while *I'm* on the desk, Leader! `removesnipe` is parked—ask whoever holds the keys to put Lemuen back on the desk when you want the eraser back, alright?_"
  );
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` / plain \`${plainUndo}\` — *off in Exusiai voice* (real ELO is safe; only the confirmation ticker is backwards, haha!).`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe` — *off while Exusiai voice is active* (ask whoever holds the keys to put Lemuen back on the desk to enable undo, Leader!).";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `Makeup delivery complete—filed under ${params.sniperLabel}! Paperwork's tight; Penguin Logistics doesn't mess around, Leader!`;
    }
    return `Makeup snipe logged under ${params.sniperLabel}—wouldn't leave a job half-delivered, Leader!`;
  }
  return `Bullseye! Credit goes to ${params.sniperLabel}—the rest is bookkeeping (and maybe apple pie later~!)`;
}

export function snipeConfirmationExchangeHeading(): string {
  return "Exchange of fire — *mirror readout (Exusiai ticker)*:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Standings — *mirrored here* (the scoreboard is honest):";
}

export function snipeConfirmationAprilFoolsMirrorDisclaimer(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_Fine print: every +/- and rating line *above* is *mirrored* on purpose—my ticker runs backwards for fun, Leader! " +
      "The shooter still banked the real points—peek `/leaderboard` if you want the boring truth~_"
    );
  }
  return (
    "*Fine print:* the block above is a **mirrored readout** for Exusiai voice, Leader! " +
    "**Real ELO** is on **/leaderboard**—the shooter earned it for real."
  );
}

export function wrongSnipeChannel(channelRef: string): string {
  return `Whoa, wrong zip code, Leader! The snipe channel's over in ${channelRef}—that's where the scoreboard's locked and loaded!`;
}

export function serverNotConfigured(): string {
  return `This rig isn't on the delivery route yet—someone's gotta plug in the channel before we roll out, Leader!`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `I need the snipe *thread* for this undo, Leader—Slack's weird about slash commands in thread composers. ` +
    `Pop open that thread and fire a plain \`removesnipe\` (no slash). Trust me, it works like a charm!`
  );
}

export function removesnipeNothingInThread(): string {
  return `Nothin' on the docket here, Leader—either it's already cleared or we're reading the wrong page!`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Boom, done! Full story's in the thread—grab a slice of apple pie and read it when you can, Leader~`;
}

export function removesnipeFailed(error: string): string {
  return `Gun jammed on that undo, Leader: ${error}`;
}

export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `Can't rewind that shot safely, Leader—the numbers already moved ` +
      `(another snipe, makeup, duel, or manual tweak). ` +
      `Undo only works if everyone's ratings still match right after that hit. ` +
      `If the books need triage, someone authorized can dial ELO with adjust!`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Format: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — Slack mentions like <@U123>, got it, Leader?`;
}

export function makeupParseSniperFail(): string {
  return `Couldn't ID the shooter—hit me with a real mention, like <@U123>, Leader!`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} called \`${slashCommand}\`! Paperwork incoming in the thread—rock n' roll, Leader~`;
}

export function makeupSuccessEphemeral(): string {
  return `Filed! Check the thread for the full hail of details when you've got a sec, Leader!`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `\`${slashCommand}\` misfired, Leader: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (50, -25, you know the drill, Leader!).`;
}

export function adjustParseUserFail(): string {
  return `That handle won't resolve, Leader—use a mention, raw member id (U…), or their Slack @username!`;
}

export function adjustDeltaInvalid(got: string): string {
  return `Delta's gotta be a whole number, Leader. This ain't it: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `Books updated, canvas refreshed—keep it sporting out there, Leader!`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `\`${slashCommand}\` wouldn't chamber, Leader: ${error}`;
}

export function adjustEloForbidden(): string {
  return `That lever's not on your rack, Leader—only the authorized crew gets to hand-tune ELO!`;
}

export function leaderboardFailed(error: string): string {
  return `Leaderboard slipped, Leader: ${error}`;
}

export function slackLeaderboardPagingInteractivityHint(): string {
  return "The Prev/Next buttons are missing, Leader! Someone with the keys needs to flip Interactivity ON in the Slack app settings—then we're cooking!";
}

export function snipesFailed(error: string): string {
  return `Log jammed, Leader: ${error}`;
}

export function headtoheadFailed(error: string): string {
  return `Head-to-head matrix didn't deploy, Leader: ${error}`;
}

export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — e.g. \`${slashCommand}\` @them 7d 50. Time: \`30m\`, \`2h\`, \`7d\`, \`1w\`. Bet = ELO on the line, Leader!`;
}

export function snipeDuelDurationInvalid(): string {
  return `That timer's gibberish, Leader—try \`30m\`, \`4h\`, \`7d\`, or \`1w\` (1 minute to 90 days)!`;
}

export function snipeDuelBetInvalid(): string {
  return `Bet's gotta be a positive whole number of ELO, Leader—keep it real!`;
}

export function snipeDuelSelf(): string {
  return `You can't duel yourself, Leader—pick someone else to rumble with!`;
}

export function snipeDuelTargetBot(): string {
  return `That's a bot, Leader—duels are for folks with a pulse, not automatons!`;
}

export function snipeDuelPostedEphemeral(): string {
  return `Challenge's live, Leader! They accept or decline in the thread—you can \`cancelduel\` there if you get cold feet!`;
}

export function snipeDuelFailed(error: string): string {
  return `Duel paperwork exploded, Leader: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `Hey, that's not your line, Leader—only the challenged operator accepts or declines here!`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted! Clock's running — ${endsSummary}. Snipes between you two count for the duel—let's go, Leader!`;
}

export function duelDeclinedPublic(): string {
  return `They passed—no bet, no brawl. Challenge's off the board, Leader!`;
}

export function duelCancelledByChallengerPublic(): string {
  return `Challenger pulled the plug before anyone signed on—stand down, Leader!`;
}

export function duelCancelNotChallenger(): string {
  return `Only the challenger can withdraw, Leader; if you got challenged, hit \`declineduel\` instead!`;
}

export function leaderboardEmptyFallback(): string {
  return "_Board's quiet, Leader—no shots on record yet. That won't last long!_";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't scan, Leader. Developer Mode on, right-click my confirmation, Copy ID—then we're talking!`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `Nobody in the crosshairs, Leader—@mention everyone who got sniped, like @alice @bob!`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the pic and a ping, Leader, but only you got tagged. ` +
    `Tag everyone who was *sniped* in the same message—the sender's the shooter, easy!`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something fouled the shot, Leader: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Bots aren't on the board, Leader—tag the actual people you're sniping, not me or other automatons!`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `That lineup's got a bot in it, Leader—scores are for humans with heartbeats only!`;
}

export function adjustTargetIsBot(): string {
  return `That's a bot, Leader—no ELO row for 'em. Pick a living operator!`;
}

export function discordModeratorOnlyCommand(): string {
  return `That switch is mod-only, Leader—come back with the server keys!`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Roger! This server's snipe lane is now ${channelRef}. I'll keep score there—locked and loaded, Leader!`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `First time each mark gets *sniped* today? That exchange goes *double ELO*—full send on gains and losses, Leader! ` +
    `If a mark *snipes* someone else, normal numbers—fair's fair~\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `First time each mark gets **sniped** today? That exchange goes **double ELO**—full send on gains and losses, Leader! ` +
    `If a mark **snipes** someone else, normal numbers—fair's fair~\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nNot enough humans on the board for a mark list today, Leader—we'll party when the roster fills up!`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nNot enough humans on the board for a mark list today, Leader—we'll party when the roster fills up!`;
}

export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Daily bounty — 2× ELO barrage on this exchange, Leader!"
    : "Daily bounty — 2× ELO barrage on these exchanges, Leader!";
}

export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Daily bounty** — **2× ELO** barrage on this exchange, Leader!"
    : "**Daily bounty** — **2× ELO** barrage on these exchanges, Leader!";
}

export function snipeConfirmationBountyExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _This hit claimed today's bounty on the mark—2× ELO, baby!_";
  }
  return " — *This hit claimed today's bounty on the mark—2× ELO, baby!*";
}

export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Whoa, pump the brakes, Leader — no ELO on this one (cooldown):"
    : "Whoa, pump the brakes, Leader — no ELO on these (cooldown):";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Easy there, Leader** — no ELO on this one (cooldown):"
    : "**Easy there, Leader** — no ELO on these (cooldown):";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _Someone here's still cooling down from a scoring snipe._";
  }
  return " — *Someone here's still cooling down from a scoring snipe.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "Daily bounty's switched off here, Leader—nothing to chase today!";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_No mark list on file yet, Leader—drops after midnight roll, or when the bot wakes up from a nap~_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*No mark list on file yet, Leader—drops after midnight roll, or when the bot wakes up from a nap~*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Not enough humans on the board when we drew the list, Leader—no quarry today._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Not enough humans on the board when we drew the list, Leader—no quarry today.*`
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
      `_First snipe on a mark today = 2× ELO for that exchange—call dibs with your camera, Leader!_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*First snipe on a mark today = 2× ELO for that exchange—call dibs with your camera, Leader!*`
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
      : "_2× still up for grabs—first snipe wins, Leader!_";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*claimed today* by *${claimedByDisplayName}*`
      : "*claimed today*"
    : "*2× still up for grabs—first snipe wins, Leader!*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who snipe others use normal ELO—only getting sniped as a mark flips the 2×, Leader!_";
  }
  return "*Marks who snipe others use normal ELO—only getting sniped as a mark flips the 2×, Leader!*";
}

export function setBountyUsage(slashPath: string): string {
  return `Format: \`${slashPath}\` @user1 @user2 … — up to BOUNTY_TOP_N marks. Same clearance as adjustelo, Leader!`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Daily bounty is off, Leader—nothing to load in the chamber._";
  }
  return "*Daily bounty is off, Leader—nothing to load in the chamber.*";
}

export function setBountyNoMentions(): string {
  return "Gimme at least one human @mention, Leader—bots need not apply!";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `Only the first ${maxMarks} mark(s) stick, Leader (BOUNTY_TOP_N cap).`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Hand-set list for today, Leader—auto midnight won't overwrite until the date flips._";
  }
  return "_Hand-set list for today, Leader—auto midnight won't overwrite until the date flips._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `${context} misfired, Leader: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "Posted today's bounty marks, Leader—midnight auto-list holds fire until the calendar turns!";
}

export function adjustBountyUsage(slashPath: string): string {
  return (
    `Format: \`${slashPath}\` \`unclaim\` <@mark> · \`${slashPath}\` \`clear\` · \`${slashPath}\` \`claim\` <@sniper> <@mark> · ` +
    `\`${slashPath}\` \`add\` <@mark> … · \`${slashPath}\` \`remove\` <@mark> … — tack marks on or scratch 'em off the board (BOUNTY_TOP_N still applies to adds). Same keys as adjustelo, Leader!`
  );
}

export function adjustBountyUnknownSubcommand(): string {
  return "Need `unclaim`, `clear`, `claim`, `add`, or `remove`, Leader—peek `/help` for the cheat sheet!";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` wants at least one human ping, Leader—load in some real marks!";
}

export function adjustBountyNoNewMarks(): string {
  return "Those folks are already on today's bounty board, Leader—nothing fresh to tack on!";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` needs at least one human ping, Leader—who're we erasing from the wanted poster?";
}

export function adjustBountyRemoveNoListToday(): string {
  return "No bounty board up today (or it's blank), Leader—nothing to scrub off yet!";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "Nobody you tagged is actually on today's list, Leader—wrong faces on the dartboard!";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Wiped the slate, Leader—no marks left. Load a fresh list with setbounty or \`add\` when you're ready to party~_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Wiped the slate, Leader—no marks left. Load a fresh list with setbounty or \`add\` when you're ready to party~*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` wants one @mark, Leader—whose 2× are we cracking back open?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `Nobody's on file for first snipe on ${markLabel} today, Leader—already wide open!`;
}

export function adjustBountyClearNone(): string {
  return "Ledger's already empty, Leader—every mark's 2× was up for grabs.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` needs two pings, Leader: shooter first, bounty mark second.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} ain't on today's bounty board, Leader—set the list with setbounty first!`;
}

export function adjustBountyClaimSelf(): string {
  return "Shooter and mark gotta be two different operators, Leader!";
}

export function adjustBountyPublicUnclaim(platform: "slack" | "discord", params: { dateLabel: string; markName: string }): string {
  if (platform === "slack") {
    return (
      `*Bounty desk (operator)* — ${params.dateLabel}\n` +
      `Yanked today's first-snipe flag off *${params.markName}*, Leader—2× is live again on the next hit!`
    );
  }
  return (
    `**Bounty desk (operator)** — ${params.dateLabel}\n` +
    `Yanked today's first-snipe flag off **${params.markName}**, Leader—2× is live again on the next hit!`
  );
}

export function adjustBountyPublicClear(platform: "slack" | "discord", params: { dateLabel: string; count: number }): string {
  if (platform === "slack") {
    return (
      `*Bounty desk (operator)* — ${params.dateLabel}\n` +
      `Cleared *${params.count}* first-snipe flag(s), Leader—full mag of 2× chances for every mark!`
    );
  }
  return (
    `**Bounty desk (operator)** — ${params.dateLabel}\n` +
    `Cleared **${params.count}** first-snipe flag(s), Leader—full mag of 2× for every mark!`
  );
}

export function adjustBountyPublicClaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; sniperName: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Bounty desk (operator)* — ${params.dateLabel}\n` +
      `Manual entry, Leader: *${params.sniperName}* landed first snipe on *${params.markName}*—2× locked in for that mark today.`
    );
  }
  return (
    `**Bounty desk (operator)** — ${params.dateLabel}\n` +
    `Manual entry, Leader: **${params.sniperName}** landed first snipe on **${params.markName}**—2× locked in for that mark today.`
  );
}

export function adjustBountySuccessEphemeral(): string {
  return "Broadcast the ledger tweak to the channel, Leader—nice and loud!";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `${context} jammed, Leader: ${error}`;
}

export function graphViewerNotConfigured(): string {
  return `Graph viewer isn't wired, Leader—set GRAPH_PUBLIC_BASE_URL on the host (no trailing slash) and we're golden!`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `One-time code for the snipe graph, Leader: **${params.code}**\n` +
    `Punch it in within **${params.redeemSeconds} seconds** (longer session after redeem).\n` +
    `${params.siteUrl}\n`
  );
}

export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `One-time code for the snipe graph, Leader: *${params.code}*\n` +
    `Punch it in within *${params.redeemSeconds} seconds* (longer session after redeem).\n` +
    `${params.siteUrl}\n`
  );
}

export const discordSlashDescriptions = {
  help: "Field manual: commands, rules, quick paths—Sup, Leader!",
  leaderboard: "Who's topping the charts? Post the ELO board, Leader!",
  show_leaderboard: "Same as /leaderboard—standings right here, rock n' roll!",
  removesnipe: "Disabled in Exusiai voice—use Lemuen voice to enable undo, Leader!",
  makeupsnipe: "Backfill a snipe the camera missed—Penguin Logistics paperwork!",
  adjustelo: "Hand-tune someone's rating—use sparingly, authorized only, Leader!",
  setbounty: "Set today's bounty marks (@mentions). Same keys as adjustelo, Leader!",
  adjustbounty: "Ledger, slap marks on, or scrub 'em off: unclaim, clear, claim, add, remove (mods).",
  setsnipechannel: "Point this server's snipe channel here (mods), Leader!",
  snipes: "Last five shots fired, last five caught—optional user; default you, Leader!",
  headtohead: "Everyone vs everyone snipe counts—matrix style, Leader!",
  snipeduel: "Challenge someone to a timed duel—ELO on the line, Leader!",
  bounty: "Today's bounty marks + who's still worth 2×, Leader!",
  snipegraph: "One-minute code to open the snipe web graph—let's go, Leader!",
} as const;
