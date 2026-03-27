import { join } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import type { DirectedSnipePairCount } from "./db";
import { collectIdsFromDirectedPairs } from "./headToHead";

/**
 * Skia has no bundled sans fonts; Helvetica/Arial are absent on typical Linux hosts (e.g. Railway),
 * so text would render as empty glyphs. Ship Noto Sans TTFs in `../fonts` and register at runtime.
 */
const H2H_FONT = '"Noto Sans"';
let h2hFontsRegistered = false;

function ensureHeadToHeadCanvasFonts(): void {
  if (h2hFontsRegistered) return;
  const dir = join(__dirname, "..", "fonts");
  GlobalFonts.registerFromPath(join(dir, "NotoSans-Regular.ttf"), "Noto Sans");
  GlobalFonts.registerFromPath(join(dir, "NotoSans-SemiBold.ttf"), "Noto Sans");
  h2hFontsRegistered = true;
}

function truncateLabel(s: string, maxChars: number): string {
  const t = s.replace(/\n/g, " ").trim() || "—";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}

const MAX_HEADER_LABEL_CHARS = 48;

/** Column names are drawn vertically; font size so the longest label fits within maxSpan px. */
function pickColumnHeaderFontSize(
  ctx: { font: string; measureText: (t: string) => { width: number } },
  labels: string[],
  maxSpan: number,
  minPx: number,
  maxPx: number
): number {
  for (let fs = maxPx; fs >= minPx; fs--) {
    ctx.font = `${fs}px ${H2H_FONT}`;
    let w = 0;
    for (const l of labels) {
      w = Math.max(w, ctx.measureText(l).width);
    }
    if (w <= maxSpan) return fs;
  }
  return minPx;
}

/**
 * Rows = snipers, columns = sniped, cell = count (still on the books).
 * Diagonal shows "—" (no self-snipe).
 */
export function renderHeadToHeadMatrixPng(params: {
  pairRows: DirectedSnipePairCount[];
  nameOf: (id: string) => string;
}): Buffer | null {
  const ids = collectIdsFromDirectedPairs(params.pairRows);
  if (ids.length === 0) return null;

  ensureHeadToHeadCanvasFonts();

  const ordered = [...ids].sort((a, b) =>
    params.nameOf(a).localeCompare(params.nameOf(b), "en", { sensitivity: "base" })
  );
  const n = ordered.length;
  const direct = new Map<string, number>();
  for (const r of params.pairRows) {
    direct.set(`${r.sniperId}|${r.snipedId}`, r.count);
  }

  const labels = ordered.map((id) => truncateLabel(params.nameOf(id), MAX_HEADER_LABEL_CHARS));

  const padding = 20;
  const footerH = 24;
  const headerTopH = 26;

  let cellW = 44;
  let cellH = 36;
  let fontSize = 12;
  const maxCanvasW = 3900;
  const rowLabelW = 184;
  const innerW = rowLabelW + n * cellW;
  if (innerW + padding * 2 > maxCanvasW) {
    cellW = Math.max(28, Math.floor((maxCanvasW - padding * 2 - rowLabelW) / Math.max(1, n)));
    cellH = Math.max(24, cellW - 6);
    fontSize = Math.max(9, Math.min(12, Math.floor(cellW / 3.5)));
  }

  const canvasW = Math.min(4096, padding * 2 + rowLabelW + n * cellW);

  const measure = createCanvas(4, 4).getContext("2d")!;
  const maxHeaderSpan = Math.min(400, Math.max(140, Math.floor(n * cellW * 0.45 + 60)));
  const headerFontSize = pickColumnHeaderFontSize(measure, labels, maxHeaderSpan, 8, Math.min(12, fontSize + 1));
  measure.font = `${headerFontSize}px ${H2H_FONT}`;
  let maxLabelWidth = 0;
  for (const l of labels) {
    maxLabelWidth = Math.max(maxLabelWidth, measure.measureText(l).width);
  }
  const headerBodyH = Math.min(420, Math.max(72, Math.ceil(maxLabelWidth + 20)));

  const totalHeaderH = headerTopH + headerBodyH;
  const gridH = totalHeaderH + n * cellH;

  let y = padding;
  y += fontSize + 8;
  y += fontSize + 10;
  y += fontSize + 8;
  const gridTop = y + 18;
  const canvasH = Math.min(4096, gridTop + gridH + padding + footerH);

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  y = padding;
  ctx.font = `600 ${fontSize + 6}px ${H2H_FONT}`;
  ctx.fillStyle = "#1d1c1d";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  y += fontSize + 8;
  ctx.fillText("Head-to-head", canvasW / 2, y);

  ctx.font = `${fontSize}px ${H2H_FONT}`;
  ctx.fillStyle = "#616061";
  y += fontSize + 10;
  ctx.fillText("Snipes still on the books (undone rounds removed).", canvasW / 2, y);

  y += fontSize + 8;
  ctx.fillText("Rows = sniper · Columns = sniped.", canvasW / 2, y);

  const gridTop2 = y + 18;
  const gridLeft = padding;

  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 1;

  const leftHeaderH = totalHeaderH;
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(gridLeft, gridTop2, rowLabelW, leftHeaderH);
  ctx.strokeRect(gridLeft, gridTop2, rowLabelW, leftHeaderH);
  ctx.fillStyle = "#616061";
  ctx.font = `600 ${fontSize - 1}px ${H2H_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Sniper", gridLeft + rowLabelW / 2, gridTop2 + leftHeaderH / 2 - 14);
  ctx.font = `${fontSize - 2}px ${H2H_FONT}`;
  ctx.fillText("(rows)", gridLeft + rowLabelW / 2, gridTop2 + leftHeaderH / 2 + 4);
  ctx.fillStyle = "#8a8886";
  ctx.font = `${Math.max(8, fontSize - 3)}px ${H2H_FONT}`;
  ctx.fillText("who shot →", gridLeft + rowLabelW / 2, gridTop2 + leftHeaderH / 2 + 20);

  const colRegionLeft = gridLeft + rowLabelW;
  const colRegionW = n * cellW;

  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(colRegionLeft, gridTop2, colRegionW, headerTopH);
  ctx.strokeRect(colRegionLeft, gridTop2, colRegionW, headerTopH);
  ctx.fillStyle = "#616061";
  const bandText = colRegionW >= 400 ? "Sniped (columns) — who was shot" : "Sniped (columns)";
  let bandFs = Math.max(9, fontSize - 2);
  ctx.font = `600 ${bandFs}px ${H2H_FONT}`;
  while (ctx.measureText(bandText).width > colRegionW - 16 && bandFs > 7) {
    bandFs -= 1;
    ctx.font = `600 ${bandFs}px ${H2H_FONT}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(bandText, colRegionLeft + colRegionW / 2, gridTop2 + headerTopH / 2);

  const headerBodyTop = gridTop2 + headerTopH;

  for (let j = 0; j < n; j++) {
    const x = colRegionLeft + j * cellW;
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(x, headerBodyTop, cellW, headerBodyH);
    ctx.strokeRect(x, headerBodyTop, cellW, headerBodyH);
    ctx.fillStyle = "#1d1c1d";
    ctx.save();
    const cx = x + cellW / 2;
    const cy = headerBodyTop + headerBodyH / 2;
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `${headerFontSize}px ${H2H_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[j], 0, 0);
    ctx.restore();
  }

  for (let i = 0; i < n; i++) {
    const yRow = headerBodyTop + headerBodyH + i * cellH;
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(gridLeft, yRow, rowLabelW, cellH);
    ctx.strokeRect(gridLeft, yRow, rowLabelW, cellH);
    ctx.fillStyle = "#1d1c1d";
    ctx.font = `${fontSize}px ${H2H_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[i], gridLeft + rowLabelW - 8, yRow + cellH / 2);

    for (let j = 0; j < n; j++) {
      const x = colRegionLeft + j * cellW;
      const text = i === j ? "—" : String(direct.get(`${ordered[i]}|${ordered[j]}`) ?? 0);
      ctx.fillStyle = i === j ? "#f0f0f0" : "#ffffff";
      ctx.fillRect(x, yRow, cellW, cellH);
      ctx.strokeRect(x, yRow, cellW, cellH);
      ctx.fillStyle = "#1d1c1d";
      ctx.textAlign = "center";
      ctx.font = `600 ${fontSize}px ${H2H_FONT}`;
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + cellW / 2, yRow + cellH / 2);
    }
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return canvas.toBuffer("image/png");
}
