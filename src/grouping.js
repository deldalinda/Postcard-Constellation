// Pure grouping logic for the Constellations view. Given a participant's public
// (interview-sourced) attributes, decide which named constellations they belong
// to. No DOM, no side effects — unit-tested in test/grouping.test.js.

// Draw order. Figure names live ONLY here.
const FIGURES = [
  { key: "makers",       name: "The Artists",      caption: "they make art",                    source: "hobby" },
  { key: "bookish",      name: "The Bookish",      caption: "at home with books and letters",  source: "hobby" },
  { key: "openair",      name: "The Open Air",     caption: "at home under open sky",           source: "hobby" },
  { key: "music",        name: "The Music-makers", caption: "song and dance",                   source: "hobby" },
  { key: "teachers",     name: "The Teachers",     caption: "teachers on both shores",          source: "profession" },
  { key: "postcrossers", name: "The Postcrossers", caption: "found through Postcrossing",        source: "foundVia" },
  { key: "grapevine",    name: "The Grapevine",    caption: "brought by a friend",              source: "foundVia" },
  { key: "headlines",    name: "The Headlines",    caption: "found via news & social media",     source: "foundVia" },
  { key: "searchers",    name: "The Searchers",    caption: "found by searching",               source: "foundVia" },
];

const HOBBY_BUCKETS = {
  // The Artists admits only a NAMED art or craft practice. Generic tokens
  // ("art making", "crafting", "colouring") describe making one's own cards —
  // which every participant does — so they deliberately do NOT qualify.
  makers:  ["paint","draw","sketch","calligraph","knit","embroider","sew","crochet","quilt","photo","zentangle","doodle","potter","ceramic","sculpt","watercolour","watercolor","illustrat","printmak","collage","philagraph"],
  bookish: ["read","letter","writing","stationery","postcard collect","stamp collect","book","poetry","theatre"],
  openair: ["hik","bik","cycl","camp","walk","garden","fish","kayak","swim","bird","nature","travel","beekeep"],
  music:   ["music","sing","choir","bandura","piano","guitar","dance","danc"],
};
const EDUCATOR = ["teacher","educator","academic","professor","lecturer"];
// An art/craft profession also places someone in The Artists.
const ARTIST = ["artist","photograph","illustrat","design","potter","sculpt","calligraph","printmak"];

function hobbyFigure(h) {
  const v = (h || "").toLowerCase();
  for (const key of ["makers", "bookish", "openair", "music"]) {
    if (HOBBY_BUCKETS[key].some((s) => v.includes(s))) return key;
  }
  return null;
}

function foundViaFigure(f) {
  const v = (f || "").toLowerCase();
  if (v.includes("postcrossing") || v.includes("giveaway")) return "postcrossers";
  if (["news", "nafo", "social", "media", " x"].some((s) => v.includes(s))) return "headlines";
  if (v.includes("search") || v.includes("online")) return "searchers";
  if (["friend", "forward", "meeting", "visitor", "market", "campaign", "event", "helen"].some((s) => v.includes(s))) return "grapevine";
  return null;
}

// The set of figure keys a participant's public attributes place them in.
export function figuresFor(publicAttrs) {
  const a = publicAttrs || {};
  const keys = new Set();
  for (const h of a.hobbies || []) { const k = hobbyFigure(h); if (k) keys.add(k); }
  for (const pr of a.professions || []) {
    const v = (pr || "").toLowerCase();
    if (EDUCATOR.some((s) => v.includes(s))) keys.add("teachers");
    if (ARTIST.some((s) => v.includes(s))) keys.add("makers");
  }
  if (a.foundVia) { const k = foundViaFigure(a.foundVia); if (k) keys.add(k); }
  return keys;
}

// Drawn constellations from the roster. Figure kept only if >= 3 members.
// Returned in FIGURES order; members are participant ids.
export function buildConstellations(participants) {
  const members = new Map(FIGURES.map((f) => [f.key, []]));
  for (const p of participants) {
    for (const key of figuresFor(p.publicAttrs)) members.get(key).push(p.id);
  }
  return FIGURES
    .filter((f) => members.get(f.key).length >= 3)
    .map((f) => ({ key: f.key, name: f.name, caption: f.caption, members: members.get(f.key) }));
}
