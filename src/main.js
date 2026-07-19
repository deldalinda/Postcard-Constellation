import { initStarfield } from "./starfield.js";
import { initGlobe } from "./globe-view.js";
import { initConstellation } from "./constellation.js";
import { initStarlight } from "./starlight.js";
import { initPanel } from "./panel.js";
import { loadData } from "./data.js";

const data = await loadData(); // single source of truth: the data/*.csv sheets
const byId = new Map(data.participants.map((p) => [p.id, p]));

initStarfield(document.getElementById("starfield"));

// --- view switching ---------------------------------------------------------
const views = {
  globe: { btn: document.getElementById("btn-globe"), el: document.getElementById("globe-view") },
  constellation: { btn: document.getElementById("btn-constellation"), el: document.getElementById("constellation-view") },
  starlight: { btn: document.getElementById("btn-starlight"), el: document.getElementById("starlight-view") },
};
let current = "globe";

function showView(name) {
  current = name;
  document.body.dataset.view = name; // scopes the globe-only display controls
  for (const [key, v] of Object.entries(views)) {
    v.btn.classList.toggle("active", key === name);
    v.btn.setAttribute("aria-selected", String(key === name));
    v.el.classList.toggle("active", key === name);
  }
  // Views can miss resize events while hidden — recheck when shown.
  if (name === "globe") globeView?.refresh();
  if (name === "constellation") constellationView?.refresh();
  if (name === "starlight") starlightView?.refresh();
}
views.globe.btn.addEventListener("click", () => showView("globe"));
views.constellation.btn.addEventListener("click", () => showView("constellation"));
views.starlight.btn.addEventListener("click", () => showView("starlight"));

// --- panel + views wiring ----------------------------------------------------
const panel = initPanel(data, {
  onShowJourney(id) {
    showView("globe");
    globeView.showJourney(id); // zoom out to show her whole trajectory
  },
  onClose() {
    globeView.highlight(null);
    constellationView.selectParticipant(null);
  },
  onLightbox(open) {
    globeView.lockSpin(open); // freeze the globe's spin while a lightbox is open
  },
});

function selectParticipant(id) {
  if (!id) {
    panel.close();
    return;
  }
  const p = byId.get(id);
  panel.open(p);
  globeView.highlight(id);
  globeView.focusParticipant(id); // centre the globe on her, in any view
  constellationView.selectParticipant(id); // keep both views centred on her
}

const globeView = initGlobe(document.getElementById("globe"), data, selectParticipant);
const constellationView = initConstellation(document.getElementById("constellation"), data, selectParticipant);
const starlightView = initStarlight(document.getElementById("starlight"));

// --- display toggles (globe view) -------------------------------------------
const globeViewEl = document.getElementById("globe-view");
const tgNames = document.getElementById("tg-names");
const tgCities = document.getElementById("tg-cities");
const tgCountries = document.getElementById("tg-countries");
const tgDay = document.getElementById("tg-day");

tgNames.addEventListener("change", () =>
  globeViewEl.classList.toggle("hide-names", !tgNames.checked)
);
tgCities.addEventListener("change", () =>
  globeViewEl.classList.toggle("hide-cities", !tgCities.checked)
);
tgCountries.addEventListener("change", () => globeView.setCountries(tgCountries.checked));
tgDay.addEventListener("change", () => globeView.setDayMode(tgDay.checked));

// --- zoom control (for visitors without a mouse wheel) ----------------------
// Discrete zoom levels (altitudes), far → near. The two farthest are omitted;
// the deepest few (below the base texture's crisp limit) are covered by the
// high-res tile engine so you can zoom right in on a location.
const ZOOM_LEVELS = [2.2, 1.7, 1.3, 1.0, 0.8, 0.64, 0.48, 0.34, 0.22, 0.15, 0.10];
const nearestLevel = (alt) => {
  let best = 0, bestD = Infinity;
  ZOOM_LEVELS.forEach((a, i) => {
    const d = Math.abs(a - alt);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
};
const zoomIn = document.getElementById("zoom-in");
const zoomOut = document.getElementById("zoom-out");
const zoomRange = document.getElementById("zoom-range");
zoomRange.min = "0";
zoomRange.max = String(ZOOM_LEVELS.length - 1);
zoomRange.step = "1";
let zoomLevel = nearestLevel(globeView.getAltitude());
let lastProgrammatic = 0;
function goToLevel(i, dur) {
  zoomLevel = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, i));
  lastProgrammatic = Date.now();
  globeView.setAltitude(ZOOM_LEVELS[zoomLevel], dur);
  zoomRange.value = String(zoomLevel);
}
zoomIn.addEventListener("click", () => goToLevel(zoomLevel + 1, 300)); // in = higher index
zoomOut.addEventListener("click", () => goToLevel(zoomLevel - 1, 300));
zoomRange.addEventListener("input", () => goToLevel(+zoomRange.value, 250));
// Wheel/pinch zoom (continuous) — snap the thumb to the nearest level, but
// ignore the camera-change events our own button/slider animations emit.
globeView.onZoomChange((alt) => {
  if (document.activeElement === zoomRange) return;
  if (Date.now() - lastProgrammatic < 500) return;
  zoomLevel = nearestLevel(alt);
  zoomRange.value = String(zoomLevel);
});
zoomRange.value = String(zoomLevel);

// Reflect the initial checkbox states.
globeViewEl.classList.toggle("hide-names", !tgNames.checked);
globeViewEl.classList.toggle("hide-cities", !tgCities.checked);
globeView.setCountries(tgCountries.checked);
globeView.setDayMode(tgDay.checked);

// Initialise view state (also sets body[data-view] for the display controls).
showView("globe");

// Small public API — lets kiosk deep-links (e.g. ?p=HelenG) open a participant directly.
window.connectionApp = { showView, selectParticipant, globe: globeView };
const params = new URLSearchParams(location.search);
const preselect = params.get("p");
if (preselect && byId.has(preselect)) selectParticipant(preselect);
const preview = params.get("v");
if (preview && views[preview]) showView(preview);

// Contest guess form. With a Web3Forms access key configured, the card's CTA
// opens an in-app form that emails the guess directly; without one, the CTA
// keeps its plain mailto behaviour so the exhibition never has a dead button.
const GUESS_FORM_KEY = "2ed573b0-9420-49d8-9bb2-e0fc28d95427";
const guessModal = document.getElementById("guess-modal");
if (GUESS_FORM_KEY && guessModal) {
  const cta = document.querySelector("#mystery-card .mc-cta");
  const form = document.getElementById("gm-form");
  const done = document.getElementById("gm-done");
  const note = form.querySelector(".gm-note");
  const send = form.querySelector(".gm-send");
  const noteText = note.textContent;
  const close = () => { guessModal.hidden = true; };
  cta.addEventListener("click", (e) => {
    e.preventDefault();
    form.hidden = false;
    done.hidden = true;
    note.textContent = noteText;
    note.classList.remove("gm-error");
    guessModal.hidden = false;
    document.getElementById("gm-email").focus();
  });
  document.getElementById("gm-close").addEventListener("click", close);
  guessModal.addEventListener("click", (e) => { if (e.target === guessModal) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !guessModal.hidden && !e.defaultPrevented) { e.preventDefault(); close(); }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    send.disabled = true;
    send.textContent = "Sending…";
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: GUESS_FORM_KEY,
          subject: "Postcard Constellation — contest guess",
          from_name: "Postcard Constellation",
          email: document.getElementById("gm-email").value,
          message: document.getElementById("gm-guess").value,
        }),
      });
      const out = await res.json();
      if (!out.success) throw new Error(out.message || "send failed");
      form.hidden = true;
      done.hidden = false;
    } catch {
      note.textContent = "Hmm, that didn't send — please try again, or email deldal@gmail.com directly.";
      note.classList.add("gm-error");
    } finally {
      send.disabled = false;
      send.innerHTML = "&#10022;&nbsp; Send my guess";
    }
  });
}

// Small screens: the display toggles live behind a draggable pebble (#dc-fab).
// Tap toggles the panel; drag carries the pebble anywhere, and on release it
// glides to the nearest side edge (the .settle transition animates the glide).
const dcFab = document.getElementById("dc-fab");
const dcPanel = document.getElementById("display-controls");
if (dcFab && dcPanel) {
  const narrowMQ = matchMedia("(max-width: 1010px)");
  let sx = 0, sy = 0, ox = 0, oy = 0, moved = false, tracking = false;
  const place = (x, y) => {
    const r = dcFab.getBoundingClientRect();
    dcFab.style.left = Math.min(Math.max(x, 10), innerWidth - r.width - 10) + "px";
    dcFab.style.top = Math.min(Math.max(y, 84), innerHeight - r.height - 10) + "px";
  };
  const closePanel = () => dcPanel.classList.remove("dc-open");
  const openPanel = () => {
    // sit beside the pebble, flipping sides when there's no room
    const r = dcFab.getBoundingClientRect();
    dcPanel.style.bottom = "auto";
    dcPanel.style.transform = "none";
    dcPanel.classList.add("dc-open");
    const pw = dcPanel.offsetWidth, ph = dcPanel.offsetHeight;
    let x = r.right + 12, origin = "left";
    if (x + pw > innerWidth - 8) { x = r.left - pw - 12; origin = "right"; }
    if (x < 8) x = 8;
    const y = Math.min(Math.max(r.top + r.height / 2 - ph / 2, 84), innerHeight - ph - 12);
    dcPanel.style.left = x + "px";
    dcPanel.style.top = y + "px";
    dcPanel.style.transformOrigin = origin + " center";
  };
  dcFab.addEventListener("pointerdown", (e) => {
    tracking = true; moved = false;
    sx = e.clientX; sy = e.clientY;
    const r = dcFab.getBoundingClientRect();
    ox = r.left; oy = r.top;
    dcFab.setPointerCapture?.(e.pointerId);
    dcFab.classList.remove("settle");
  });
  dcFab.addEventListener("pointermove", (e) => {
    if (!tracking) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    dcFab.classList.add("dragging");
    closePanel();
    place(ox + dx, oy + dy);
  });
  dcFab.addEventListener("pointerup", () => {
    if (!tracking) return;
    tracking = false;
    dcFab.classList.remove("dragging");
    if (moved) {
      dcFab.classList.add("settle");
      const r = dcFab.getBoundingClientRect();
      const snapX = r.left + r.width / 2 < innerWidth / 2 ? 16 : innerWidth - r.width - 16;
      place(snapX, r.top);
    } else if (dcPanel.classList.contains("dc-open")) {
      closePanel();
    } else {
      openPanel();
    }
  });
  document.addEventListener("click", (e) => {
    if (!narrowMQ.matches || !dcPanel.classList.contains("dc-open")) return;
    if (!dcPanel.contains(e.target) && !dcFab.contains(e.target)) closePanel();
  });
  // returning to a wide screen restores the always-visible panel untouched
  narrowMQ.addEventListener?.("change", (m) => {
    if (!m.matches) { closePanel(); dcPanel.style.cssText = ""; }
  });
}

// The site menu closes when the visitor clicks anywhere outside it.
const siteMenu = document.getElementById("site-menu");
if (siteMenu) {
  document.addEventListener("click", (e) => {
    if (siteMenu.open && !siteMenu.contains(e.target)) siteMenu.open = false;
  });
}

// Mystery card collapse: minimizes to a small pill so the sky stays visible
// (collapsed by default on narrow screens, open on wide; remembered per tab).
const mystCard = document.getElementById("mystery-card");
const mystPill = document.getElementById("mystery-pill");
if (mystCard && mystPill) {
  const setCollapsed = (c) => {
    mystCard.hidden = c;
    mystPill.hidden = !c;
    sessionStorage.setItem("mystery-collapsed", c ? "1" : "0");
  };
  document.getElementById("mc-min").addEventListener("click", () => setCollapsed(true));
  mystPill.addEventListener("click", () => setCollapsed(false));
  const stored = sessionStorage.getItem("mystery-collapsed");
  setCollapsed(stored !== null ? stored === "1" : matchMedia("(max-width: 1010px)").matches);
}

// Mystery-card fallback: mailto silently fails for visitors without a mail
// app, so the address itself is a click-to-copy button.
const mcCopy = document.getElementById("mc-copy");
if (mcCopy) {
  const address = mcCopy.textContent;
  mcCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Clipboard API needs a secure context (the site runs on http until
      // the certificate lands) — fall back to the legacy copy command.
      const ta = document.createElement("textarea");
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    mcCopy.textContent = "copied ✓";
    mcCopy.classList.add("copied");
    setTimeout(() => {
      mcCopy.textContent = address;
      mcCopy.classList.remove("copied");
    }, 1600);
  });
}
