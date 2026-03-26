/**
 * User-facing lines in Lemuen's voice (Arknights): cordial, precise, lightly edged.
 * @see https://arknights.wiki.gg/wiki/Lemuen/Dialogue
 */

export function wrongSnipeChannel(channelRef: string): string {
  return `We're not in the right nest for that. Would you mind running this in ${channelRef}? I only keep score there.`;
}

export function serverNotConfigured(): string {
  return `This place isn't on my chart yet—no snipe lane mapped. Someone with the keys will need to wire that up first.`;
}

export function removesnipeNeedSlackThread(): string {
  return `Kindly open the snipe thread, then use the command *from inside it*. I need to know which conversation we're revising.`;
}

export function removesnipeNothingInThread(): string {
  return `Nothing to undo here. The page is either already clean, or we're reading the wrong one.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Done. I've left the details in the thread—review them when you have a moment.`;
}

export function removesnipeFailed(error: string): string {
  return `Please, this is no time for excuses—and undo didn't take: ${error}`;
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — Slack mentions like <@U123>, if you please.`;
}

export function makeupParseSniperFail(): string {
  return `I couldn't make sense of the sniper. A proper mention—<@U123>—would help.`;
}

export function makeupRootMessage(userMention: string, slashCommand: string): string {
  return `${userMention} called \`${slashCommand}\`. The paperwork follows in the thread~`;
}

export function makeupSuccessEphemeral(): string {
  return `Logged. You'll find the full reckoning threaded under that new message.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `${slashCommand} didn't cooperate: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only (e.g. 50 or -25).`;
}

export function adjustParseUserFail(): string {
  return `That user token won't parse. A mention in the usual shape—<@U123>—if you'd be so kind.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The delta must be a whole number. What I got doesn't quite qualify: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `The books are updated and the canvas refreshed. Try to keep things sporting.`;
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

export function leaderboardEmptyFallback(): string {
  return "_The board is quiet—no scores yet. That can change in a heartbeat._";
}

export function discordInvalidConfirmationId(): string {
  return `That ID doesn't ring true. Developer Mode on, right-click my confirmation message, Copy ID—then we talk.`;
}

export function discordNothingToUndo(): string {
  return `Nothing to undo for that message—wrong ID, already struck from the record, or not one of mine.`;
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
  return (
    `Image, mention—but only you. Tag everyone who was sniped in that same message, if you would.`
  );
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Something fouled the shot: ${error}`;
}

/** Discord slash command descriptions (short, her register). */
export const discordSlashDescriptions = {
  leaderboard: "Survey the standings—who's sitting pretty today?",
  removesnipe: "Strike a snipe from the record (bot confirmation message ID).",
  makeupsnipe: "Log a snipe that missed the camera—paperwork for the diligent.",
  adjustelo: "Adjust someone's rating by hand—sparingly, if you please.",
} as const;
