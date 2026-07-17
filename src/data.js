// Loads data/participants.json (generated from the editable spreadsheet
// data/participants.csv by tools/build_datasets.py) and builds the model the
// app renders: participants with coordinates, the trajectory arcs, each
// participant's full journey to home base in western Ukraine, and the
// constellation figures linking people who share something in common.

import { GEO, cityKey } from "./geo.js";
import { buildConstellations } from "./grouping.js";

// --- journeys ---------------------------------------------------------------
// Full path each card travels to home base (western Ukraine), following
// hub → onward legs. `coords` maps a cityKey to {lat, lng, country} and is
// built from the participants themselves (plus geo.js hub fallbacks), so a
// new city added in the spreadsheet needs no code change.
function buildJourneys(participants, coords) {
  // hubOnward[hubCityKey] = where a participant located AT that hub sends to.
  const hubOnward = {};
  for (const p of participants) {
    if (p.sentToKey && coords[p.cityKey]) hubOnward[p.cityKey] = p.sentToKey;
  }
  for (const p of participants) {
    const legs = [];
    let from = p.cityKey, to = p.sentToKey;
    const seen = new Set();
    while (to && coords[to] && !seen.has(from + ">" + to)) {
      seen.add(from + ">" + to);
      legs.push({ from, to, toUkraine: coords[to].country === "Ukraine" });
      const onward = hubOnward[to];
      if (onward && onward !== to) { from = to; to = onward; } else break;
    }
    p.journey = legs;
  }
}

// --- main -------------------------------------------------------------------
// The three datasets are generated from the editable spreadsheets of truth
// (data/*.csv) by tools/build_datasets.py. This loader reads participants.json
// as the whole roster — geometry, content and all — and derives the journeys,
// constellations and globe arcs from it.
export async function loadData() {
  const doc = await (await fetch("data/participants.json", { cache: "no-cache" })).json();
  const participants = (doc.participants || []).map((p) => ({
    ...p,
    postcards: p.postcards || [],
    cityKey: cityKey(p.city),
    sentToKey: cityKey(p.sentTo || ""),
    receiving: p.country === "Ukraine",
  }));

  // Coordinates by cityKey: every participant supplies its own lat/lng, with
  // geo.js as a fallback for hub keys that aren't themselves participants.
  const coords = { ...GEO };
  for (const p of participants) {
    coords[p.cityKey] = { lat: p.lat, lng: p.lng, country: p.country };
  }

  buildJourneys(participants, coords);
  const constellations = buildConstellations(participants);

  // Postcard-only contributors: silver stars on the globe. Clicking one
  // opens their actual written cards. Optional file — absence is fine.
  let contributors = [];
  try {
    contributors = (await (await fetch("data/contributors.json", { cache: "no-cache" })).json()).contributors || [];
  } catch { /* no contributors file */ }

  // default globe arcs — one per participant's first leg (city → Sent to)
  const arcs = [];
  for (const p of participants) {
    const dest = coords[p.sentToKey];
    if (!p.sentToKey || !dest) continue;
    arcs.push({
      pid: p.id,
      startLat: p.lat, startLng: p.lng,
      endLat: dest.lat, endLng: dest.lng,
      fromKey: p.cityKey, toKey: p.sentToKey,
      toUkraine: dest.country === "Ukraine",
    });
  }
  // Contributor arcs (white): only for contributors whose `sentTo` is filled.
  for (const c of contributors) {
    const toKey = cityKey(c.sentTo || "");
    const dest = coords[toKey];
    if (!c.sentTo || !dest) continue;
    arcs.push({
      contributor: true,
      startLat: c.lat, startLng: c.lng,
      endLat: dest.lat, endLng: dest.lng,
      fromKey: cityKey(c.place || c.name), toKey,
      toUkraine: dest.country === "Ukraine",
    });
  }

  // hubs (dots, no labels): the distinct Sent-to places
  const hubKeys = [...new Set(participants.map((p) => p.sentToKey).filter((k) => k && coords[k]))];
  const hubs = hubKeys.map((k) => ({ id: "__" + k, key: k, lat: coords[k].lat, lng: coords[k].lng, country: coords[k].country }));

  return { participants, arcs, constellations, contributors, hubs, destinationKey: doc.destination?.name || "Western Ukraine" };
}
