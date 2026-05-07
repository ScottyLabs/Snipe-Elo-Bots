/* global fetch */

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  let j = {};
  try {
    j = await r.json();
  } catch (_e) {
    /* ignore */
  }
  if (!r.ok) {
    const msg = typeof j.error === "string" ? j.error : r.statusText || "error";
    throw new Error(msg);
  }
  return j;
}

function formatClosed(ts) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch (_e) {
    return "—";
  }
}

function medalClass(rank) {
  if (rank === 1) return "medal-1";
  if (rank === 2) return "medal-2";
  if (rank === 3) return "medal-3";
  return "";
}

function renderCycle(c) {
  const rows = (c.snapshot || [])
    .map(function (row) {
      return (
        "<tr>" +
        '<td class="hall-rank ' +
        medalClass(row.rank) +
        '">' +
        escHtml(row.rank) +
        "</td>" +
        "<td>" +
        escHtml(row.displayName || row.playerId) +
        "</td>" +
        '<td class="hall-rating">' +
        escHtml(String(row.rating)) +
        "</td>" +
        '<td class="muted">' +
        escHtml(row.playerId) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  const rewardsBlock =
    c.rewardsText && String(c.rewardsText).trim()
      ? '<div class="hall-rewards"><div class="hall-rewards-label">Rewards / notes</div>' +
        escHtml(c.rewardsText) +
        "</div>"
      : "";

  const sub = c.subtitle ? "<p class=\"muted\">" + escHtml(c.subtitle) + "</p>" : "";

  return (
    '<article class="hall-cycle">' +
    "<h2>" +
    escHtml(c.title) +
    "</h2>" +
    '<p class="hall-cycle-meta">Closed ' +
    escHtml(formatClosed(c.closedAt)) +
    " · snapshot at archive time</p>" +
    sub +
    rewardsBlock +
    '<div class="hall-table-wrap"><table class="hall-table" aria-label="Standings snapshot">' +
    "<thead><tr><th>#</th><th>Player</th><th>ELO</th><th>ID</th></tr></thead>" +
    "<tbody>" +
    (rows || "<tr><td colspan=\"4\" class=\"muted\">Empty snapshot.</td></tr>") +
    "</tbody></table></div>" +
    "</article>"
  );
}

async function loadCycles() {
  const data = await fetchJson("/api/hof/cycles");
  const cycles = data.cycles || [];
  var gn = typeof data.guildName === "string" && data.guildName ? data.guildName : "this server";
  document.getElementById("guildLine").textContent =
    (cycles.length ? cycles.length + " archived cycle" + (cycles.length === 1 ? "" : "s") : "No cycles yet") +
    " · " +
    gn;
  const wrap = document.getElementById("cycles");
  const empty = document.getElementById("emptyHint");
  if (cycles.length) {
    empty.classList.add("hidden");
    wrap.innerHTML = cycles.map(renderCycle).join("");
  } else {
    empty.classList.remove("hidden");
    wrap.innerHTML = "";
  }
  document.getElementById("main").classList.remove("hidden");
}

async function boot() {
  await loadCycles();
}

boot();
