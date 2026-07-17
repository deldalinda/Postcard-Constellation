// Shared lightbox — one element, one contract, used by every view.
// Open it with a GROUP of photos: Esc closes it wherever it's open, and
// left/right arrow keys (or clicking the image) step through the group.
// A per-open close callback lets the opener restore its own state (e.g.
// the globe resumes its auto-rotation).

const box = document.getElementById("lightbox");
const img = document.getElementById("lightbox-img");
const cap = document.getElementById("lightbox-cap");

let items = []; // [{ src, cap, preview? }]
let idx = 0;
let onClose = null;

function render() {
  const it = items[idx];
  // Progressive: show the small preview instantly, then swap in the
  // full-size original once it has finished loading (guarded so a fast
  // ←/→ browse can't paint a stale image over the current one).
  if (it.preview && it.preview !== it.src) {
    img.src = it.preview;
    const full = new Image();
    full.onload = () => { if (items[idx] === it) img.src = it.src; };
    full.src = it.src;
  } else {
    img.src = it.src;
  }
  const parts = [];
  if (it.cap) parts.push(it.cap);
  if (items.length > 1) parts.push(`${idx + 1} of ${items.length} · ← → to browse`);
  cap.textContent = parts.join(" · ");
}

export function openLightbox(list, start = 0, closeCb = null) {
  items = Array.isArray(list) ? list : [list];
  if (!items.length) return;
  idx = Math.max(0, Math.min(items.length - 1, start));
  onClose = closeCb;
  render();
  box.hidden = false;
}

export function closeLightbox() {
  if (box.hidden) return;
  box.hidden = true;
  items = [];
  idx = 0;
  const cb = onClose;
  onClose = null;
  cb?.();
}

function step(d) {
  if (box.hidden || items.length < 2) return;
  idx = (idx + d + items.length) % items.length;
  render();
}

// clicking the photo steps forward; clicking the backdrop closes
img.addEventListener("click", (e) => {
  if (items.length > 1) {
    e.stopPropagation();
    step(1);
  }
});
box.addEventListener("click", () => closeLightbox());

window.addEventListener("keydown", (e) => {
  if (box.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
});
