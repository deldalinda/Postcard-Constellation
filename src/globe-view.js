// 3D globe of postcard journeys: origin city → Millbrook hub → Ukraine.
// Uses the vendored globe.gl UMD bundle (global `Globe`).

import { cityShort, thumb } from "./util.js";
import { openLightbox } from "./lightbox.js";

// Four gradient stops with a steep ramp at the end: each travelling dash
// fades in along its tail and snaps bright at the tip, reading as an arrow.
// Brighter through the early/tail stops so a long trail glows along its whole
// length in the night sky (not just a bright tip).
const COLOR_LEG1 = [
  "rgba(232, 196, 118, 0)", "rgba(232, 196, 118, 0.28)",
  "rgba(240, 208, 140, 0.62)", "rgba(255, 234, 176, 1)",
]; // gold: writer → hub
const COLOR_LEG2 = [
  "rgba(140, 170, 255, 0)", "rgba(150, 190, 255, 0.3)",
  "rgba(170, 210, 255, 0.65)", "rgba(200, 226, 255, 1)",
]; // blue: hub → Ukraine
const COLOR_WHITE = [
  "rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.28)",
  "rgba(255, 255, 255, 0.62)", "rgba(255, 255, 255, 1)",
]; // white: contributor → hub

// High-res, area-by-area tiles (like Google Maps) used ONLY at the deepest
// zoom levels, where the base texture would otherwise pixelate: NASA GIBS
// "Black Marble" night lights, and ESRI World Imagery in daylight mode.
const TILE_NIGHT = (x, y, l) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${l}/${y}/${x}.png`;
const TILE_DAY = (x, y, l) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;

// Zoom range, expressed as camera altitude (globe radius = 100, so distance =
// 100 * (1 + altitude)). The two farthest levels are trimmed; the near end now
// goes deeper than the base texture can stay sharp, so tiles cover those.
const MIN_ALT = 0.10; // ~distance 110 — deepest (two extra zoom-in levels of city detail)
const MAX_ALT = 2.2; // ~distance 320 — farthest (two farthest levels dropped)
const DEFAULT_ALT = 2.2;
const TILES_ON_DIST = 155; // enable tiles closer than this…
const TILES_OFF_DIST = 178; // …disable beyond this (hysteresis)

export function initGlobe(container, data, onSelect) {
  const { participants, hubs, contributors = [] } = data;
  const partById = new Map(participants.map((p) => [p.id, p]));
  const hubByKey = new Map(hubs.map((h) => [h.key, { lat: h.lat, lng: h.lng }]));
  const latLngToVec = (lat, lng) => {
    const φ = (lat * Math.PI) / 180, λ = (lng * Math.PI) / 180;
    return { x: Math.cos(φ) * Math.cos(λ), y: Math.sin(φ), z: Math.cos(φ) * Math.sin(λ) };
  };
  const vecToLatLng = (x, y, z) => ({
    lat: (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI,
    lng: (Math.atan2(z, x) * 180) / Math.PI,
  });

  // Trajectory arcs: one per participant (town → "Sent to"). Blue if the card
  // is heading to Ukraine, yellow otherwise. `journeyKey` matches legs so a
  // participant's full onward path can be highlighted together.
  const arcs = data.arcs.map((a) => ({
    ...a,
    key: `${a.fromKey}>${a.toKey}`,
    colors: a.contributor ? COLOR_WHITE : a.toUkraine ? COLOR_LEG2 : COLOR_LEG1,
  }));

  const BASE_ALT = 0.02;
  const participantPoints = participants.map((p) => ({
    ...p,
    // Small flat anchor: the diffraction burst (overlay) IS the visible star;
    // this disc is just a click/hit target beneath it.
    size: 0.09,
    color: p.receiving ? "#96c8ff" : "#e8c476",
    labelAlt: BASE_ALT,
    phase: Math.random() * Math.PI * 2,
  }));
  // Lift clustered city labels to different altitudes so nearby ones don't pile.
  const angDist = (a, b) => {
    const dLat = a.lat - b.lat;
    const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  };
  const clusters = [];
  for (const p of participantPoints) {
    const c = clusters.find((cl) => cl.some((q) => angDist(p, q) < 6));
    if (c) c.push(p);
    else clusters.push([p]);
  }
  for (const cl of clusters) {
    if (cl.length < 2) continue;
    cl.sort((a, b) => a.lat - b.lat);
    // Cycle through four low rings instead of stacking ever higher — keeps
    // names near their cities (dense clusters share rings; the stem ties
    // each raised label back to its dot).
    cl.forEach((p, i) => {
      const level = i % 5;
      // Lift is gentler now that the leader lines carry the pairing.
      p.labelAlt = BASE_ALT + level * 0.045;
      p.lifted = level > 0;
    });
  }

  // Hub dots (Millbrook, Melbourne, Western Ukraine) — no labels.
  const waypointPoints = hubs.map((h) => ({
    id: h.id, lat: h.lat, lng: h.lng, size: 0.08,
    color: h.country === "Ukraine" ? "#96c8ff" : "#ffffff", isWaypoint: true,
  }));
  // Postcard-only contributors: anonymous silver stars. Clicking one opens
  // their actual written cards in the lightbox.
  const contributorPoints = contributors.map((c) => {
    // The contributor's own white arc (if she has a `sentTo`), matched by its
    // start point — so hovering her lights just that arc plus the Ukraine arcs.
    const own = arcs.find((a) => a.contributor && a.startLat === c.lat && a.startLng === c.lng);
    return {
      lat: c.lat, lng: c.lng, size: 0.12, color: "#ffffff",
      isContributor: true, c, arcKey: own ? own.key : null, labelAlt: 0.001,
      phase: Math.random() * Math.PI * 2,
    };
  });
  const points = [...participantPoints, ...waypointPoints, ...contributorPoints];

  const globe = Globe()(container)
    .globeImageUrl("vendor/earth-night.jpg")
    .backgroundColor("rgba(0,0,0,0)")
    .atmosphereColor("#7a74e2")
    .atmosphereAltitude(0.22)
    .arcsData(arcs)
    .arcColor("colors")
    .arcAltitudeAutoScale(0.4)
    // Hub legs (→ Ukraine) draw heavier so Millbrook and Melbourne read as
    // the gathering points of the whole network.
    .arcStroke((d) => (d.toUkraine ? 1.4 : 0.5))
    // The glowing dash stretches with the journey: long hauls carry a long
    // trail of light (dash length is a fraction of each arc's own span).
    .arcDashLength((d) => {
      const dLat = d.endLat - d.startLat;
      const dLng = Math.abs(d.endLng - d.startLng);
      const span = Math.hypot(dLat, Math.min(dLng, 360 - dLng));
      return Math.min(0.85, 0.45 + (span / 180) * 0.5);
    })
    .arcDashGap(0.45)
    .arcDashAnimateTime((d) => 2600 + ((d.key ? d.key.length : 0) % 5) * 350)
    .pointsData(points)
    .pointLat("lat")
    .pointLng("lng")
    .pointColor("color")
    .pointAltitude(0.001)
    .pointRadius("size")
    // Names as HTML overlays instead of 3D text: real DOM elements with a
    // padded hit area, so they are much easier to click. Only participants get
    // labels (waypoints are dots). Clustered labels are raised to different
    // altitudes; a short stem drops back toward the city dot.
    .htmlElementsData([...participantPoints, ...contributorPoints])
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude((d) => d.labelAlt)
    .htmlElement((d) => {
      // Contributors: a transparent DOM hit-target over the silver star, so the
      // click lands on the DOM (above the canvas) instead of the 3D raycaster,
      // which arcs can otherwise intercept.
      if (d.isContributor) {
        const hit = document.createElement("div");
        hit.className = "contrib-hit";
        hit.addEventListener("click", (ev) => { ev.stopPropagation(); showContributorCards(d.c); });
        hit.addEventListener("mouseenter", () => { hoveredContributor = d; container.style.cursor = "pointer"; hoveringStar = true; previewHighlight(contributorHi(d)); pauseSpin(); });
        hit.addEventListener("mouseleave", () => { hoveredContributor = null; container.style.cursor = ""; hoveringStar = false; previewHighlight(null); resumeSpinIfIdle(); });
        return hit;
      }
      const el = document.createElement("div");
      el.className = "globe-label" + (d.lifted ? " lifted" : "") + (d.receiving ? " receiving" : "");
      // No known city → the country stands in, styled like any place caption.
      el.innerHTML =
        `<span class="label-body">` +
        `<span class="pname">${d.name}</span>` +
        `<span class="loc">${cityShort(d.city) || d.country || ""}</span>` +
        `</span>`;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelect(d.id); // selection re-centres the globe (see main.js)
      });
      el.addEventListener("mouseenter", () => { hoveredParticipantId = d.id; previewHighlight(participantHi(d.id)); hoveringStar = true; pauseSpin(); });
      el.addEventListener("mouseleave", () => { hoveredParticipantId = null; previewHighlight(null); hoveringStar = false; resumeSpinIfIdle(); });
      return el;
    })
    .htmlElementVisibilityModifier((el, isVisible) => {
      el.style.opacity = isVisible ? 1 : 0;
      el.style.pointerEvents = isVisible ? "auto" : "none";
    })
    // Country borders + names (hidden until toggled on; data loaded lazily).
    .polygonCapColor(() => "rgba(0,0,0,0)")
    .polygonSideColor(() => "rgba(0,0,0,0)")
    .polygonStrokeColor(() => "rgba(180, 200, 255, 0.4)")
    .polygonAltitude(0.006)
    .labelLat((d) => d.lat)
    .labelLng((d) => d.lng)
    .labelText((d) => d.text)
    .labelSize(0.5)
    .labelDotRadius(0)
    .labelColor(() => "rgba(200, 214, 255, 0.55)")
    .labelResolution(1)
    .labelAltitude(0.007)
    .onPointClick((pt) => {
      if (pt.isWaypoint) return;
      if (pt.isContributor) { showContributorCards(pt.c); return; }
      onSelect(pt.id);
    })
    .onPointHover((pt) => {
      hoveredContributor = pt?.isContributor ? pt : null;
      container.style.cursor = pt && !pt.isWaypoint ? "pointer" : "";
    })
    .pointOfView({ lat: 42, lng: -45, altitude: DEFAULT_ALT }, 0);

  // Controls: zoom responds immediately. Damping was adding inertia that felt
  // like lag, so it is off; the auto-spin still pauses during wheel/drag so it
  // never fights the zoom. The distance range is trimmed to the crisp zone.
  const controls = globe.controls();
  controls.enableDamping = false;
  controls.zoomSpeed = 1.1;
  controls.rotateSpeed = 0.85;
  controls.minDistance = 100 * (1 + MIN_ALT);
  controls.maxDistance = 100 * (1 + MAX_ALT);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.45;

  // The glowing arcs float above the surface, so globe.gl's click raycaster hits
  // a passing arc before the star beneath it — and with no arc-click handler the
  // click is swallowed (this is why contributor stars under the arcs converging
  // on Millbrook were unclickable). globe.gl doesn't expose a hover-order hook,
  // so contributors get real HTML hit-targets (see htmlElement below), which sit
  // above the canvas and bypass the 3D raycaster entirely.

  // --- contributor cards in the lightbox --------------------------------------
  // Clicking a silver star shows the contributor's actual written cards in the
  // shared lightbox (Esc / ← → handled there), captioned with name and place.
  let hoveredContributor = null;
  let hoveredParticipantId = null;
  // What's highlighted: { pid, keys } for the hovered/selected star, or null.
  // While set, only that star's own arc(s) and every Ukraine-bound arc stay
  // bright; the rest dim back.
  let active = null;
  function showContributorCards(c) {
    if (!c.images?.length) return;
    spinLocked = true; pauseSpin(); // freeze the globe behind the shadowbox
    openLightbox(
      c.images.map((src) => ({ src, cap: `${c.name} — ${c.place}`, preview: thumb(src) })),
      0,
      () => { spinLocked = false; resumeSpinIfIdle(); }
    );
  }

  // --- starburst overlay -----------------------------------------------------
  // The participant dots twinkle with diffraction spikes (matching the
  // constellation stars). WebGL points can't render spikes, so a 2D canvas
  // sits over the globe and redraws each visible participant's burst per
  // frame, projected with getScreenCoords and hidden past the horizon.
  const burstCanvas = document.createElement("canvas");
  burstCanvas.className = "globe-bursts";
  container.appendChild(burstCanvas);
  const bctx = burstCanvas.getContext("2d");
  function resizeBursts() {
    const dpr = devicePixelRatio;
    burstCanvas.width = container.clientWidth * dpr;
    burstCanvas.height = container.clientHeight * dpr;
  }
  resizeBursts();
  window.addEventListener("resize", resizeBursts);

  function drawBurst(x, y, size, rgb, alpha, tw) {
    // Soft glowing halo behind the disc + burst — a radial glow that fades out.
    const haloR = size * (2.2 + 0.6 * tw);
    const hg = bctx.createRadialGradient(x, y, 0, x, y, haloR);
    hg.addColorStop(0, `rgba(${rgb}, ${0.34 * alpha})`);
    hg.addColorStop(0.45, `rgba(${rgb}, ${0.12 * alpha})`);
    hg.addColorStop(1, `rgba(${rgb}, 0)`);
    bctx.fillStyle = hg;
    bctx.beginPath();
    bctx.arc(x, y, haloR, 0, Math.PI * 2);
    bctx.fill();

    const rayLen = size * (3.4 + 2.2 * tw);
    const diagLen = rayLen * 0.42;
    for (let k = 0; k < 8; k++) {
      const diag = k >= 4;
      const ang = diag ? (Math.PI / 4) * (2 * (k - 4) + 1) : (Math.PI / 2) * k;
      const len = diag ? diagLen : rayLen;
      const ex = x + Math.cos(ang) * len;
      const ey = y + Math.sin(ang) * len;
      const g = bctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0, `rgba(${rgb}, ${0.85 * alpha})`);
      g.addColorStop(0.35, `rgba(${rgb}, ${0.3 * alpha})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      bctx.strokeStyle = g;
      bctx.lineWidth = (diag ? 0.6 : 0.95) * devicePixelRatio;
      bctx.beginPath();
      bctx.moveTo(x, y);
      bctx.lineTo(ex, ey);
      bctx.stroke();
    }
    bctx.fillStyle = `rgba(${rgb}, ${alpha})`;
    bctx.beginPath();
    bctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    bctx.fill();
  }

  const R2 = 100 * 100; // globe radius² — horizon visibility threshold
  const globeViewEl = container.closest("#globe-view");

  // A hovered contributor's plaque: name / place / prompt, stacked over a
  // semi-transparent grey card, floating just above the star. The place line
  // (city, or country when no city is known) obeys the Place Names toggle.
  function drawContributorPlaque(cp, cx, y0, dpr) {
    const placeOn = !globeViewEl || !globeViewEl.classList.contains("hide-cities");
    const lines = [
      { text: cp.c.name, font: `600 ${17 * dpr}px "Cormorant Garamond", Georgia, serif`,
        color: "rgba(240, 242, 252, 0.98)", h: 21 * dpr },
    ];
    if (placeOn) lines.push({
      text: cityShort(cp.c.place).toUpperCase(),
      font: `400 ${9.5 * dpr}px "Jost", sans-serif`,
      color: "rgba(239, 145, 136, 0.95)", h: 15 * dpr, spaced: true,
    });

    let maxW = 0;
    for (const ln of lines) {
      bctx.font = ln.font;
      bctx.letterSpacing = ln.spaced ? `${2 * dpr}px` : "0px";
      maxW = Math.max(maxW, bctx.measureText(ln.text).width);
    }
    const padX = 13 * dpr, padY = 9 * dpr;
    const boxW = maxW + padX * 2;
    const boxH = lines.reduce((s, l) => s + l.h, 0) + padY * 2;
    const boxX = cx - boxW / 2;
    const boxY = y0 - 20 * dpr - boxH; // float above the star

    bctx.fillStyle = "rgba(20, 22, 32, 0.66)";
    bctx.beginPath();
    if (bctx.roundRect) bctx.roundRect(boxX, boxY, boxW, boxH, 8 * dpr);
    else bctx.rect(boxX, boxY, boxW, boxH);
    bctx.fill();

    bctx.textAlign = "center";
    bctx.textBaseline = "top";
    let y = boxY + padY;
    for (const ln of lines) {
      bctx.font = ln.font;
      bctx.letterSpacing = ln.spaced ? `${2 * dpr}px` : "0px";
      bctx.fillStyle = ln.color;
      bctx.fillText(ln.text, cx, y);
      y += ln.h;
    }
    bctx.letterSpacing = "0px";
    bctx.textBaseline = "alphabetic";
  }
  function drawBursts(t) {
    const dpr = devicePixelRatio;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, burstCanvas.width, burstCanvas.height);
    const cam = globe.camera().position;
    // Bursts shrink as the camera pulls away, roughly tracking the dots.
    const zoomScale = Math.max(0.75, Math.min(2.0, 210 / controls.getDistance()));
    // Leader lines only exist to tie a raised plaque to its star, so hide them
    // when no plaque text shows (both name toggles off).
    const leadersVisible = !globeViewEl ||
      !(globeViewEl.classList.contains("hide-names") &&
        globeViewEl.classList.contains("hide-cities"));
    for (const p of participantPoints) {
      const pos = globe.getCoords(p.lat, p.lng, 0.001);
      const dot = pos.x * cam.x + pos.y * cam.y + pos.z * cam.z;
      if (dot <= R2) continue; // behind the horizon
      // fade in as the point clears the limb of the globe
      const limb = Math.min(1, (dot / R2 - 1) * 6);
      const sc = globe.getScreenCoords(p.lat, p.lng, 0.001);
      // A true leader line from the raised plaque's anchor to its star —
      // recomputed each frame, so the pairing reads from every angle (unlike
      // the old fixed CSS stem). Non-lifted labels sit on their dot: no line.
      if (p.lifted && leadersVisible) {
        const la = globe.getScreenCoords(p.lat, p.lng, p.labelAlt);
        const hov = hoveredParticipantId === p.id;
        const a = (hov ? 0.85 : 0.32) * limb;
        // leader takes its star's colour: gold elsewhere, blue for Ukraine
        const leaderRGB = p.receiving ? "150, 200, 255" : "232, 196, 118";
        bctx.strokeStyle = `rgba(${leaderRGB}, ${a.toFixed(3)})`;
        bctx.lineWidth = (hov ? 2.1 : 0.75) * dpr;
        bctx.beginPath();
        bctx.moveTo(la.x * dpr, la.y * dpr);
        bctx.lineTo(sc.x * dpr, sc.y * dpr);
        bctx.stroke();
      }
      const tw = 0.6 + 0.4 * Math.sin(p.phase + t / 900);
      const hovBurst = hoveredParticipantId === p.id;
      drawBurst(
        sc.x * dpr, sc.y * dpr,
        (hovBurst ? 21.0 : 14.0) * zoomScale * dpr, // magnify on hover
        p.receiving ? "188, 217, 255" : "244, 227, 184",
        limb, tw
      );
    }
    // silver stars: the postcard-only contributors, smaller and quieter
    for (const cp of contributorPoints) {
      const pos = globe.getCoords(cp.lat, cp.lng, 0.001);
      const dot = pos.x * cam.x + pos.y * cam.y + pos.z * cam.z;
      if (dot <= R2) continue;
      const limb = Math.min(1, (dot / R2 - 1) * 6);
      const sc = globe.getScreenCoords(cp.lat, cp.lng, 0.001);
      const tw = 0.6 + 0.4 * Math.sin(cp.phase + t / 900);
      const hovered = hoveredContributor === cp;
      drawBurst(
        sc.x * dpr, sc.y * dpr,
        (hovered ? 18.0 : 10.4) * zoomScale * dpr,
        "255, 255, 255",
        limb * (hovered ? 1 : 0.8), tw
      );
      if (hovered) drawContributorPlaque(cp, sc.x * dpr, sc.y * dpr, dpr);
    }
    requestAnimationFrame(drawBursts);
  }
  requestAnimationFrame(drawBursts);

  // The globe auto-rotates only when nothing wants it still: not mid-drag, not
  // hovering a star, and no lightbox open. Each interaction flips its own flag,
  // and the spin resumes the instant the last one clears — no timed delay.
  let spinLocked = false;   // a lightbox / shadowbox is open
  let panelOpen = false;    // a participant profile panel is open
  let dragging = false;     // the pointer is down on the globe
  let hoveringStar = false; // the cursor is over a participant/contributor star
  function pauseSpin() { controls.autoRotate = false; }
  function resumeSpinIfIdle() {
    if (!dragging && !hoveringStar && !spinLocked && !panelOpen) controls.autoRotate = true;
  }
  container.addEventListener("pointerdown", () => { dragging = true; pauseSpin(); });
  container.addEventListener("pointerup", () => { dragging = false; resumeSpinIfIdle(); });
  // (wheel/zoom no longer pauses the spin — zooming and rotating coexist)

  // Centre on a participant WITHOUT changing the zoom level — keep the current
  // altitude, just swing to her lat/lng.
  function focusOn(p) {
    pauseSpin();
    const alt = globe.pointOfView().altitude;
    globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: alt }, 1000);
  }

  // Sharpen the map: max anisotropic filtering keeps the 8K texture crisp at
  // grazing angles / close zoom instead of smearing into pixels. Re-applied
  // whenever the day/night texture swaps.
  function sharpenTexture() {
    try {
      const mat = globe.globeMaterial && globe.globeMaterial();
      const maxAniso = globe.renderer().capabilities.getMaxAnisotropy();
      if (mat && mat.map) {
        mat.map.anisotropy = maxAniso;
        mat.map.needsUpdate = true;
      }
    } catch (e) {
      /* best-effort */
    }
  }
  if (globe.onGlobeReady) globe.onGlobeReady(sharpenTexture);
  else setTimeout(sharpenTexture, 800);

  // The early-night blue texture is the globe for the normal viewing range.
  // Only when you zoom in past TILES_ON_DIST do high-res tiles stream in for
  // that area (crisp city detail); zooming back out returns to the blue map.
  let currentDay = false;
  let tilesOn = false;
  function setTiles(on) {
    tilesOn = on;
    // Desaturate the globe canvas while the (yellow) Black Marble tiles show, so
    // the warm city lights read closer to white and the gold name labels — HTML
    // overlays, unaffected by the canvas filter — stand out. Night only.
    container.classList.toggle("tiles-active", on && !currentDay);
    if (on && navigator.onLine) {
      globe.globeTileEngineUrl(currentDay ? TILE_DAY : TILE_NIGHT).globeTileEngineMaxLevel(currentDay ? 12 : 8);
    } else {
      globe.globeTileEngineUrl(null);
    }
  }
  let arcsShown = true;
  function updateTilesForZoom() {
    const d = controls.getDistance();
    if (!tilesOn && d < TILES_ON_DIST) setTiles(true);
    else if (tilesOn && d > TILES_OFF_DIST) setTiles(false);
    // Past zoom level 5 (altitude 0.64 → distance 164) the surface is close, so
    // drop the auto-rotation to a quarter speed so it doesn't feel dizzying up close.
    controls.autoRotateSpeed = d < 164 ? 0.1125 : 0.45;
    // City captions fade with zoom: hidden at the far view (names only),
    // fully visible once the camera comes in close.
    const capAlpha = Math.max(0, Math.min(1, (260 - d) / 90));
    container.style.setProperty("--cap-alpha", capAlpha.toFixed(2));
  }
  // Poll distance so this works however the zoom changed (wheel, slider,
  // buttons, autorotate) — controls "change" alone misses programmatic zooms.
  controls.addEventListener("change", updateTilesForZoom);
  setInterval(updateTilesForZoom, 400);

  function applyBasemap(day) {
    currentDay = day;
    globe
      .globeImageUrl(day ? "vendor/earth-day.jpg" : "vendor/earth-night.jpg")
      .atmosphereColor(day ? "#a9c7ff" : "#7a74e2");
    setTiles(false);
    updateTilesForZoom(); // re-enable if already deep-zoomed
    [300, 900, 1600].forEach((ms) => setTimeout(sharpenTexture, ms));
  }
  applyBasemap(false);

  // Trajectory highlighting: `committedId` is the selected participant; hover
  // previews another without losing the selection.
  let committedId = null;
  // A participant's own arc is matched by `pid` — unique even when several people
  // share a blank city (their arcs would otherwise collide on the same "from>to"
  // key). `keys` carries the shared onward trunk legs (drawn as someone else's
  // arc) so her whole path to home base lights together. A contributor has no
  // pid, so hers is matched by her single arc key.
  function participantHi(id) {
    const p = id ? partById.get(id) : null;
    if (!p) return null;
    const trunk = p.journey ? p.journey.slice(1).map((l) => `${l.from}>${l.to}`) : [];
    return { pid: id, keys: new Set(trunk) };
  }
  function contributorHi(cp) {
    return { pid: null, keys: new Set(cp && cp.arcKey ? [cp.arcKey] : []) };
  }
  // Is this arc on the highlighted star's own path — her own arc (by pid) or a
  // shared trunk leg (by key)? Drives both the bright test and the thicker stroke.
  function onPath(a) {
    return !!active && ((active.pid && a.pid === active.pid) || active.keys.has(a.key));
  }
  // An arc stays bright when it is on the highlighted star's path OR heads to
  // Ukraine; every other arc dims back. No active star ⇒ everything bright.
  function arcLit(a) {
    return !active || a.toUkraine || onPath(a);
  }
  function applyHighlight(descriptor) {
    active = descriptor || null;
    globe
      .arcColor((d) => (arcLit(d) ? d.colors : ["rgba(236,234,251,0.02)", "rgba(236,234,251,0.1)"]))
      .arcStroke((d) =>
        onPath(d) ? (d.toUkraine ? 1.8 : 1.1) : (d.toUkraine ? 1.4 : 0.5)
      );
  }
  // Hover previews `descriptor` (a participant or contributor); when the cursor
  // leaves (null) it falls back to the committed selection, or all-bright when
  // nothing is selected.
  function previewHighlight(descriptor) {
    applyHighlight(descriptor || participantHi(committedId));
  }

  // Frame the camera to show a participant's WHOLE journey (her town → hub →
  // home base) rather than centring tight on her — used by "See the journey".
  function frameJourney(id) {
    const p = partById.get(id);
    if (!p || !p.journey || !p.journey.length) return focusOn(p);
    // Gather the journey's points (towns + hubs) as unit vectors.
    const pts = [];
    const add = (lat, lng) => pts.push(latLngToVec(lat, lng));
    add(p.lat, p.lng);
    for (const leg of p.journey) {
      const g = hubByKey.get(leg.to);
      if (g) add(g.lat, g.lng);
    }
    // Centre = normalized average direction; span = max angle from centre.
    let cx = 0, cy = 0, cz = 0;
    for (const v of pts) { cx += v.x; cy += v.y; cz += v.z; }
    const cl = Math.hypot(cx, cy, cz) || 1;
    cx /= cl; cy /= cl; cz /= cl;
    let maxAng = 0;
    for (const v of pts) maxAng = Math.max(maxAng, Math.acos(Math.max(-1, Math.min(1, v.x * cx + v.y * cy + v.z * cz))));
    const center = vecToLatLng(cx, cy, cz);
    const alt = Math.max(0.9, Math.min(MAX_ALT, 0.3 + maxAng * 1.7));
    pauseSpin();
    globe.pointOfView({ lat: center.lat, lng: center.lng, altitude: alt }, 1300);
  }

  // --- country borders + names (loaded on first toggle) ----------------------
  let countryFeatures = null;
  let countryLabels = null;
  function centroid(f) {
    const g = f.geometry;
    const ring =
      g.type === "Polygon"
        ? g.coordinates[0]
        : g.coordinates.map((poly) => poly[0]).sort((a, b) => b.length - a.length)[0];
    let x = 0, y = 0;
    for (const [lng, lat] of ring) { x += lng; y += lat; }
    return { lng: x / ring.length, lat: y / ring.length };
  }
  async function ensureCountryData() {
    if (countryFeatures) return;
    const geo = await (await fetch("vendor/countries-110m.geojson")).json();
    countryFeatures = geo.features;
    // Name only the more prominent countries, to keep the globe legible.
    countryLabels = countryFeatures
      .filter((f) => (f.properties.LABELRANK ?? 9) <= 4)
      .map((f) => ({ ...centroid(f), text: f.properties.ADMIN }));
  }

  function resize() {
    globe.width(container.clientWidth).height(container.clientHeight);
  }
  window.addEventListener("resize", resize);
  resize();

  return {
    refresh: resize,
    setDayMode(day) {
      if (globe.globeTileEngineClearCache) globe.globeTileEngineClearCache();
      applyBasemap(day);
    },
    async setCountries(show) {
      if (show) {
        await ensureCountryData();
        globe.polygonsData(countryFeatures).labelsData(countryLabels);
      } else {
        globe.polygonsData([]).labelsData([]);
      }
    },
    focusParticipant(id) {
      const p = participants.find((x) => x.id === id);
      if (p) focusOn(p);
    },
    zoomLimits() {
      return { min: (controls.minDistance - 100) / 100, max: (controls.maxDistance - 100) / 100 };
    },
    getAltitude() {
      return globe.pointOfView().altitude;
    },
    setAltitude(alt, dur = 0) {
      const min = (controls.minDistance - 100) / 100;
      const max = (controls.maxDistance - 100) / 100;
      globe.pointOfView({ altitude: Math.max(min, Math.min(max, alt)) }, dur);
    },
    onZoomChange(cb) {
      controls.addEventListener("change", () => cb(globe.pointOfView().altitude));
    },
    highlight(id) {
      committedId = id;
      panelOpen = !!id; // profile panel open ⇒ keep the globe still behind it
      applyHighlight(participantHi(id));
      if (id) pauseSpin();
      else resumeSpinIfIdle();
    },
    showJourney(id) {
      committedId = id;
      applyHighlight(participantHi(id));
      frameJourney(id);
    },
    // Pause the globe's auto-rotation while a lightbox/shadowbox is open, and
    // resume it when the lightbox closes.
    lockSpin(on) {
      spinLocked = on;
      if (on) pauseSpin();
      else resumeSpinIfIdle();
    },
  };
}
