import { createCanvas } from "@napi-rs/canvas";
import type { DirectedSnipePairCount } from "./db";
import { collectIdsFromDirectedPairs } from "./headToHead";

function truncateLabel(s: string, maxChars: number): string {
  const t = s.replace(/\n/g, " ").trim() || "—";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
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

  const ordered = [...ids].sort((a, b) =>
    params.nameOf(a).localeCompare(params.nameOf(b), "en", { sensitivity: "base" })
  );
  const n = ordered.length;
  const direct = new Map<string, number>();
  for (const r of params.pairRows) {
    direct.set(`${r.sniperId}|${r.snipedId}`, r.count);
  }

  const labels = ordered.map((id) => truncateLabel(params.nameOf(id), 22));

  const padding = 20;
  const titleBlock = 56;
  const rowLabelW = 168;
  const headerH = 72;
  const footerH = 24;

  let cellW = 44;
  let cellH = 36;
  let fontSize = 12;
  const maxCanvasW = 3900;
  const innerW = rowLabelW + n * cellW;
  if (innerW + padding * 2 > maxCanvasW) {
    cellW = Math.max(26, Math.floor((maxCanvasW - padding * 2 - rowLabelW) / Math.max(1, n)));
    cellH = Math.max(24, cellW - 6);
    fontSize = Math.max(9, Math.min(12, Math.floor(cellW / 3.5)));
  }

  const gridH = headerH + n * cellH;
  const gridW = rowLabelW + n * cellW;
  const canvasW = Math.min(4096, padding * 2 + gridW);
  const canvasH = Math.min(4096, padding * 2 + titleBlock + gridH + footerH);

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = "#1d1c1d";
  ctx.font = `600 ${fontSize + 6}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Head-to-head", canvasW / 2, padding + fontSize + 8);

  ctx.font = `${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#616061";
  ctx.fillText("Snipes still on the books (undone rounds removed).", canvasW / 2, padding + fontSize * 2 + 16);

  const gridTop = padding + titleBlock;
  const gridLeft = padding;

  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(gridLeft, gridTop, rowLabelW, headerH);
  ctx.strokeRect(gridLeft, gridTop, rowLabelW, headerH);
  ctx.fillStyle = "#616061";
  ctx.font = `600 ${fontSize - 1}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Sniper", gridLeft + rowLabelW / 2, gridTop + headerH / 2 - 8);
  ctx.font = `${fontSize - 2}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillText("(rows)", gridLeft + rowLabelW / 2, gridTop + headerH / 2 + 10);

  for (let j = 0; j < n; j++) {
    const x = gridLeft + rowLabelW + j * cellW;
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(x, gridTop, cellW, headerH);
    ctx.strokeRect(x, gridTop, cellW, headerH);
    ctx.fillStyle = "#1d1c1d";
    ctx.font = `${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.save();
    const cx = x + cellW / 2;
    const cy = gridTop + headerH / 2;
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[j], 4, 0);
    ctx.restore();
  }

  for (let i = 0; i < n; i++) {
    const y = gridTop + headerH + i * cellH;
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(gridLeft, y, rowLabelW, cellH);
    ctx.strokeRect(gridLeft, y, rowLabelW, cellH);
    ctx.fillStyle = "#1d1c1d";
    ctx.font = `${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(labels[i], gridLeft + rowLabelW - 8, y + cellH / 2);

    for (let j = 0; j < n; j++) {
      const x = gridLeft + rowLabelW + j * cellW;
      const text = i === j ? "—" : String(direct.get(`${ordered[i]}|${ordered[j]}`) ?? 0);
      ctx.fillStyle = i === j ? "#f0f0f0" : "#ffffff";
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeRect(x, y, cellW, cellH);
      ctx.fillStyle = "#1d1c1d";
      ctx.textAlign = "center";
      ctx.font = `600 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillText(text, x + cellW / 2, y + cellH / 2);
    }
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return canvas.toBuffer("image/png");
}
