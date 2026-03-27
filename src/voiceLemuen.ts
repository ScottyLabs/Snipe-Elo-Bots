/**
 * User-facing lines in Lemuen's voice (Arknights): cordial, precise, lightly edged—
 * polite requests that still expect compliance; occasional warmth or “~”; paperwork and aim metaphors.
 * @see https://arknights.wiki.gg/wiki/Lemuen/Dialogue
 * @see https://arknights.wiki.gg/wiki/Lemuen/Story
 */

export function wrongSnipeChannel(channelRef: string): string {
  return `We're not in the nest I use for that. Would you mind running it in ${channelRef}? I only keep score from the lane I've mapped.`;
}

export function serverNotConfigured(): string {
  return `This place isn't on my chart yet—no snipe lane drawn. Someone with the keys will need to wire that up first.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `I need the snipe *thread* for this undo. Slack won't deliver custom slash commands from thread composers—` +
    `open that thread and send a plain message: \`removesnipe\` (no leading slash). That's the reliable path, if you please.`
  );
}

export function removesnipeNothingInThread(): string {
  return `Nothing to undo here. The page is either already clean, or we're reading the wrong one.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Done. I've left the particulars in the thread—review them when you have a moment.`;
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
  return `${callerDisplayName} called \`${slashCommand}\`. The paperwork follows in the thread~`;
}

export function makeupSuccessEphemeral(): string {
  return `Logged. You'll find the full reckoning threaded under that new message—kindly look it over when you're free.`;
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
  return `The books are updated and the canvas refreshed. Try to keep things sporting—shall we call that settled?`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} refused to play along: ${error}`;
}

export function adjustEloForbidden(): string {
  return `That lever isn't on your console—manual ELO edits aren't for this seat. Kindly leave the bookkeeping to those authorized.`;
}

export function leaderboardFailed(error: string): string {
  return `The roster slipped through my fingers: ${error}`;
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
  return "_The board's quiet—no scores yet. That can change in a heartbeat._";
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

/** Discord slash command descriptions (short, her register). */
export const discordSlashDescriptions = {
  help: "Open the field manual: commands, rules, and the quick paths.",
  leaderboard: "Survey the standings—who's ahead today?",
  show_leaderboard: "Same as /leaderboard—post the ELO standings right here.",
  removesnipe: "Strike a snipe from the record (use the bot confirmation message ID).",
  makeupsnipe: "Log a snipe the camera missed—paperwork for the diligent.",
  adjustelo: "Adjust someone's rating by hand—sparingly, if you please.",
  setsnipechannel: "Set this server's snipe channel to the current channel (moderators).",
  snipes: "Last five as shooter, last five times sniped—optional user; default you.",
  headtohead: "Pairwise snipe counts for everyone still on the books.",
  snipeduel: "Challenge someone to a timed snipe duel with an ELO stake.",
} as const;
