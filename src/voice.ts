/**
 * Resolves bot copy: default Lemuen (`voiceLemuen`), or Exusiai as alt operator voice.
 * Set `BOT_VOICE=exusiai` (aliases: `april`, `april_fools`, `aprilfools`).
 *
 * Additional voice modules (same export surface as `voiceLemuen`; not wired here yet):
 * `voiceFartooth`, `voiceWisadel`, `voiceTyphon`, `voiceRay`, `voiceNarantuya`, `voicePozemka`, `voiceChenHolungday`.
 * Regenerate from Lemuen via `node scripts/gen-operator-voices.mjs` after editing anchors in that script.
 */
import * as lemuen from "./voiceLemuen";
import * as exusiai from "./voiceExusiai";

const raw = (process.env.BOT_VOICE ?? "").trim().toLowerCase();

/** True when `BOT_VOICE` selects Exusiai (playful copy, mirrored snipe *confirmation* display, `removesnipe` off; DB keeps normal ELO). */
export function isExusiaiVoiceActive(): boolean {
  return (
    raw === "exusiai" || raw === "april" || raw === "april_fools" || raw === "aprilfools"
  );
}

const useExusiai = isExusiaiVoiceActive();

/** Both modules mirror the same API; `as const` descriptions differ only by string literals at compile time. */
export const L = (useExusiai ? exusiai : lemuen) as typeof lemuen;
