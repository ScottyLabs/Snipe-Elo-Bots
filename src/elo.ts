import { eloEnv } from "./eloEnv";

export function expectedScore(playerRating: number, opponentRating: number): number {
  // Standard Elo expected score formula.
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function computeEloDelta(params: {
  playerRating: number;
  opponentRating: number;
  score: 0 | 1;
}): number {
  const { playerRating, opponentRating, score } = params;
  const expected = expectedScore(playerRating, opponentRating);
  const rawDelta = eloEnv.kFactor * (score - expected);
  // Keep ratings integer for simplicity.
  return Math.round(rawDelta);
}

export function computePairRatingDeltas(params: {
  sniperRating: number;
  snipedRating: number;
}): { sniperDelta: number; snipedDelta: number } {
  // Single place to modify the ELO rules for a "sniper beats sniped" pair.
  //
  // If you change this function, the rest of the bot (logging/undo/canvas)
  // will automatically follow, since it only uses the deltas returned here.
  const sniperDelta = computeEloDelta({
    playerRating: params.sniperRating,
    opponentRating: params.snipedRating,
    score: 1,
  });
  const snipedDelta = -sniperDelta;
  return { sniperDelta, snipedDelta };
}

