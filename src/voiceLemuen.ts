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
  leaderboard: "Survey the standings—who's ahead today?",
  show_leaderboard: "Same as /leaderboard—post the ELO standings right here.",
  removesnipe: "Strike a snipe from the record (use the bot confirmation message ID).",
  makeupsnipe: "Log a snipe the camera missed—paperwork for the diligent.",
  adjustelo: "Adjust someone's rating by hand—sparingly, if you please.",
  setsnipechannel: "Set this server's snipe channel to the current channel (moderators).",
  snipes: "Last five as shooter, last five times sniped—optional user; default you.",
  headtohead: "Pairwise snipe counts for everyone still on the books.",
} as const;
