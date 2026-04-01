/**
 * Resolves bot copy: default Lemuen (`voiceLemuen`), or Exusiai for April Fools / alt deploys.
 * Set `BOT_VOICE=exusiai` (or `april`, `april_fools`, `aprilfools`).
 */
import * as lemuen from "./voiceLemuen";
import * as exusiai from "./voiceExusiai";

const raw = (process.env.BOT_VOICE ?? "").trim().toLowerCase();

/** True when `BOT_VOICE` selects Exusiai (also used to reverse snipe ELO in `applySnipe`). */
export function isExusiaiVoiceActive(): boolean {
  return (
    raw === "exusiai" || raw === "april" || raw === "april_fools" || raw === "aprilfools"
  );
}

const useExusiai = isExusiaiVoiceActive();

/** Both modules mirror the same API; `as const` descriptions differ only by string literals at compile time. */
export const L = (useExusiai ? exusiai : lemuen) as typeof lemuen;
