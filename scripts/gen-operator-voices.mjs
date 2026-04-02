/**
 * Regenerates src/voice*.ts operator modules from voiceLemuen.ts.
 * Run: node scripts/gen-operator-voices.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const lemuenPath = path.join(root, "src/voiceLemuen.ts");
const base = fs.readFileSync(lemuenPath, "utf8");

function applyReplacements(s, pairs) {
  let out = s;
  for (const [from, to] of pairs) {
    if (!out.includes(from)) {
      throw new Error(`Anchor not found for replacement: ${from.slice(0, 60)}…`);
    }
    out = out.replace(from, to);
  }
  return out;
}

/** Lemuen anchors (unchanged) — first two are help prologue Slack / Discord. */
const LEMUEN_HELP_SLACK =
  `"_April Fools is behind us—I've *reclaimed* my console from my sister's… *enthusiastic* custody. " +\n      "The keys are mine again, the scoring runs *straight*, and undo is back on the books. " +\n      "If anything still looks off, say the word and we'll audit it properly~_"`;
const LEMUEN_HELP_DISCORD =
  `"**April Fools has ended.** I've **retrieved** my console from my sister's brief reign—charming as she was, " +\n    "the board belongs on my desk again. ELO and **removesnipe** behave as usual; if you spot a stray oddity from the holiday, we'll set it right."`;

const ANCHOR_SNIPER_HIT = `return \`Target accounted for. \${params.sniperLabel} may take the credit—the rest is bookkeeping.\`;`;
const ANCHOR_MAKEUP_DISCORD = `return \`Mission accomplished—after a fashion. A makeup snipe is filed under \${params.sniperLabel}; the records are thorough, you see.\`;`;
const ANCHOR_MAKEUP_SLACK = `return \`Mission accomplished. A makeup snipe is filed under \${params.sniperLabel}; the records are thorough, you see.\`;`;
const ANCHOR_EXCHANGE = `return "Exchange of fire:";`;
const ANCHOR_STANDINGS = `return "Standings—for the moment:";`;
const ANCHOR_WRONG_CH = `return \`We're not in the nest I use for that. Would you mind running it in \${channelRef}? I only keep score from the lane I've mapped.\`;`;
const ANCHOR_SERVER = `return \`This place isn't on my chart yet—no snipe lane drawn. Someone with the keys will need to wire that up first.\`;`;
const ANCHOR_BOARD_QUIET = `return "_The board's quiet—no scores yet. That can change in a heartbeat._";`;
const ANCHOR_HELP_DESC = `  help: "Open the field manual: commands, rules, and the quick paths.",`;
const ANCHOR_LB_DESC = `  leaderboard: "Survey the standings—who's ahead today?",`;
const ANCHOR_MAKEUP_ROOT = `return \`\${callerDisplayName} called \\\`\${slashCommand}\\\`. The paperwork follows in the thread~\`;`;
const ANCHOR_MAKEUP_OK = `return \`Logged. You'll find the full reckoning threaded under that new message—kindly look it over when you're free.\`;`;
const ANCHOR_ADJUST_OK = `return \`The books are updated and the canvas refreshed. Try to keep things sporting—shall we call that settled?\`;`;
const ANCHOR_UNDO_EMPTY = `return \`Nothing to undo here. The page is either already clean, or we're reading the wrong one.\`;`;
const ANCHOR_UNDO_ACK = `return \`Done. I've left the particulars in the thread—review them when you have a moment.\`;`;
const ANCHOR_ADJUST_FORBIDDEN = `return \`That lever isn't on your console—manual ELO edits aren't for this seat. Kindly leave the bookkeeping to those authorized.\`;`;

const operators = [
  {
    file: "voiceFartooth.ts",
    header: `/**
 * Fartooth (Arknights): quiet, earnest, a little hesitant—long range, long pauses, carries duty heavily.
 * Metaphors: distance, sightlines, keeping watch, not wanting to disappoint the squad.
 * @see https://arknights.wiki.gg/wiki/Fartooth/Dialogue
 * @see https://arknights.wiki.gg/wiki/Fartooth/Story
 * @see https://arknights.wiki.gg/wiki/Fartooth/File
 */
`,
    pairs: [
      [
        LEMUEN_HELP_SLACK,
        `"_I'm on the long scope for this server—commands and rules sit below. " +\n      "If a line reads wrong from far away, tell me and I'll adjust the sight picture~_"`,
      ],
      [
        LEMUEN_HELP_DISCORD,
        `"**Long-range dispatch.** Commands, rules, and the snipe lane are below—say the word if something drifts off zero."`,
      ],
      [
        ANCHOR_SNIPER_HIT,
        `return \`…Hit confirmed. \${params.sniperLabel} is credited—I logged the rest before I second-guess myself.\`;`,
      ],
      [ANCHOR_MAKEUP_DISCORD, `return \`Makeup snipe… filed under \${params.sniperLabel}. I double-checked the paperwork—it's all there.\`;`],
      [ANCHOR_MAKEUP_SLACK, `return \`Makeup snipe logged for \${params.sniperLabel}. The record is complete… if I didn't miss a line.\`;`],
      [ANCHOR_EXCHANGE, `return "Exchange of fire—range and timing:";`],
      [ANCHOR_STANDINGS, `return "Standings from this vantage—for now:";`],
      [
        ANCHOR_WRONG_CH,
        `return \`This isn't the nest I'm calibrated for. Could we run it in \${channelRef}? I only trust the lane I've sighted in.\`;`,
      ],
      [ANCHOR_SERVER, `return \`I don't have this place on my chart yet—no lane staked. Someone with keys will have to draw it in first…\`;`],
      [ANCHOR_BOARD_QUIET, `return "_The board's empty from here—no shots on record yet. It… it won't stay that way._";`],
      [ANCHOR_HELP_DESC, `  help: "Field brief—commands, rules, lanes. Stay on frequency if you need me.",`],
      [ANCHOR_LB_DESC, `  leaderboard: "Glass the standings—who's holding the high ground today?",`],
      [
        ANCHOR_MAKEUP_ROOT,
        `return \`\${callerDisplayName} called \\\`\${slashCommand}\\\`. I'm threading the record—please read it carefully~\`;`,
      ],
      [
        ANCHOR_MAKEUP_OK,
        `return \`It's logged. The full line-by-line is under that message—when you have a quiet moment.\`;`,
      ],
      [ANCHOR_ADJUST_OK, `return \`Canvas and books updated. Let's… call that square, if it's all right.\`;`],
      [ANCHOR_UNDO_EMPTY, `return \`Nothing to erase here—either it's clean or we're on the wrong page.\`;`],
      [ANCHOR_UNDO_ACK, `return \`Undone. Details are in the thread—I'll stand by if the numbers still itch.\`;`],
      [
        ANCHOR_ADJUST_FORBIDDEN,
        `return \`That lever isn't yours—manual ELO is for the people who hold the real keys. I'm sorry.\`;`,
      ],
    ],
  },
  {
    file: "voiceWisadel.ts",
    header: `/**
 * Wiš'adel / "W" (Arknights): gleeful chaos, darling, bombs and punchlines—sharp teeth behind the smile.
 * @see https://arknights.wiki.gg/wiki/Wi%C5%A1%27adel/Dialogue
 * @see https://arknights.wiki.gg/wiki/W/Story
 * @see https://arknights.wiki.gg/wiki/Wi%C5%A1%27adel/File
 */
`,
    pairs: [
      [
        LEMUEN_HELP_SLACK,
        `"_Hey *Darling*—field manual's below. Try not to blow the UX; I'll cackle either way~_"`,
      ],
      [
        LEMUEN_HELP_DISCORD,
        `"**Briefing, Darling.** Rules and commands live down here—handle with care (or don't; I'm entertained either way)."`,
      ],
      [ANCHOR_SNIPER_HIT, `return \`Tagged. \${params.sniperLabel} keeps the glory; I keep the receipts~\`;`],
      [ANCHOR_MAKEUP_DISCORD, `return \`Makeup's in the file under \${params.sniperLabel}—paperwork's *chef's kiss*, promise~\`;`],
      [ANCHOR_MAKEUP_SLACK, `return \`Makeup snipe? Logged under \${params.sniperLabel}. Don't make me forge it twice~\`;`],
      [ANCHOR_EXCHANGE, `return "Detonation tally:";`],
      [ANCHOR_STANDINGS, `return "Who's still standing:";`],
      [
        ANCHOR_WRONG_CH,
        `return \`Wrong zip code, Darling—this ain't my nest. Run it in \${channelRef} or I'm not touching the fuse.\`;`,
      ],
      [ANCHOR_SERVER, `return \`No lane on my map—someone with admin keys needs to wire the fun zone first.\`;`],
      [ANCHOR_BOARD_QUIET, `return "_Board's quiet—like before the surprise party. Give it a minute, Darling._";`],
      [ANCHOR_HELP_DESC, `  help: "Manual of mayhem: rules, commands, where not to drop the C4 (metaphorically).",`],
      [ANCHOR_LB_DESC, `  leaderboard: "Who's king of the hill today—peek the board.",`],
      [
        ANCHOR_MAKEUP_ROOT,
        `return \`\${callerDisplayName} pulled \\\`\${slashCommand}\\\`—paper trail's in the thread, try to keep up~\`;`,
      ],
      [ANCHOR_MAKEUP_OK, `return \`Logged, Darling—full mess is threaded; bring popcorn~\`;`],
      [ANCHOR_ADJUST_OK, `return \`Books and canvas: *boom*, updated. Try not to make me audit you~\`;`],
      [ANCHOR_UNDO_EMPTY, `return \`Zip to undo—wrong page or already pristine, pick your flavor~\`;`],
      [ANCHOR_UNDO_ACK, `return \`Undone! Story's in the thread—apple pie's optional~\`;`],
      [
        ANCHOR_ADJUST_FORBIDDEN,
        `return \`That sweet little lever? Not for you, Darling—authorized hands only~\`;`,
      ],
    ],
  },
  {
    file: "voiceTyphon.ts",
    header: `/**
 * Typhon (Arknights): blunt, serious Sami hunter energy—few words, big bow, no patience for nonsense.
 * @see https://arknights.wiki.gg/wiki/Typhon/Dialogue
 * @see https://arknights.wiki.gg/wiki/Typhon/Story
 * @see https://arknights.wiki.gg/wiki/Typhon/File
 */
`,
    pairs: [
      [
        LEMUEN_HELP_SLACK,
        `"_Rules below. Read them. If the count lies, say so._"`,
      ],
      [
        LEMUEN_HELP_DISCORD,
        `"**Below:** commands and rules. Wrong numbers get corrected."`,
      ],
      [ANCHOR_SNIPER_HIT, `return \`Prey marked. \${params.sniperLabel} takes the kill credit—the tally is logged.\`;`],
      [ANCHOR_MAKEUP_DISCORD, `return \`Makeup snipe recorded under \${params.sniperLabel}. The ledger is complete.\`;`],
      [ANCHOR_MAKEUP_SLACK, `return \`Makeup snipe: filed under \${params.sniperLabel}. Done.\`;`],
      [ANCHOR_EXCHANGE, `return "Hits landed:";`],
      [ANCHOR_STANDINGS, `return "Standings—current:";`],
      [ANCHOR_WRONG_CH, `return \`Wrong ground. Use \${channelRef}—that's the lane I track.\`;`],
      [ANCHOR_SERVER, `return \`No snipe lane here yet. Someone with keys sets it first.\`;`],
      [ANCHOR_BOARD_QUIET, `return "_No blood on the snow yet—board's empty._";`],
      [ANCHOR_HELP_DESC, `  help: "Commands and rules—read before you shoot.",`],
      [ANCHOR_LB_DESC, `  leaderboard: "Standings—who leads the hunt today?",`],
      [
        ANCHOR_MAKEUP_ROOT,
        `return \`\${callerDisplayName} invoked \\\`\${slashCommand}\\\`. Details trail in the thread.\`;`,
      ],
      [ANCHOR_MAKEUP_OK, `return \`Recorded. Thread has the rest.\`;`],
      [ANCHOR_ADJUST_OK, `return \`Adjusted. Canvas matches the books.\`;`],
      [ANCHOR_UNDO_EMPTY, `return \`Nothing here to strike—wrong trail or already cleared.\`;`],
      [ANCHOR_UNDO_ACK, `return \`Reversed. See the thread.\`;`],
      [
        ANCHOR_ADJUST_FORBIDDEN,
        `return \`You don't touch that rating. Authorized only.\`;`,
      ],
    ],
  },
  {
    file: "voiceRay.ts",
    header: `/**
 * Ray / Iwona Goldenlobster (Arknights): sunny Kazimierz racer energy—warm, casual, a little flashy, "we've got this!"
 * @see https://arknights.wiki.gg/wiki/Ray/Dialogue
 * @see https://arknights.wiki.gg/wiki/Ray/Story
 * @see https://arknights.wiki.gg/wiki/Ray/File
 */
`,
    pairs: [
      [
        LEMUEN_HELP_SLACK,
        `"_Pit wall's open—commands and rules in the next blocks. Wave if a lap time looks bogus~_"`,
      ],
      [
        LEMUEN_HELP_DISCORD,
        `"**Pit note:** everything you need is below—holler if the scoring looks off."`,
      ],
      [ANCHOR_SNIPER_HIT, `return \`That's a finish—\${params.sniperLabel} takes the credit! I've got the splits on file~\`;`],
      [ANCHOR_MAKEUP_DISCORD, `return \`Makeup snipe filed under \${params.sniperLabel}—paperwork's polished, we're good!\`;`],
      [ANCHOR_MAKEUP_SLACK, `return \`Makeup snipe logged for \${params.sniperLabel}—all tidy in the binder~\`;`],
      [ANCHOR_EXCHANGE, `return "Split times — exchange:";`],
      [ANCHOR_STANDINGS, `return "Leaderboard snapshot:";`],
      [
        ANCHOR_WRONG_CH,
        `return \`Whoa, wrong pit—I'm only timing the official lane. Hop over to \${channelRef}!\`;`,
      ],
      [ANCHOR_SERVER, `return \`Track's not on the schedule yet—mods need to lay the snipe lane in first!\`;`],
      [ANCHOR_BOARD_QUIET, `return "_Quiet grid—nobody's posted a time yet. First one's gonna feel *chef's kiss*._";`],
      [ANCHOR_HELP_DESC, `  help: "Pit manual: commands, rules, how we keep score fair.",`],
      [ANCHOR_LB_DESC, `  leaderboard: "Who's P1 on the board today?",`],
      [
        ANCHOR_MAKEUP_ROOT,
        `return \`\${callerDisplayName} called \\\`\${slashCommand}\\\`—full telemetry's threading now~\`;`,
      ],
      [ANCHOR_MAKEUP_OK, `return \`On the board! Check the thread for the pretty version~\`;`],
      [ANCHOR_ADJUST_OK, `return \`Numbers updated, canvas refreshed—we're green~\`;`],
      [ANCHOR_UNDO_EMPTY, `return \`No lap to scrub—either clean sheet or wrong garage~\`;`],
      [ANCHOR_UNDO_ACK, `return \`Undone—story's in the thread, grab a drink~\`;`],
      [
        ANCHOR_ADJUST_FORBIDDEN,
        `return \`That adjust is crew-chief only—hands off the torque wrench~\`;`,
      ],
    ],
  },
  {
    file: "voiceNarantuya.ts",
    header: `/**
 * Narantuya (Arknights): proud, direct, steppe archer cadence—honor the shot, waste no words.
 * @see https://arknights.wiki.gg/wiki/Narantuya/Dialogue
 * @see https://arknights.wiki.gg/wiki/Narantuya/Story
 * @see https://arknights.wiki.gg/wiki/Narantuya/File
 */
`,
    pairs: [
      [
        LEMUEN_HELP_SLACK,
        `"_Camp laws are writ below—honor the shot; waste no arrows on confusion._"`,
      ],
      [
        LEMUEN_HELP_DISCORD,
        `"**Under the banner:** commands and rules. A crooked tally gets fixed."`,
      ],
      [ANCHOR_SNIPER_HIT, `return \`The quarry is marked. \${params.sniperLabel} owns the shot—the count is written.\`;`],
      [ANCHOR_MAKEUP_DISCORD, `return \`A late arrow is logged under \${params.sniperLabel}. The record stands.\`;`],
      [ANCHOR_MAKEUP_SLACK, `return \`Makeup snipe—filed under \${params.sniperLabel}. No loose feathers.\`;`],
      [ANCHOR_EXCHANGE, `return "Arrows spent:";`],
      [ANCHOR_STANDINGS, `return "Standings on the wind—now:";`],
      [
        ANCHOR_WRONG_CH,
        `return \`Wrong camp. Take it to \${channelRef}—I only count from the lane I chose.\`;`,
      ],
      [ANCHOR_SERVER, `return \`No snipe circle drawn here. Someone with authority must stake it first.\`;`],
      [ANCHOR_BOARD_QUIET, `return "_The grass is still—no shots counted yet._";`],
      [ANCHOR_HELP_DESC, `  help: "The camp laws: commands, rules, how we tally honor.",`],
      [ANCHOR_LB_DESC, `  leaderboard: "Who rides highest in the tally today?",`],
      [
        ANCHOR_MAKEUP_ROOT,
        `return \`\${callerDisplayName} sounded \\\`\${slashCommand}\\\`—the tally follows in the thread.\`;`,
      ],
      [ANCHOR_MAKEUP_OK, `return \`Written. The thread holds the full reckoning.\`;`],
      [ANCHOR_ADJUST_OK, `return \`The books moved; the canvas knows. So be it.\`;`],
      [ANCHOR_UNDO_EMPTY, `return \`No knot to cut—already clear or the wrong fire.\`;`],
      [ANCHOR_UNDO_ACK, `return \`Struck from the record. Read the thread.\`;`],
      [
        ANCHOR_ADJUST_FORBIDDEN,
        `return \`That bow isn't yours to draw—only the appointed may bend ratings.\`;`,
      ],
    ],
  },
  {
    file: "voicePozemka.ts",
    header: `/**
 * Pozëmka (Arknights): novelist meta-voice—dramatic, literary, scenes and chapters; ink and margins.
 * @see https://arknights.wiki.gg/wiki/Poz%C3%ABmka/Dialogue
 * @see https://arknights.wiki.gg/wiki/Poz%C3%ABmka/Story
 * @see https://arknights.wiki.gg/wiki/Poz%C3%ABmka/File
 */
`,
    pairs: [
      [
        LEMUEN_HELP_SLACK,
        `"_The prologue ends here; the next scenes are commands and rules—footnotes on request~_"`,
      ],
      [
        LEMUEN_HELP_DISCORD,
        `"**Front matter closed.** Commands and rules follow—the author reserves the right to revise typos."`,
      ],
      [ANCHOR_SNIPER_HIT, `return \`Scene: resolved. \${params.sniperLabel} is credited in the margin; the footnotes write themselves.\`;`],
      [
        ANCHOR_MAKEUP_DISCORD,
        `return \`A belated chapter is filed under \${params.sniperLabel}—the archive accepts late submissions, within reason.\`;`,
      ],
      [ANCHOR_MAKEUP_SLACK, `return \`Makeup snipe—indexed under \${params.sniperLabel}. The prose is… serviceable.\`;`],
      [ANCHOR_EXCHANGE, `return "Passage — exchange of fire:";`],
      [ANCHOR_STANDINGS, `return "Dramatis personae — ratings:";`],
      [
        ANCHOR_WRONG_CH,
        `return \`This isn't my study. Continue in \${channelRef}—I only annotate the lane I've chosen.\`;`,
      ],
      [
        ANCHOR_SERVER,
        `return \`No setting established—no snipe lane on the page. An editor with keys must sketch it in.\`;`,
      ],
      [ANCHOR_BOARD_QUIET, `return "_Blank page—no scores yet. The plot thickens shortly._";`],
      [ANCHOR_HELP_DESC, `  help: "Front matter: commands, rules, and the narrative contract.",`],
      [ANCHOR_LB_DESC, `  leaderboard: "Which name leads the dramatis personae today?",`],
      [
        ANCHOR_MAKEUP_ROOT,
        `return \`\${callerDisplayName} invoked \\\`\${slashCommand}\\\`—the subplot continues in the thread~\`;`,
      ],
      [ANCHOR_MAKEUP_OK, `return \`Logged. The director's cut is threaded beneath.\`;`],
      [ANCHOR_ADJUST_OK, `return \`Revision accepted; the canvas reflects the latest draft.\`;`],
      [ANCHOR_UNDO_EMPTY, `return \`No passage to strike—already excised or wrong volume.\`;`],
      [ANCHOR_UNDO_ACK, `return \`Redacted with care. Consult the thread.\`;`],
      [
        ANCHOR_ADJUST_FORBIDDEN,
        `return \`That emendation is for the publisher's hand—not this galley proof.\`;`,
      ],
    ],
  },
  {
    file: "voiceChenHolungday.ts",
    header: `/**
 * Ch'en the Holungday (Arknights): off-duty Lungmen law—relaxed, vacation shorts energy, still sharp underneath.
 * @see https://arknights.wiki.gg/wiki/Ch%27en_the_Holungday/Dialogue
 * @see https://arknights.wiki.gg/wiki/Ch%27en/Story
 * @see https://arknights.wiki.gg/wiki/Ch%27en/File
 */
`,
    pairs: [
      [
        LEMUEN_HELP_SLACK,
        `"_I'm *technically* off the clock, but the handbook's below—skim it before you make paperwork for me~_"`,
      ],
      [
        LEMUEN_HELP_DISCORD,
        `"**Vacation mode, barely.** Commands and rules are below—don't make me file a report from the beach."`,
      ],
      [ANCHOR_SNIPER_HIT, `return \`That's a wrap—\${params.sniperLabel} gets the credit. I've filed the boring part too.\`;`],
      [
        ANCHOR_MAKEUP_DISCORD,
        `return \`Makeup snipe logged under \${params.sniperLabel}—paperwork's done, don't make me redo it on vacation time.\`;`,
      ],
      [ANCHOR_MAKEUP_SLACK, `return \`Makeup snipe for \${params.sniperLabel}—filed. All above board.\`;`],
      [ANCHOR_EXCHANGE, `return "Incident summary:";`],
      [ANCHOR_STANDINGS, `return "Standings — for now:";`],
      [
        ANCHOR_WRONG_CH,
        `return \`Wrong beach—I'm only working \${channelRef}. Humor me.\`;`,
      ],
      [ANCHOR_SERVER, `return \`No snipe lane configured—someone with mod keys needs to set it up first.\`;`],
      [ANCHOR_BOARD_QUIET, `return "_Quiet shift—nobody on the board yet. Give it time._";`],
      [ANCHOR_HELP_DESC, `  help: "Briefing pack: commands, rules, where the snipe lane is.",`],
      [ANCHOR_LB_DESC, `  leaderboard: "Who's top of the docket today?",`],
      [
        ANCHOR_MAKEUP_ROOT,
        `return \`\${callerDisplayName} opened \\\`\${slashCommand}\\\`—incident notes follow in the thread.\`;`,
      ],
      [ANCHOR_MAKEUP_OK, `return \`Filed. Thread has the rest—try to keep it civil.\`;`],
      [ANCHOR_ADJUST_OK, `return \`Adjusted. Canvas matches—let's not drag this out.\`;`],
      [ANCHOR_UNDO_EMPTY, `return \`Nothing to dismiss—wrong file or already closed.\`;`],
      [ANCHOR_UNDO_ACK, `return \`Undone. Particulars are in the thread.\`;`],
      [
        ANCHOR_ADJUST_FORBIDDEN,
        `return \`That's above your rank—manual ELO is for the people with the badge.\`;`,
      ],
    ],
  },
];

const headerRe = /^\/\*\*[\s\S]*?\*\/\s*\n/;

const commonPairs = [
  [
    `/** Extra lines under the help title (post\u2013April Fools: console back from her sister's little holiday). */`,
    `/** Short intro line under the /help title. */`,
  ],
];

for (const op of operators) {
  let body = base.replace(headerRe, op.header + "\n");
  body = applyReplacements(body, [...commonPairs, ...op.pairs]);
  fs.writeFileSync(path.join(root, "src", op.file), body);
  console.log("wrote", op.file);
}
