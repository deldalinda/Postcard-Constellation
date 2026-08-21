// Pure grouping logic for the Constellations view. Given a participant's public
// (interview-sourced) attributes, decide which named constellations they belong
// to. No DOM, no side effects — unit-tested in test/grouping.test.js.

// Draw order. Figure names live ONLY here.
// mystery: the figure draws but its name/caption never display — visitors
// are left to guess what the stars share.
// revealed: the figure a past round was asking about. It draws WITH its name,
// in gold rather than the map's blue, so it reads as the answer rather than as
// one more figure — see the answer card in index.html.
// hidden: the figure is not drawn at all. Each round leaves exactly ONE
// figure marked mystery, so the sky still asks a single question.
// Round 1 (closed 20 Aug 2026) was The Postcrossers; round 2 (closes
// 20 Oct 2026) is The Classroom. To rotate again, move mystery: true to
// the next figure and swap the hidden flags — nothing else changes.
const FIGURES = [
  { key: "makers",       name: "The Artists",      caption: "they make art",                    source: "hobby", mystery: true, hidden: true },
  { key: "bookish",      name: "The Bookish",      caption: "at home with books and letters",  source: "hobby", mystery: true, hidden: true },
  { key: "openair",      name: "The Open Air",     caption: "at home under open sky",           source: "hobby", mystery: true, hidden: true },
  { key: "music",        name: "The Music-makers", caption: "song and dance",                   source: "hobby", hidden: true },
  { key: "classroom",    name: "The Classroom",    caption: "classrooms, on both shores",       source: "profession", mystery: true, hidden: true },
  { key: "postcrossers", name: "The Postcrossers", caption: "found through Postcrossing",        source: "foundVia", revealed: true },
  { key: "grapevine",    name: "The Grapevine",    caption: "brought by a friend",              source: "foundVia", hidden: true },
  { key: "headlines",    name: "The Headlines",    caption: "found via news & social media",     source: "foundVia", hidden: true },
  { key: "searchers",    name: "The Searchers",    caption: "found by searching",               source: "foundVia", hidden: true },
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
// The Classroom is seen from both desks — students belong to it as much as
// the people who teach them. Matched on the stated profession only.
const STUDENT = ["student","pupil"];
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
    if (EDUCATOR.some((s) => v.includes(s)) || STUDENT.some((s) => v.includes(s))) keys.add("classroom");
    if (ARTIST.some((s) => v.includes(s))) keys.add("makers");
  }
  // A stated tie to a school, heritage school, classroom or youth camp joins
  // The Classroom too — the people who carried the project INTO a school are
  // as much a part of it as those who teach or study there. Free text, so the
  // presence of the attribute is the signal; it is never pattern-matched.
  if (a.schoolTie) keys.add("classroom");
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
    .filter((f) => !f.hidden)
    .filter((f) => members.get(f.key).length >= 3)
    .map((f) => ({ key: f.key, name: f.name, caption: f.caption,
                   mystery: !!f.mystery, revealed: !!f.revealed,
                   members: members.get(f.key) }));
}
