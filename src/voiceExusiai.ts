/**
 * April Fools / alt voice: Exusiai from Arknights — upbeat, guns-and-apple-pie energy,
 * Penguin Logistics swagger, "Leader!", party/hip-hop cadence, never mean-spirited.
 * @see https://arknights.wiki.gg/wiki/Exusiai/Dialogue
 * @see https://arknights.wiki.gg/wiki/Exusiai_the_New_Covenant/Dialogue
 * @see https://arknights.wiki.gg/wiki/Exusiai/Story
 * @see https://arknights.wiki.gg/wiki/Exusiai/File
 * @see https://arknights.wiki.gg/wiki/Exusiai_the_New_Covenant/File
 */

export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_April Fools heist: Lemuen left her *console* unattended—just for a breath—and I *borrowed* the keys. " +
      "Fair's fair, she'll repo the desk tomorrow; until then you're stuck with *my* readout. " +
      "Snipe ELO's *flipped* (tagged player *gains* off the shooter); bounty 2× still tracks the mark; undo's on holiday. " +
      "Say hi to your operator of the day—and don't tell sis I called it a heist~_"
    );
  }
  return (
    "**April Fools — console acquired.** Lemuen stepped away from her rig; **Exusiai** *definitely* didn't slide the whole board over to her side of the legend. " +
    "She reclaims it after the joke. Until then: snipe ELO is **flipped** (sniped **gains** from shooter), bounty **2×** still applies to the mark, and **removesnipe** stays off. " +
    "You're on *my* channel now, Leader—enjoy the chaos."
  );
}

export function removesnipeDisabledAprilFools(): string | null {
  return (
    "_April Fools—no take-backs while I'm on the desk, Leader! `removesnipe` is on vacation; my sis brings the eraser when she's back~_"
  );
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` / plain \`${plainUndo}\` — *off for April Fools* (what's logged stays logged on my shift!).`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe` — *disabled for April Fools* (Exusiai doesn't do refunds—Lemuen restores this later).";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `Makeup delivery complete—filed under ${params.sniperLabel}! Paperwork's tight; Penguin Logistics doesn't mess around.`;
    }
    return `Makeup snipe logged under ${params.sniperLabel}—wouldn't leave a job half-delivered!`;
  }
  return `Bullseye! Credit goes to ${params.sniperLabel}—the rest is bookkeeping (and maybe apple pie later~)`;
}

export function snipeConfirmationExchangeHeading(): string {
  return "Exchange of fire:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Standings—hot off the press:";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `Whoa, wrong zip code, Leader! The snipe channel's over in ${channelRef}—that's where the scoreboard's locked and loaded.`;
}

export function serverNotConfigured(): string {
  return `This rig isn't on the delivery route yet—someone's gotta plug in the channel before we roll out!`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `I need the snipe *thread* for this undo—Slack's weird about slash commands in thread composers. ` +
    `Pop open that thread and fire a plain \`removesnipe\` (no slash). Trust me, it works like a charm!`
  );
}

export function removesnipeNothingInThread(): string {
  return `Nothin' on the docket here—either it's already cleared or we're reading the wrong page.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Boom, done! Full story's in the thread—grab a slice of apple pie and read it when you can~`;
}

export function removesnipeFailed(error: string): string {
  return `Gun jammed on that undo: ${error}`;
}

export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `Can't rewind that shot safely—the numbers already moved ` +
      `(another snipe, makeup, duel, or manual tweak). ` +
      `Undo only works if everyone's ratings still match right after that hit. ` +
      `If the books need triage, someone authorized can dial ELO with adjust.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Format: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — Slack mentions like <@U123>, got it?`;
}

export function makeupParseSniperFail(): string {
  return `Couldn't ID the shooter—hit me with a real mention, like <@U123>!`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} called \`${slashCommand}\`! Paperwork incoming in the thread—rock n' roll~`;
}

export function makeupSuccessEphemeral(): string {
  return `Filed! Check the thread for the full hail of details when you've got a sec.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `\`${slashCommand}\` misfired: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (50, -25, you know the drill).`;
}

export function adjustParseUserFail(): string {
  return `That handle won't resolve—use a mention, raw member id (U…), or their Slack @username.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `Delta's gotta be a whole number. This ain't it: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `Books updated, canvas refreshed—keep it sporting out there, Leader!`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `\`${slashCommand}\` wouldn't chamber: ${error}`;
}

export function adjustEloForbidden(): string {
  return `That lever's not on your rack—only the authorized crew gets to hand-tune ELO.`;
}

export function leaderboardFailed(error: string): string {
  return `Leaderboard slipped: ${error}`;
}

export function slackLeaderboardPagingInteractivityHint(): string {
  return (
    `Want Prev/Next buttons? Slack app → Interactivity & Shortcuts → flip *Interactivity* ON. ` +
    `Socket Mode? No URL needed. HTTP-only? Point Request URL at your Bolt endpoint (e.g. https://…/slack/events). ` +
    `Reinstall after scope/interactivity changes—then we're cooking.`
  );
}

export function snipesFailed(error: string): string {
  return `Log jammed: ${error}`;
}

export function headtoheadFailed(error: string): string {
  return `Head-to-head matrix didn't deploy: ${error}`;
}

export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — e.g. \`${slashCommand}\` @them 7d 50. Time: \`30m\`, \`2h\`, \`7d\`, \`1w\`. Bet = ELO on the line.`;
}

export function snipeDuelDurationInvalid(): string {
  return `That timer's gibberish—try \`30m\`, \`4h\`, \`7d\`, or \`1w\` (1 minute to 90 days).`;
}

export function snipeDuelBetInvalid(): string {
  return `Bet's gotta be a positive whole number of ELO—keep it real.`;
}

export function snipeDuelSelf(): string {
  return `You can't duel yourself, Leader—pick someone else to rumble with!`;
}

export function snipeDuelTargetBot(): string {
  return `That's a bot—duels are for folks with a pulse, not automatons.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `Challenge's live! They accept or decline in the thread—you can \`cancelduel\` there if you get cold feet.`;
}

export function snipeDuelFailed(error: string): string {
  return `Duel paperwork exploded: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `Hey, that's not your line—only the challenged operator accepts or declines here.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Accepted! Clock's running — ${endsSummary}. Snipes between you two count for the duel—let's go!`;
}

export function duelDeclinedPublic(): string {
  return `They passed—no bet, no brawl. Challenge's off the board.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `Challenger pulled the plug before anyone signed on—stand down.`;
}

export function duelCancelNotChallenger(): string {
  return `Only the challenger can withdraw; if you got challenged, hit \`declineduel\` instead.`;
}

export function leaderboardEmptyFallback(): string {
  return "_Board's quiet—no shots on record yet. That won't last long!_";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't scan. Developer Mode on, right-click my confirmation, Copy ID—then we're talking.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `Nobody in the crosshairs—@mention everyone who got sniped, like @alice @bob!`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `I see the pic and a ping, but only you got tagged. ` +
    `Tag everyone who was *sniped* in the same message—the sender's the shooter, easy!`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something fouled the shot: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Bots aren't on the board—tag the actual people you're sniping, not me or other automatons!`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `That lineup's got a bot in it—scores are for humans with heartbeats only.`;
}

export function adjustTargetIsBot(): string {
  return `That's a bot—no ELO row for 'em. Pick a living operator.`;
}

export function discordModeratorOnlyCommand(): string {
  return `That switch is mod-only—come back with the server keys!`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Roger! This server's snipe lane is now ${channelRef}. I'll keep score there—locked and loaded.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*Daily bounty* — ${params.dateLabel}\n` +
    `First time each mark gets *sniped* today? That exchange goes *double ELO*—full send on gains and losses. ` +
    `If a mark *snipes* someone else, normal numbers—fair's fair~\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**Daily bounty** — ${params.dateLabel}\n` +
    `First time each mark gets **sniped** today? That exchange goes **double ELO**—full send on gains and losses. ` +
    `If a mark **snipes** someone else, normal numbers—fair's fair~\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*Daily bounty* — ${dateLabel}\nNot enough humans on the board for a mark list today—we'll party when the roster fills up!`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**Daily bounty** — ${dateLabel}\nNot enough humans on the board for a mark list today—we'll party when the roster fills up!`;
}

export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Daily bounty — 2× ELO barrage on this exchange:"
    : "Daily bounty — 2× ELO barrage on these exchanges:";
}

export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Daily bounty** — **2× ELO** barrage on this exchange:"
    : "**Daily bounty** — **2× ELO** barrage on these exchanges:";
}

export function snipeConfirmationBountyExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _This hit claimed today's bounty on the mark—2× ELO, baby!_";
  }
  return " — *This hit claimed today's bounty on the mark—2× ELO, baby!*";
}

export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Whoa, pump the brakes — no ELO on this one (cooldown):"
    : "Whoa, pump the brakes — no ELO on these (cooldown):";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Easy there** — no ELO on this one (cooldown):"
    : "**Easy there** — no ELO on these (cooldown):";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _Someone here's still cooling down from a scoring snipe._";
  }
  return " — *Someone here's still cooling down from a scoring snipe.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "Daily bounty's switched off here—nothing to chase today!";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_No mark list on file yet—drops after midnight roll, or when the bot wakes up from a nap~_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*No mark list on file yet—drops after midnight roll, or when the bot wakes up from a nap~*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*Daily bounty* — ${dateLabel}\n` +
      `_Not enough humans on the board when we drew the list—no quarry today._`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel}\n` +
    `*Not enough humans on the board when we drew the list—no quarry today.*`
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
      `_First snipe on a mark today = 2× ELO for that exchange—call dibs with your camera!_`
    );
  }
  return (
    `**Daily bounty** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*First snipe on a mark today = 2× ELO for that exchange—call dibs with your camera!*`
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
      : "_2× still up for grabs—first snipe wins_";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*claimed today* by *${claimedByDisplayName}*`
      : "*claimed today*"
    : "*2× still up for grabs—first snipe wins*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who snipe others use normal ELO—only getting sniped as a mark flips the 2×._";
  }
  return "*Marks who snipe others use normal ELO—only getting sniped as a mark flips the 2×.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Format: \`${slashPath}\` @user1 @user2 … — up to BOUNTY_TOP_N marks. Same clearance as adjustelo.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Daily bounty is off—nothing to load in the chamber._";
  }
  return "*Daily bounty is off—nothing to load in the chamber.*";
}

export function setBountyNoMentions(): string {
  return "Gimme at least one human @mention—bots need not apply!";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `Only the first ${maxMarks} mark(s) stick (BOUNTY_TOP_N cap).`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Hand-set list for today—auto midnight won't overwrite until the date flips._";
  }
  return "_Hand-set list for today—auto midnight won't overwrite until the date flips._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `${context} misfired: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "Posted today's bounty marks—midnight auto-list holds fire until the calendar turns.";
}

export function graphViewerNotConfigured(): string {
  return `Graph viewer isn't wired—set GRAPH_PUBLIC_BASE_URL on the host (no trailing slash) and we're golden.`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `One-time code for the snipe graph: **${params.code}**\n` +
    `Punch it in within **${params.redeemSeconds} seconds** (longer session after redeem).\n` +
    `${params.siteUrl}\n`
  );
}

export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `One-time code for the snipe graph: *${params.code}*\n` +
    `Punch it in within *${params.redeemSeconds} seconds* (longer session after redeem).\n` +
    `${params.siteUrl}\n`
  );
}

export const discordSlashDescriptions = {
  help: "Field manual: commands, rules, quick paths—Sup, Leader!",
  leaderboard: "Who's topping the charts? Post the ELO board!",
  show_leaderboard: "Same as /leaderboard—standings right here, rock n' roll.",
  removesnipe: "April Fools: disabled—Lemuen restores undo later.",
  makeupsnipe: "Backfill a snipe the camera missed—Penguin Logistics paperwork!",
  adjustelo: "Hand-tune someone's rating—use sparingly, authorized only.",
  setbounty: "Set today's bounty marks (@mentions). Same keys as adjustelo.",
  setsnipechannel: "Point this server's snipe channel here (mods).",
  snipes: "Last five shots fired, last five caught—optional user; default you.",
  headtohead: "Everyone vs everyone snipe counts—matrix style.",
  snipeduel: "Challenge someone to a timed duel—ELO on the line!",
  bounty: "Today's bounty marks + who's still worth 2×.",
  snipegraph: "One-minute code to open the snipe web graph—let's go!",
} as const;
