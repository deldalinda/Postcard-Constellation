// One idle gate for the whole exhibition — "is anyone actually watching?"
//
// iOS does not keep a tab that never falls quiet. Leave the exhibition sitting
// on an iPhone and the content process was jettisoned: the page came back
// reloaded, and under repeated pressure Safari gave up on it altogether. Every
// animated surface here used to carry its own visibility listener and its own
// 30-second timer, and each was fixed separately — which is exactly how the
// globe's vendored dash ticker slipped through and held the page at ~240
// requestAnimationFrame callbacks a second with the phone face down in a
// pocket. There is one source of truth now, and everything that animates
// subscribes to it.
//
// Asleep means: hidden tab (every device), or — on a phone — a spell with no
// touch, scroll or key. Any interaction wakes everything together.

const PHONE = window.innerWidth < 820;
const IDLE_MS = PHONE ? 30000 : 0; // desktop only sleeps when the tab hides
const SLEEP_FRAME_MS = 500;        // asleep, a "frame" comes twice a second
const HANDLE_BASE = 1e9;           // keeps our handles clear of rAF's own ids

let awake = true;
let idleTimer = null;
const sleepers = new Set();
const wakers = new Set();

// Loops inside code we do not own cannot be stopped from here: globe.gl's
// per-layer tickers (the travelling arc dashes, the ring pulses) keep their own
// requestAnimationFrame running straight through its documented
// pauseAnimation(), and that alone kept this page at full frame rate forever.
// So while the exhibition is asleep, requestAnimationFrame hands out a 2fps
// timer instead of a real frame. Nothing starves — every callback still runs,
// just rarely — and the loops that cost real work are stopped outright by their
// owners below. Our handles are offset so cancelAnimationFrame can tell the two
// kinds apart and never cancels an unrelated frame.
const rawRaf = window.requestAnimationFrame.bind(window);
const rawCaf = window.cancelAnimationFrame.bind(window);
window.requestAnimationFrame = (cb) =>
  awake
    ? rawRaf(cb)
    : HANDLE_BASE + setTimeout(() => cb(performance.now()), SLEEP_FRAME_MS);
window.cancelAnimationFrame = (id) =>
  id >= HANDLE_BASE ? clearTimeout(id - HANDLE_BASE) : rawCaf(id);

function arm() {
  if (!IDLE_MS) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(sleep, IDLE_MS);
}

function sleep() {
  clearTimeout(idleTimer);
  idleTimer = null;
  if (!awake) return;
  awake = false;
  for (const cb of sleepers) cb();
}

function wake() {
  if (awake) { arm(); return; } // an interaction also pushes the deadline back
  awake = true;
  for (const cb of wakers) cb();
  arm();
}

document.addEventListener("visibilitychange", () => (document.hidden ? sleep() : wake()));
["pointerdown", "touchstart", "touchmove", "wheel", "keydown"].forEach((ev) =>
  window.addEventListener(ev, wake, { passive: true })
);
arm();

export const isAwake = () => awake;
export const onSleep = (cb) => sleepers.add(cb);
export const onWake = (cb) => wakers.add(cb);
