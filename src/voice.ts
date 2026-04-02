/**
 * Resolves bot copy.
 * Set `BOT_VOICE` to one of the supported operators.
 */
import * as lemuen from "./voiceLemuen";
import * as exusiai from "./voiceExusiai";
import * as fartooth from "./voiceFartooth";
import * as wisadel from "./voiceWisadel";
import * as typhon from "./voiceTyphon";
import * as ray from "./voiceRay";
import * as narantuya from "./voiceNarantuya";
import * as pozemka from "./voicePozemka";
import * as chenHolungday from "./voiceChenHolungday";

const raw = (process.env.BOT_VOICE ?? "").trim().toLowerCase();

/** True when `BOT_VOICE` selects Exusiai (playful copy, mirrored snipe *confirmation* display, `removesnipe` off; DB keeps normal ELO). */
export function isExusiaiVoiceActive(): boolean {
  return (
    raw === "exusiai" || raw === "april" || raw === "april_fools" || raw === "aprilfools"
  );
}

function resolveVoiceModule() {
  switch (raw) {
    case "exusiai":
    case "april":
    case "april_fools":
    case "aprilfools":
      return exusiai;
    case "fartooth":
      return fartooth;
    case "wisadel":
    case "w":
      return wisadel;
    case "typhon":
      return typhon;
    case "ray":
      return ray;
    case "narantuya":
      return narantuya;
    case "pozemka":
      return pozemka;
    case "chen":
    case "chen_holungday":
    case "chenholungday":
      return chenHolungday;
    default:
      return lemuen;
  }
}

export const L = resolveVoiceModule() as typeof lemuen;
