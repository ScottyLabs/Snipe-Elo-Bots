/**
 * Typhon (Arknights): Sami hunter—"Schysst" (Nice), "Nähä" (Nuh-uh), "Tjena" (Hey), "shadows", "Sami", "prey", "hunting", "snow", "nature", "bow", "arrows", "Doctor".
 * @see https://arknights.wiki.gg/wiki/Typhon/Dialogue
 */

/** Short intro line under the /help title. */
export function helpCommandPrologue(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return (
      "_Tjena. Time to choose our prey. The rules of the hunt are below. Read them carefully. " +
      "Stay close, don't run off into the shadows._"
    );
  }
  return (
    "**Tjena.** Time to choose our prey. The rules of the hunt are below. Read them carefully. Stay close, don't run off into the shadows."
  );
}

/** When non-null, undo/removesnipe is blocked (Exusiai / `BOT_VOICE` aliases only). */
export function removesnipeDisabledAprilFools(): string | null {
  return null;
}

export function helpSnipeUndoLineSlack(slashUndo: string, plainUndo: string): string {
  return `• \`${slashUndo}\` — erase a bad shot in a thread. In thread composers, use plain \`${plainUndo}\`.`;
}

export function helpSnipeUndoLineDiscord(): string {
  return "• `/removesnipe <confirmation_id>` — erase a bad shot from the snow.";
}

export function snipeConfirmationHeader(params: {
  kind: "snipe" | "makeup";
  sniperLabel: string;
  /** Discord copy uses a slightly different makeup lead-in. */
  discord?: boolean;
}): string {
  if (params.kind === "makeup") {
    if (params.discord) {
      return `Makeup shot for ${params.sniperLabel}. I see you managed to complete a mission without causing any unnecessary pain to the quarry. Schysst.`;
    }
    return `Makeup shot for ${params.sniperLabel}. I see you managed to complete a mission without causing any unnecessary pain to the quarry. Schysst.`;
  }
  const lines = [
    `I'll pin you to your shadow. ${params.sniperLabel} claims the prey. The snow remembers. Schysst.`,
    `Nature should not be disturbed. ${params.sniperLabel} claims the prey. The snow remembers. Schysst.`
  ];
  return lines[Math.floor(Math.random() * lines.length)] + "\nhttps://images.steamusercontent.com/ugc/2019356099348915709/A7612BEC75104E9E04325DD48569BBB52BC68752/?imw=512&&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=false";
}

export function snipeConfirmationExchangeHeading(): string {
  return "The hunt's toll:";
}

export function snipeConfirmationStandingsHeading(): string {
  return "Current standing in the snow:";
}

/** No-op for default voice; Exusiai appends a mirror disclaimer on snipe confirmations. */
export function snipeConfirmationAprilFoolsMirrorDisclaimer(_platform: "slack" | "discord"): string {
  return "";
}

export function wrongSnipeChannel(channelRef: string): string {
  return `Nähä. Get out of my home! The prey is tracked in ${channelRef}. Follow me there.`;
}

export function serverNotConfigured(): string {
  return `No hunting ground set. The shadows are quiet. Wait for someone to mark the territory.`;
}

export function removesnipeNeedSlackThread(): string {
  return (
    `To erase a track, you must be in the *thread*. Slack cannot follow the scent from composers—` +
    `open the thread, type plain \`removesnipe\`, no slash. Focus.`
  );
}

export function removesnipeNothingInThread(): string {
  return `No tracks here. The snow is untouched. You're chasing shadows.`;
}

export function removesnipeUndoAckEphemeral(): string {
  return `Track erased. Nature should not be disturbed. Look in the thread.`;
}

export function removesnipeFailed(error: string): string {
  return `Nähä. You'll have to be faster than that to even think about faking an attack: ${error}`;
}

/** Maps known DB errors to readable copy; keeps raw detail out of chat when we have a stable explanation. */
export function formatRemovesnipeError(error: string): string {
  if (error.includes("cannot_undo_out_of_date_state")) {
    return (
      `I cannot erase that track—the pack has moved on. ` +
      `New prey was caught, or the balance shifted. ` +
      `Undo only works if the snow is exactly as we left it. ` +
      `If the hunt's record is truly wrong, the leader must adjust it manually.`
    );
  }
  return removesnipeFailed(error);
}

export function makeupUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <sniper> <sniped1> <sniped2> … — use proper mentions, like <@U123>.`;
}

export function makeupParseSniperFail(): string {
  return `I cannot see the hunter in the blizzard. Give me a clear mention, <@U123>. Nähä.`;
}

export function makeupRootMessage(callerDisplayName: string, slashCommand: string): string {
  return `${callerDisplayName} signaled \`${slashCommand}\`. The tracks are in the thread—don't lose the scent.`;
}

export function makeupSuccessEphemeral(): string {
  return `The prey is logged. The thread has the rest. Sip a hot drink and get some rest.`;
}

export function makeupCommandFailed(slashCommand: string, error: string): string {
  return `The bowstring snapped on ${slashCommand}: ${error}`;
}

export function adjustUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <user> <delta> — whole numbers only.`;
}

export function adjustParseUserFail(): string {
  return `I cannot track that user. Use a clear mention, ID, or handle. The shadows obscure them.`;
}

export function adjustDeltaInvalid(got: string): string {
  return `The shift must be a whole number. Nature does not deal in fragments: ${got}`;
}

export function adjustSuccessEphemeral(): string {
  return `The balance is restored. The snow is level. Schysst.`;
}

export function adjustCommandFailed(slashCommand: string, error: string): string {
  return `The adjustment failed. The ice is too thick: ${error}`;
}

export function adjustEloForbidden(): string {
  return `Nähä. You do not have the right to alter the hunt's balance.`;
}

export function leaderboardFailed(error: string): string {
  return `The pack's trail is lost: ${error}. The blizzard is too strong.`;
}

/** Appended when Block Kit post fails but pagination was intended (plain-text fallback has no buttons). */
export function slackLeaderboardPagingInteractivityHint(): string {
  return "The Prev/Next buttons are missing. Someone with the keys must enable Interactivity in the Slack app settings.";
}

export function snipesFailed(error: string): string {
  return `The hunting log is frozen: ${error}`;
}

export function headtoheadFailed(error: string): string {
  return `The pack's history is obscured: ${error}`;
}

export function snipeDuelUsage(slashCommand: string): string {
  return `Usage: \`${slashCommand}\` <@opponent> <duration> <bet> — e.g. \`${slashCommand} @them 7d 50\`. Duration: \`30m\`, \`2h\`, \`7d\`, \`1w\`. Bet is ELO points.`;
}

export function snipeDuelDurationInvalid(): string {
  return `The time is unclear. Use \`30m\`, \`4h\`, \`7d\`, or \`1w\`.`;
}

export function snipeDuelBetInvalid(): string {
  return `The stakes must be a positive whole number. Don't insult the prey.`;
}

export function snipeDuelSelf(): string {
  return `Nähä. You cannot hunt yourself. Find real prey in the snow.`;
}

export function snipeDuelTargetBot(): string {
  return `That is a machine, not prey. Hunt something that breathes.`;
}

export function snipeDuelPostedEphemeral(): string {
  return `The challenge is howling in the wind. They can accept or decline in the thread. You can \`cancelduel\` if you lose your nerve.`;
}

export function snipeDuelFailed(error: string): string {
  return `The challenge was lost in the blizzard: ${error}`;
}

export function duelReplyNotTarget(): string {
  return `Nähä. This challenge was not meant for you. Step back into the shadows.`;
}

export function duelAcceptedPublic(endsSummary: string): string {
  return `Cowards break the silence first. The storm rages until ${endsSummary}. May the best hunter win.`;
}

export function duelDeclinedPublic(): string {
  return `The prey fled. If you've let your target escape, then you should give up the chase.`;
}

export function duelCancelledByChallengerPublic(): string {
  return `The hunter withdrew. You've already lost.`;
}

/** Non-initiator typed cancelduel (includes challenged party—use declineduel). */
export function duelCancelNotChallenger(): string {
  return `Only the one who howled the challenge can withdraw it. If you were challenged, use \`declineduel\`.`;
}

export function leaderboardEmptyFallback(): string {
  return "_The snow is pure. No tracks, no prey. The hunt has not begun._";
}

export function discordInvalidConfirmationId(): string {
  return `That mark is false. Developer Mode on, right-click my confirmation message, Copy ID. Try again.`;
}

export function discordNothingToUndo(): string {
  return removesnipeNothingInThread();
}

export function discordNoSnipedInMakeup(): string {
  return `I see no prey. Add @mentions in the sniped field to mark them.`;
}

export function implicitSnipeOnlySelfSlack(): string {
  return (
    `You only marked yourself in the snow. ` +
    `Mention everyone who was caught in the trap. The shooter is the one who set it.`
  );
}

export function implicitSnipeOnlySelfDiscord(): string {
  return implicitSnipeOnlySelfSlack();
}

export function implicitSnipeProcessFailed(error: string): string {
  return `Grasp these seeds tightly in your hand, and run. The trap failed: ${error}`;
}

export function snipeImplicitBotsOnlySlack(): string {
  return `Machines leave no tracks. Mention the breathing prey you caught, not bots.`;
}

export function snipeImplicitBotsOnlyDiscord(): string {
  return snipeImplicitBotsOnlySlack();
}

export function snipeMakeupIncludesBot(): string {
  return `You listed a machine as prey. The hunt is for the living. Remove the bot.`;
}

export function adjustTargetIsBot(): string {
  return `Machines have no place in the pack's balance. Pick a living hunter.`;
}

export function discordModeratorOnlyCommand(): string {
  return `Nähä. Only the pack leaders can do that.`;
}

export function discordSnipeChannelSet(channelRef: string): string {
  return `Understood. The new hunting ground is ${channelRef}. I will watch the shadows there.`;
}

export function bountyDailyAnnouncementSlack(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `*The Great Hunt* — ${params.dateLabel}\n` +
    `The first time these marks are caught today, the reward is *doubled*. ` +
    `If a mark hunts someone else, the normal rules apply. Happy hunting.\n` +
    lines
  );
}

export function bountyDailyAnnouncementDiscord(params: { dateLabel: string; rankedLines: string[] }): string {
  const lines = params.rankedLines.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return (
    `**The Great Hunt** — ${params.dateLabel}\n` +
    `The first time these marks are caught today, the reward is **doubled**. ` +
    `If a mark hunts someone else, the normal rules apply. Happy hunting.\n` +
    lines
  );
}

export function bountyDailyNoTargetsSlack(dateLabel: string): string {
  return `*The Great Hunt* — ${dateLabel}\nThe snow is empty. Not enough prey for a grand hunt today.`;
}

export function bountyDailyNoTargetsDiscord(dateLabel: string): string {
  return `**The Great Hunt** — ${dateLabel}\nThe snow is empty. Not enough prey for a grand hunt today.`;
}

/** Snipe confirmation bounty block — shared plaintext for every voice (`snipeBountyConfirmationText`). */
export {
  snipeConfirmationBountySectionTitle,
  snipeConfirmationBountySectionTitleDiscord,
  snipeConfirmationBountyExchangeDetail,
} from "./snipeBountyConfirmationText";

/** Snipe confirmation: section when a pair was skipped because of snipe cooldown (no ELO). */
export function snipeConfirmationPairCooldownSectionTitle(singleExchange: boolean): string {
  return singleExchange
    ? "Too soon — the prey was not ready (cooldown):"
    : "Too soon — the prey were not ready (cooldown):";
}

export function snipeConfirmationPairCooldownSectionTitleDiscord(singleExchange: boolean): string {
  return singleExchange
    ? "**Too soon** — the prey was not ready (cooldown):"
    : "**Too soon** — the prey were not ready (cooldown):";
}

export function snipeConfirmationPairCooldownExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _The snow has not settled from their last encounter._";
  }
  return " — *The snow has not settled from their last encounter.*";
}

export function bountySlashDisabled(_platform: "slack" | "discord"): string {
  return "The Great Hunt is not active here. Only normal prey.";
}

export function bountySlashNoLedgerYet(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*The Great Hunt* — ${dateLabel}\n` +
      `_I haven't tracked today's marks yet. The shadows will reveal them soon._`
    );
  }
  return (
    `**The Great Hunt** — ${dateLabel}\n` +
    `*I haven't tracked today's marks yet. The shadows will reveal them soon.*`
  );
}

export function bountySlashEmptyMarks(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*The Great Hunt* — ${dateLabel}\n` +
      `_The pack is too small today. No grand hunt._`
    );
  }
  return (
    `**The Great Hunt** — ${dateLabel}\n` +
    `*The pack is too small today. No grand hunt.*`
  );
}

export function bountySlashListHeader(
  platform: "slack" | "discord",
  dateLabel: string,
  timeZoneIana: string
): string {
  if (platform === "slack") {
    return (
      `*The Great Hunt* — ${dateLabel} (_${timeZoneIana}_)\n` +
      `_First to catch these marks today gets double the reward._`
    );
  }
  return (
    `**The Great Hunt** — ${dateLabel} (*${timeZoneIana}*)\n` +
    `*First to catch these marks today gets double the reward.*`
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
        ? `_caught today by ${claimedByDisplayName}_`
        : "_caught today_"
      : "_still roaming the snow—first to catch them wins_";
    return `${rank}. ${displayName} — ${status}`;
  }
  const status = claimed
    ? claimedByDisplayName
      ? `*caught today* by *${claimedByDisplayName}*`
      : "*caught today*"
    : "*still roaming the snow—first to catch them wins*";
  return `${rank}. ${displayName} — ${status}`;
}

export function bountySlashFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_Marks who hunt others get normal rewards. The double is only for catching the mark._";
  }
  return "*Marks who hunt others get normal rewards. The double is only for catching the mark.*";
}

export function setBountyUsage(slashPath: string): string {
  return `Usage: \`${slashPath}\` @user1 @user2 … — up to the day's mark count.`;
}

export function setBountyDisabled(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_The Great Hunt is disabled here._";
  }
  return "*The Great Hunt is disabled here.*";
}

export function setBountyNoMentions(): string {
  return "You must name the prey. Mention at least one living mark.";
}

export function setBountyTooManyDropped(maxMarks: number): string {
  return `The pack can only track ${maxMarks} mark(s) at once.`;
}

export function setBountyOperatorFooter(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return "_The hunt is set by hand today. The snow won't shift until midnight._";
  }
  return "_The hunt is set by hand today. The snow won't shift until midnight._";
}

export function setBountyFailed(context: string, msg: string): string {
  return `The shadows rejected ${context}: ${msg}`;
}

export function setBountySuccessEphemeral(): string {
  return "The Great Hunt's marks are set. They will not change until the sun rises again.";
}

export function adjustBountyUsage(slashPath: string): string {
  return (
    `Usage: \`${slashPath}\` \`unclaim\` <@mark> — free the prey again · ` +
    `\`${slashPath}\` \`clear\` — free all prey today · ` +
    `\`${slashPath}\` \`claim\` <@sniper> <@mark> — log a catch manually · ` +
    `\`${slashPath}\` \`add\` <@mark> … — add prey to the hunt · ` +
    `\`${slashPath}\` \`remove\` <@mark> … — drop prey from the hunt.`
  );
}

export function adjustBountyUnknownSubcommand(): string {
  return "Nähä. Use `unclaim`, `clear`, `claim`, `add`, or `remove`.";
}

export function adjustBountyAddNeedMentions(): string {
  return "`add` needs living prey to append. Mention them.";
}

export function adjustBountyNoNewMarks(): string {
  return "They are already being hunted today. Nothing changes.";
}

export function adjustBountyRemoveNeedMentions(): string {
  return "`remove` needs living prey to drop. Mention them.";
}

export function adjustBountyRemoveNoListToday(): string {
  return "There is no hunt today. Nothing to remove.";
}

export function adjustBountyRemoveNoneOnList(): string {
  return "They were not being hunted today anyway. Check the shadows.";
}

export function adjustBountyListEmptyAfterRemove(platform: "slack" | "discord", dateLabel: string): string {
  if (platform === "slack") {
    return (
      `*The Great Hunt* — ${dateLabel}\n` +
      `_All prey escaped. The hunt is empty. Use setbounty or \`add\` to find new marks._`
    );
  }
  return (
    `**The Great Hunt** — ${dateLabel}\n` +
    `*All prey escaped. The hunt is empty. Use setbounty or \`add\` to find new marks.*`
  );
}

export function adjustBountyNoMarkForUnclaim(): string {
  return "`unclaim` needs exactly one mark. Who is freed?";
}

export function adjustBountyNotClaimed(markLabel: string): string {
  return `${markLabel} has not been caught today. Nothing to unclaim.`;
}

export function adjustBountyClearNone(): string {
  return "No prey has been caught today. All are still roaming.";
}

export function adjustBountyClaimNeedTwoMentions(): string {
  return "`claim` needs the hunter first, then the prey.";
}

export function adjustBountyMarkNotOnList(markLabel: string): string {
  return `${markLabel} is not part of the Great Hunt today.`;
}

export function adjustBountyClaimSelf(): string {
  return "Nähä. You cannot hunt yourself.";
}

export function adjustBountyPublicUnclaim(platform: "slack" | "discord", params: { dateLabel: string; markName: string }): string {
  if (platform === "slack") {
    return (
      `*Hunt Ledger* — ${params.dateLabel}\n` +
      `The catch on *${params.markName}* was erased. They roam the snow once more.`
    );
  }
  return (
    `**Hunt Ledger** — ${params.dateLabel}\n` +
    `The catch on **${params.markName}** was erased. They roam the snow once more.`
  );
}

export function adjustBountyPublicClear(platform: "slack" | "discord", params: { dateLabel: string; count: number }): string {
  if (platform === "slack") {
    return (
      `*Hunt Ledger* — ${params.dateLabel}\n` +
      `Cleared *${params.count}* catches. The prey are free again.`
    );
  }
  return (
    `**Hunt Ledger** — ${params.dateLabel}\n` +
    `Cleared **${params.count}** catches. The prey are free again.`
  );
}

export function adjustBountyPublicClaim(
  platform: "slack" | "discord",
  params: { dateLabel: string; sniperName: string; markName: string }
): string {
  if (platform === "slack") {
    return (
      `*Hunt Ledger* — ${params.dateLabel}\n` +
      `Manual catch: *${params.sniperName}* brought down *${params.markName}*.`
    );
  }
  return (
    `**Hunt Ledger** — ${params.dateLabel}\n` +
    `Manual catch: **${params.sniperName}** brought down **${params.markName}**.`
  );
}

export function adjustBountySuccessEphemeral(): string {
  return "The hunt ledger was updated in the channel.";
}

export function adjustBountyFailed(context: string, error: string): string {
  return `${context} failed: ${error}`;
}

export function graphViewerNotConfigured(): string {
  return `The graph is blind. Set GRAPH_PUBLIC_BASE_URL so I can see the tracks.`;
}

export function graphCodeEphemeral(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Your key to the shadows: **${params.code}**\n` +
    `Use it within **${params.redeemSeconds} seconds**.\n` +
    `${params.siteUrl}\n`
  );
}

/** Slack mrkdwn (slash / ephemeral); avoids Discord-style **bold**. */
export function graphCodeEphemeralSlack(params: { code: string; siteUrl: string; redeemSeconds: number }): string {
  return (
    `Your key to the shadows: *${params.code}*\n` +
    `Use it within *${params.redeemSeconds} seconds*.\n` +
    `${params.siteUrl}\n`
  );
}

/** Discord slash command descriptions (short, her register). */
export const discordSlashDescriptions = {
  help: "The rules of the hunt. Read them.",
  leaderboard: "See who leads the pack today.",
  show_leaderboard: "Show the pack's standings right here.",
  removesnipe: "Erase a bad shot from the snow.",
  makeupsnipe: "Log a catch the shadows missed.",
  adjustelo: "Shift the balance manually. For pack leaders only.",
  setbounty: "Mark today's prey for the Great Hunt.",
  adjustbounty: "Edit the Great Hunt's marks and catches.",
  setsnipechannel: "Mark this ground for the hunt.",
  snipes: "Your recent catches and times you were prey.",
  headtohead: "The history of the pack's clashes.",
  snipeduel: "Challenge another hunter to a duel.",
  bounty: "See the prey marked for the Great Hunt.",
  snipegraph: "Open the map of all tracks in the snow.",
} as const;
