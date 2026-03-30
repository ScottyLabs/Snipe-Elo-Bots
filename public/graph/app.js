/* global vis */
const TOKEN_KEY = "snipeGraphToken";

/**
 * Focal node plus anyone with a direct snipe edge to/from them (either direction).
 * Other players are hidden when a node is selected.
 */
function directEgoNetworkNodeSet(nodeIds, directedEdges, focusId) {
  if (!nodeIds.has(focusId)) return new Set();
  const keep = new Set([focusId]);
  for (const e of directedEdges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue;
    if (e.from === focusId) keep.add(e.to);
    else if (e.to === focusId) keep.add(e.from);
  }
  return keep;
}

let network = null;
let fullNodes = [];
let fullEdges = [];
let guildName = "";
/** Global ELO rank (1-based) from last full graph load; ties break by player id like the server. */
let fullNodeRankById = new Map();
let fullNodeRankCount = 0;

function ordinalPlace(n) {
  const j = n % 10;
  const k = n % 100;
  if (k >= 11 && k <= 13) return n + "th";
  if (j === 1) return n + "st";
  if (j === 2) return n + "nd";
  if (j === 3) return n + "rd";
  return n + "th";
}

function computeEloRankMap(nodes) {
  const sorted = [...nodes].sort((a, b) => {
    const ra = a.rating != null ? a.rating : Number.NEGATIVE_INFINITY;
    const rb = b.rating != null ? b.rating : Number.NEGATIVE_INFINITY;
    if (rb !== ra) return rb - ra;
    return String(a.id).localeCompare(String(b.id));
  });
  const map = new Map();
  for (let i = 0; i < sorted.length; i++) {
    map.set(sorted[i].id, i + 1);
  }
  return map;
}

/** Vis-network uses \\n in label for two lines; keeps one line when short. */
function displayLabelTwoLines(raw) {
  const name = String(raw).trim();
  const oneLineOk = 15;
  if (name.length <= oneLineOk) return name;

  const maxLine = 18;
  const firstWindow = name.slice(0, Math.min(name.length, maxLine + 8));
  let breakAt = firstWindow.lastIndexOf(" ");
  if (breakAt < 4) {
    breakAt = Math.min(maxLine, name.length - 1);
  }

  const line1 = name.slice(0, breakAt).trim();
  let line2 = name.slice(breakAt).trim().replace(/\s+/g, " ");
  if (!line1) return name.length > maxLine ? name.slice(0, maxLine - 1) + "…" : name;
  if (line2.length > maxLine) {
    line2 = line2.slice(0, maxLine - 1) + "…";
  }
  return line1 + "\n" + line2;
}

const visOpts = {
  physics: {
    enabled: true,
    solver: "forceAtlas2Based",
    forceAtlas2Based: {
      /** More negative ⇒ stronger repulsion between nodes (keeps them apart when close). */
      gravitationalConstant: -130,
      centralGravity: 0.008,
      springLength: 260,
      springConstant: 0.032,
      /** 1 = strongest overlap avoidance in this solver. */
      avoidOverlap: 1,
      damping: 0.55,
    },
    stabilization: { iterations: 280, updateInterval: 25 },
    maxVelocity: 24,
    minVelocity: 0.6,
    timestep: 0.48,
  },
  interaction: {
    hover: true,
    multiselect: false,
    dragNodes: true,
    dragView: true,
    zoomView: true,
    selectConnectedEdges: false,
  },
  nodes: {
    shape: "circle",
    font: { color: "#ffffff", size: 15, face: "Segoe UI, system-ui, sans-serif" },
    borderWidth: 2,
    shadow: { enabled: true, color: "rgba(124,58,237,0.38)", size: 12 },
    scaling: { min: 14, max: 44 },
    chosen: {
      node: function (values, _id, selected, hovering) {
        if (selected || hovering) {
          values.borderWidth = 3;
          values.borderColor = "#a78bfa";
        }
      },
    },
  },
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.65 } },
    color: { color: "rgba(129,140,248,0.45)", highlight: "#60a5fa", hover: "#f87171" },
    font: { color: "#E0E7FF", size: 11, strokeWidth: 0, align: "middle" },
    smooth: { type: "continuous", roundness: 0.35 },
  },
};

/** All players outside the ELO top three (API sets medalRank 1–3 only for them). */
var DEFAULT_NODE_STYLE = { bg: "#252036", border: "#6366f1" };

/** Top 3 by ELO: gold / silver / bronze. */
var MEDAL_STYLES = {
  1: { bg: "#FFD700", border: "#B8860B", hint: "1st · Gold", labelColor: "#1a1206" },
  2: { bg: "#E8E8E8", border: "#708090", hint: "2nd · Silver", labelColor: "#1a1a22" },
  3: { bg: "#CD7F32", border: "#5C3D1E", hint: "3rd · Bronze", labelColor: "#fff8f0" },
};

/** Selected-player view: outgoing = blue; incoming = red. */
var FOCUS_EDGE_STYLES = {
  out: {
    color: "rgba(59,130,246,0.92)",
    highlight: "#93c5fd",
    hover: "#bfdbfe",
    font: "#dbeafe",
  },
  in: {
    color: "rgba(239,68,68,0.92)",
    highlight: "#fca5a5",
    hover: "#fecaca",
    font: "#fee2e2",
  },
};

function buildVisData(nodes, edges, focusId) {
  const vNodes = nodes.map((n) => {
    var medal =
      n.medalRank >= 1 && n.medalRank <= 3 ? MEDAL_STYLES[n.medalRank] : null;
    var c = medal ? { bg: medal.bg, border: medal.border } : DEFAULT_NODE_STYLE;
    var titleExtra = medal ? "\n" + medal.hint : "";
    var placeExtra = "";
    if (!medal && fullNodeRankCount > 0) {
      var rk = fullNodeRankById.get(n.id);
      if (rk != null) {
        placeExtra = "\n" + ordinalPlace(rk) + " of " + fullNodeRankCount + " on the board";
      }
    }
    var title =
      (n.rating != null ? n.label + "\nELO " + n.rating : n.label) + titleExtra + placeExtra;
    var nodeFont = medal
      ? { color: medal.labelColor, size: 15, face: "Segoe UI, system-ui, sans-serif", bold: true }
      : { color: "#ffffff", size: 15, face: "Segoe UI, system-ui, sans-serif" };
    return {
      id: n.id,
      label: displayLabelTwoLines(n.label),
      title,
      font: nodeFont,
      color: {
        background: c.bg,
        border: c.border,
        highlight: { background: "#f8fafc", border: "#8b5cf6" },
      },
    };
  });
  const vEdges = edges.map((e, i) => {
    const baseCount = e.count + " snipe(s)";
    const row = {
      id: "e" + i + "-" + e.from + "-" + e.to,
      from: e.from,
      to: e.to,
      label: String(e.count),
      title: baseCount,
    };
    if (focusId) {
      if (e.from === focusId) {
        const s = FOCUS_EDGE_STYLES.out;
        row.title = baseCount + " · from selected player";
        row.font = { color: s.font, size: 11, strokeWidth: 0, align: "middle" };
        row.color = { color: s.color, highlight: s.highlight, hover: s.hover, inherit: false };
      } else if (e.to === focusId) {
        const s = FOCUS_EDGE_STYLES.in;
        row.title = baseCount + " · to selected player";
        row.font = { color: s.font, size: 11, strokeWidth: 0, align: "middle" };
        row.color = { color: s.color, highlight: s.highlight, hover: s.hover, inherit: false };
      }
    }
    return row;
  });
  return { nodes: new vis.DataSet(vNodes), edges: new vis.DataSet(vEdges) };
}

function applyGraphSubset(focusId) {
  if (!network || !fullNodes.length) return;
  const nodeIdSet = new Set(fullNodes.map((n) => n.id));
  const keep = directEgoNetworkNodeSet(nodeIdSet, fullEdges, focusId);
  const subNodes = fullNodes.filter((n) => keep.has(n.id));
  const subEdges = fullEdges.filter(
    (e) => keep.has(e.from) && keep.has(e.to) && (e.from === focusId || e.to === focusId)
  );
  const data = buildVisData(subNodes, subEdges, focusId);
  network.setData(data);
  network.setOptions({ physics: { enabled: true } });
  network.stabilize();
}

function showFullGraph() {
  if (!network) return;
  const data = buildVisData(fullNodes, fullEdges);
  network.setData(data);
  network.setOptions({ physics: { enabled: true } });
  network.stabilize();
  document.getElementById("panel").classList.add("hidden");
  document.getElementById("resetViewBtn").classList.add("hidden");
}

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

function renderPanel(data) {
  const el = document.getElementById("panel");
  const esc = function (s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };
  const lines = function (items, fmt) {
    if (!items.length) return "<li class='muted'>No records.</li>";
    return items.map(function (x) {
      return "<li>" + fmt(x) + "</li>";
    }).join("");
  };
  const sniperFmt = function (x) {
    return (
      esc(x.at) +
      " — " +
      esc(x.kind) +
      " · sniped " +
      (x.snipedNames || []).map(esc).join(", ") +
      (x.undone ? " <span class='muted'>(undone)</span>" : "")
    );
  };
  const snipedFmt = function (x) {
    return (
      esc(x.at) +
      " — " +
      esc(x.kind) +
      " · by " +
      esc(x.sniperName || "?") +
      (x.undone ? " <span class='muted'>(undone)</span>" : "")
    );
  };
  el.innerHTML =
    "<h2>" +
    esc(data.displayName) +
    "</h2>" +
    "<p class='muted'>" +
    esc(guildName) +
    " · same data as /snipes (last " +
    (data.asSniper ? data.asSniper.length : 0) +
    " / " +
    (data.asSniped ? data.asSniped.length : 0) +
    ")</p>" +
    "<h3>As sniper</h3><ul>" +
    lines(data.asSniper || [], sniperFmt) +
    "</ul><h3>Sniped by</h3><ul>" +
    lines(data.asSniped || [], snipedFmt) +
    "</ul>";
  el.classList.remove("hidden");
}

async function onNodeClick(params) {
  if (params.nodes.length !== 1) return;
  const id = params.nodes[0];
  const token = sessionStorage.getItem(TOKEN_KEY);
  try {
    const data = await fetchJson("/api/graph/player/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + token },
    });
    renderPanel(data);
    applyGraphSubset(id);
    document.getElementById("resetViewBtn").classList.remove("hidden");
  } catch (e) {
    document.getElementById("panel").classList.remove("hidden");
    document.getElementById("panel").innerHTML =
      "<h2>Could not load</h2><p>" + escHtml(e.message) + "</p>";
  }
}

async function loadGraph() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const data = await fetchJson("/api/graph/data", { headers: { Authorization: "Bearer " + token } });
  guildName = data.guildName || "Server";
  fullNodes = data.nodes || [];
  fullEdges = data.edges || [];
  const mount = document.getElementById("graphMount");
  mount.innerHTML = "";
  if (network) {
    network.destroy();
    network = null;
  }
  if (!fullNodes.length) {
    fullNodeRankById = new Map();
    fullNodeRankCount = 0;
    mount.style.display = "flex";
    mount.style.alignItems = "center";
    mount.style.justifyContent = "center";
    mount.style.color = "#fff";
    mount.style.fontSize = "1.05rem";
    mount.style.textAlign = "center";
    mount.style.padding = "2rem";
    mount.textContent = "No directed snipes on the ledger for this server yet.";
    return;
  }
  fullNodeRankById = computeEloRankMap(fullNodes);
  fullNodeRankCount = fullNodes.length;
  mount.style.display = "";
  mount.style.alignItems = "";
  mount.style.justifyContent = "";
  mount.style.color = "";
  mount.style.fontSize = "";
  mount.style.textAlign = "";
  mount.style.padding = "";
  const visData = buildVisData(fullNodes, fullEdges);
  network = new vis.Network(mount, visData, visOpts);
  network.on("click", onNodeClick);
}

async function redeem() {
  const code = document.getElementById("codeInput").value.trim();
  const err = document.getElementById("loginErr");
  err.textContent = "";
  if (!code) {
    err.textContent = "Enter a code.";
    return;
  }
  const btn = document.getElementById("unlockBtn");
  btn.disabled = true;
  try {
    const out = await fetchJson("/api/graph/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    sessionStorage.setItem(TOKEN_KEY, out.token);
    document.getElementById("loginOverlay").classList.add("hidden");
    document.getElementById("logoutBtn").classList.remove("hidden");
    await loadGraph();
  } catch (e) {
    err.textContent =
      e.message === "invalid_or_expired_code" ? "Invalid or expired code." : e.message || "Failed.";
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  if (network) {
    network.destroy();
    network = null;
  }
  fullNodes = [];
  fullEdges = [];
  fullNodeRankById = new Map();
  fullNodeRankCount = 0;
  document.getElementById("loginOverlay").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("resetViewBtn").classList.add("hidden");
  document.getElementById("panel").classList.add("hidden");
}

async function boot() {
  document.getElementById("unlockBtn").addEventListener("click", redeem);
  document.getElementById("codeInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") redeem();
  });
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("resetViewBtn").addEventListener("click", showFullGraph);
  const existing = sessionStorage.getItem(TOKEN_KEY);
  if (existing) {
    try {
      await fetchJson("/api/graph/data", { headers: { Authorization: "Bearer " + existing } });
      document.getElementById("loginOverlay").classList.add("hidden");
      document.getElementById("logoutBtn").classList.remove("hidden");
      await loadGraph();
    } catch (_e) {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }
}

boot();
