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
