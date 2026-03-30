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
    shadow: { enabled: true, color: "rgba(0,229,255,0.35)", size: 12 },
    scaling: { min: 14, max: 44 },
    chosen: {
      node: function (values, _id, selected, hovering) {
        if (selected || hovering) {
          values.borderWidth = 3;
          values.borderColor = "#00E5FF";
        }
      },
    },
  },
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.65 } },
    color: { color: "rgba(255,255,255,0.32)", highlight: "#00E5FF", hover: "#FF00AA" },
    font: { color: "#E8ECFF", size: 11, strokeWidth: 0, align: "middle" },
    smooth: { type: "continuous", roundness: 0.35 },
  },
};

function nodeColor(idx) {
  return idx % 2 === 0
    ? { bg: "#00E5FF", border: "#7C4DFF" }
    : { bg: "#FF00AA", border: "#00E5FF" };
}

/** Classic medal tones (readable on solid dark background). */
var MEDAL_STYLES = {
  1: { bg: "#FFD700", border: "#B8860B", hint: "1st · Gold", labelColor: "#1a1206" },
  2: { bg: "#E8E8E8", border: "#708090", hint: "2nd · Silver", labelColor: "#1a1a22" },
  3: { bg: "#CD7F32", border: "#5C3D1E", hint: "3rd · Bronze", labelColor: "#fff8f0" },
};

function buildVisData(nodes, edges) {
  const vNodes = nodes.map((n, i) => {
    var medal = n.medalRank != null ? MEDAL_STYLES[n.medalRank] : null;
    var c = medal ? { bg: medal.bg, border: medal.border } : nodeColor(i);
    var titleExtra = medal ? "\n" + medal.hint : "";
    var title = n.rating != null ? n.label + "\nELO " + n.rating + titleExtra : n.label + titleExtra;
    var nodeFont = medal
      ? { color: medal.labelColor, size: 15, face: "Segoe UI, system-ui, sans-serif", bold: true }
      : { color: "#ffffff", size: 15, face: "Segoe UI, system-ui, sans-serif" };
    return {
      id: n.id,
      label: n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label,
      title,
      font: nodeFont,
      color: {
        background: c.bg,
        border: c.border,
        highlight: { background: "#ffffff", border: "#00E5FF" },
      },
    };
  });
  const vEdges = edges.map((e, i) => ({
    id: "e" + i + "-" + e.from + "-" + e.to,
    from: e.from,
    to: e.to,
    label: String(e.count),
    title: e.count + " snipe(s)",
  }));
  return { nodes: new vis.DataSet(vNodes), edges: new vis.DataSet(vEdges) };
}

function applyGraphSubset(focusId) {
  if (!network || !fullNodes.length) return;
  const nodeIdSet = new Set(fullNodes.map((n) => n.id));
  const keep = directEgoNetworkNodeSet(nodeIdSet, fullEdges, focusId);
  const subNodes = fullNodes.filter((n) => keep.has(n.id));
  const subEdges = fullEdges.filter((e) => keep.has(e.from) && keep.has(e.to));
  const data = buildVisData(subNodes, subEdges);
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
