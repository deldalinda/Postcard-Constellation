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
export const FIGURES = [
  { key: "makers",       name: "The Artists",      caption: "they make art",                    source: "hobby" },
  { key: "bookish",      name: "The Bookish",      caption: "at home with books and letters",  source: "hobby", hidden: true },
  { key: "openair",      name: "The Open Air",     caption: "at home under open sky",           source: "hobby", hidden: true },
  { key: "music",        name: "The Music-makers", caption: "song and dance",                   source: "hobby", hidden: true },
  { key: "stamps",       name: "The Philatelists", caption: "they collect stamps",              source: "hobby", hidden: true },
  { key: "carers",       name: "The Carers",       caption: "they nurse and heal",              source: "profession" },
  { key: "companions",   name: "The Companions",   caption: "they share their home with an animal", source: "pets", hidden: true },
  { key: "rally",        name: "The Rally",        caption: "they stand up in public for Ukraine", source: "rally", mystery: true,
    question: { closes: "20 December", hint: "Here is a clue: it is something they do in public." },
    answer: { round: "Round three", word: "The rally", closed: "20 December",
      line: "The hidden thread through this sky was the rally. Every one of these writers stands up for Ukraine in public \u2014 outside an embassy, on a city square, every week and in every weather." } },
  { key: "classroom",    name: "The Classroom",    caption: "classrooms, on both shores",       source: "profession", hidden: true,
    answer: { round: "Round two", word: "The classroom", closed: "20 October",
      line: "The hidden thread through this sky was the classroom. Every one of these writers teaches, studies, or carried the project into a school, a heritage school or a summer camp \u2014 on both shores.",
      accepted: "We were not after exact words: education, educator, teacher, teaching, student, pupil, studying, school, classroom \u2014 any of these, or anything like them, counted as a correct answer." } },
  { key: "postcrossers", name: "The Postcrossers", caption: "found through Postcrossing",        source: "foundVia", hidden: true,
    answer: { round: "Round one", word: "Postcrossing", closed: "20 August",
      line: "The hidden thread through August\u2019s sky was Postcrossing \u2014 the postcard-exchange community where those writers found the project, and each other." } },
  { key: "grapevine",    name: "The Grapevine",    caption: "brought by a friend",              source: "foundVia", hidden: true },
  { key: "headlines",    name: "The Headlines",    caption: "found via news & social media",     source: "foundVia", hidden: true },
  { key: "searchers",    name: "The Searchers",    caption: "found by searching",               source: "foundVia", hidden: true },
];

const HOBBY_BUCKETS = {
  // The Artists admits only a NAMED art or craft practice. Generic tokens
  // ("art making", "crafting", "colouring") describe making one's own cards —
  // which every participant does — so they deliberately do NOT qualify.
  makers:  ["paint","draw","sketch","calligraph","knit","embroider","sew","crochet","quilt","photo","zentangle","doodle","potter","ceramic","sculpt","watercolour","watercolor","illustrat","printmak","collage","philagraph"],
  // Stamps are their own figure, not a kind of reading: philately is a
  // collector's pursuit, and Linda keeps the two apart (2026-11-22).
  bookish: ["read","letter","writing","stationery","postcard collect","book","poetry","theatre"],
  stamps:  ["stamp collect","philatel"],
  openair: ["hik","bik","cycl","camp","walk","garden","fish","kayak","swim","bird","nature","travel","beekeep"],
  music:   ["music","sing","choir","bandura","piano","guitar","dance","danc"],
};
const EDUCATOR = ["teacher","educator","academic","professor","lecturer"];
// Those who tend the sick for a living. Matched on the stated profession only.
const CARER = ["nurse","pharmac","medic","doctor","paramedic"];
// The Classroom is seen from both desks — students belong to it as much as
// the people who teach them. Matched on the stated profession only.
const STUDENT = ["student","pupil"];
// An art/craft profession also places someone in The Artists.
const ARTIST = ["artist","photograph","illustrat","design","potter","sculpt","calligraph","printmak"];

function hobbyFigure(h) {
  const v = (h || "").toLowerCase();
  for (const key of ["stamps", "makers", "bookish", "openair", "music"]) {
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
    if (CARER.some((s) => v.includes(s))) keys.add("carers");
  }
  // A stated tie to a school, heritage school, classroom or youth camp joins
  // The Classroom too — the people who carried the project INTO a school are
  // as much a part of it as those who teach or study there. Free text, so the
  // presence of the attribute is the signal; it is never pattern-matched.
  if (a.schoolTie) keys.add("classroom");
  // Likewise free text: a stated habit of protesting or rallying in public.
  // Its presence is the signal; the wording is only there for the record.
  if (a.rallies) keys.add("rally");
  // Any named animal at home. Presence is the signal, as with schoolTie.
  if ((a.pets || []).length) keys.add("companions");
  if (a.foundVia) { const k = foundViaFigure(a.foundVia); if (k) keys.add(k); }
  return keys;
}

// Linda's rule (22 Nov 2026): a sky holds AT MOST three figures, the unnamed
// mystery one included. More than that and the lines tangle into a web nobody
// can read. Stars outside them simply shine alone.
export const MAX_FIGURES = 3;

// Drawn constellations from the roster. Figure kept only if >= 3 members.
// Returned in FIGURES order; members are participant ids. If a release ever
// leaves more than MAX_FIGURES drawable, the mystery is kept first and the
// rest are cut in FIGURES order (tools/release.py refuses such a sky anyway).
export function buildConstellations(participants) {
  const members = new Map(FIGURES.map((f) => [f.key, []]));
  for (const p of participants) {
    for (const key of figuresFor(p.publicAttrs)) members.get(key).push(p.id);
  }
  const drawn = FIGURES
    .filter((f) => !f.hidden)
    .filter((f) => members.get(f.key).length >= 3);
  const keep = new Set([...drawn.filter((f) => f.mystery), ...drawn.filter((f) => !f.mystery)]
    .slice(0, MAX_FIGURES));
  return drawn
    .filter((f) => keep.has(f))
    .map((f) => ({ key: f.key, name: f.name, caption: f.caption,
                   mystery: !!f.mystery, revealed: !!f.revealed,
                   answer: f.answer || null,
                   question: f.question || null,
                   members: members.get(f.key) }));
}
