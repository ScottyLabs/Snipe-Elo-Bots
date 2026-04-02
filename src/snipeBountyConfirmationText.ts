/**
 * Voice-neutral bounty copy on snipe confirmations (Slack + Discord).
 * Shared by every operator module so the bounty hit is obvious regardless of which voice is active.
 */

export function snipeConfirmationBountySectionTitle(singleExchange: boolean): string {
  if (singleExchange) {
    return (
      "*BOUNTY CLAIMED — 2× ELO*\n" +
      "This snipe hit someone on today's *daily bounty* list as the *first snipe on them today* — double ELO applies to the pair below."
    );
  }
  return (
    "*BOUNTY CLAIMED — 2× ELO*\n" +
    "At least one snipe hit a *daily bounty* mark as the *first snipe on that person today* — double ELO applies to each bounty pair below."
  );
}

export function snipeConfirmationBountySectionTitleDiscord(singleExchange: boolean): string {
  if (singleExchange) {
    return (
      "**BOUNTY CLAIMED — 2× ELO**\n" +
      "This snipe hit someone on today's **daily bounty** list as the **first snipe on them today** — double ELO applies to the pair below."
    );
  }
  return (
    "**BOUNTY CLAIMED — 2× ELO**\n" +
    "At least one snipe hit a **daily bounty** mark as the **first snipe on that person today** — double ELO applies to each bounty pair below."
  );
}

export function snipeConfirmationBountyExchangeDetail(platform: "slack" | "discord"): string {
  if (platform === "slack") {
    return " — _BOUNTY HIT: sniped player was on today's list — 2× ELO (first snipe on them today)._";
  }
  return " — *BOUNTY HIT: sniped player was on today's list — 2× ELO (first snipe on them today).*";
}
