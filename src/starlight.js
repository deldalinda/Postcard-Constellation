// Starlights — the Defenders' collective gallery. A near-black room where
// arrival photos hang as softly glowing tiles ("every card is a ray of
// sunshine in the kingdom of darkness" — Defender Vadym). Tiles kindle one
// by one the first time the view opens; clicking a photo opens the shared
// lightbox with the newsletter's published caption.
//
// Layout is a Google-Photos-style justified grid: every row is scaled to fill
// the width exactly, each photo keeping its own aspect ratio, so wide and tall
// cells sit side by side with no empty gaps. Quotes ride inline as cells whose
// WIDTH grows with the length of the text — but every quote is set in the same
// (uniform) font size. The one video gets an enlarged feature row.

import { thumb, thumbFallback } from "./util.js";
import { openLightbox } from "./lightbox.js";

export function initStarlight(container) {
  let built = false;
  let kindled = false;
  let wall = null;
  let items = []; // { el, aspect, quote?, video? }

  // A Defender-gallery entry whose `src` is a video (VideoPress or YouTube)
  // renders as an inline player rather than an <img>.
  function videoEmbed(src) {
    let m;
    if ((m = /videopress\.com\/(?:v|embed)\/([\w-]+)/.exec(src || "")))
      return `https://videopress.com/embed/${m[1]}`;
    if ((m = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/.exec(src || "")))
      return `https://www.youtube.com/embed/${m[1]}`;
    return null;
  }

  // Three shorter Defender quotes get a wider cell (same font, more presence).
  const FEATURED_QUOTES = /Your cards, arriving|little holiday in the middle of the front|spread your love across all brigades/i;

  async function build() {
    let doc;
    try {
      doc = await (await fetch("data/defenders.json", { cache: "no-cache" })).json();
    } catch {
      container.innerHTML = "";
      return;
    }
    wall = document.createElement("div");
    wall.className = "sl-wall";
    items = [];
    for (const e of doc.entries || []) {
      if (e.quote) {
        const len = e.quote.length;
        const featured = FEATURED_QUOTES.test(e.quote);
        const q = document.createElement("figure");
        q.className = "sl-tile sl-quote" + (featured ? " sl-feature" : "");
        q.innerHTML =
          `<blockquote>&ldquo;${e.quote}&rdquo;</blockquote>` +
          `<figcaption>&mdash; ${e.attribution}</figcaption>`;
        // A quote takes its own row: the cell WIDTH grows with the text length,
        // and its HEIGHT is measured to the text — so longer quotes get deeper
        // cells and short ones aren't padded out. Font is uniform (set in layout).
        // Vadym's "ray of sunshine" quote is pinned as the gallery's opening item.
        const pinFirst = /^Your cards, arriving/.test(e.quote);
        items.push({ el: q, quote: true, len, featured, pinFirst });
        wall.appendChild(q);
      } else {
        const embed = videoEmbed(e.src);
        if (embed) {
          const t = document.createElement("figure");
          t.className = "sl-tile sl-photo sl-video";
          t.innerHTML =
            `<div class="sl-video-frame"><iframe src="${embed}" title="${e.caption || "Video from the front"}" loading="lazy" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
          items.push({ el: t, aspect: 16 / 9, video: true });
          wall.appendChild(t);
        } else {
          const t = document.createElement("figure");
          t.className = "sl-tile sl-photo";
          // tiles show the 800px thumbnail; the lightbox opens the original
          t.innerHTML =
            `<img src="${thumb(e.src)}" alt="${e.caption}" loading="lazy" />` +
            `<figcaption>${e.date || ""}</figcaption>`;
          const item = {
            el: t,
            // keep the photo's TRUE aspect ratio so its cell matches it exactly
            // and object-fit never has to crop; no clamping.
            aspect: e.w && e.h ? e.w / e.h : 4 / 3,
            src: e.src,
            cap: e.date ? `${e.date} — ${e.caption}` : e.caption,
          };
          const img = t.querySelector("img");
          thumbFallback(img, e.src);
          img.addEventListener("click", () => {
            // the whole gallery (in display order) is one group: ← → browse it
            const photos = items.filter((it) => it.src);
            openLightbox(
              photos.map((it) => ({ src: it.src, cap: it.cap, preview: thumb(it.src) })),
              photos.indexOf(item)
            );
          });
          items.push(item);
          wall.appendChild(t);
        }
      }
    }

    // Chronology doesn't matter here: shuffle the photos, then spread the quotes
    // and the video evenly through them (never at the very end, so each quote has
    // photos after it to share its row). Runs once per load; the layout is stable
    // across resizes because build() only runs once.
    {
      const pinned = items.find((it) => it.pinFirst);
      const photos = items.filter((it) => !it.quote && !it.video);
      const specials = items.filter((it) => (it.quote || it.video) && !it.pinFirst);
      for (let k = photos.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [photos[k], photos[j]] = [photos[j], photos[k]];
      }
      for (let k = specials.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [specials[k], specials[j]] = [specials[j], specials[k]];
      }
      const ordered = [...photos];
      specials.forEach((sp, idx) => {
        const frac = (idx + 1) / (specials.length + 1);
        const pos = Math.min(ordered.length - 1, Math.max(1, Math.round(frac * ordered.length)));
        ordered.splice(pos, 0, sp);
      });
      if (pinned) ordered.unshift(pinned); // Vadym's quote opens the gallery
      items = ordered;
    }

    container.appendChild(wall);
    built = true;
    layout();
    window.addEventListener("resize", onResize);
  }

  // Per-row height rhythm, so the rows aren't all the same height.
  const VAR = [1.0, 0.92, 1.12, 0.88, 1.06, 0.96];

  function layout() {
    if (!wall) return;
    const cw = wall.clientWidth;
    if (!cw) return;
    const gap = 12;
    const baseH = cw < 560 ? 270 : cw < 900 ? 350 : 440;
    const maxH = Math.round(baseH * 1.3); // taller than this = too sparse; fold into the row above
    // ONE uniform quote font for the whole gallery — 30px on desktop, scaled
    // down on smaller screens. The cells vary in size; the type does not.
    const qf = Math.max(16, Math.min(30, Math.round(baseH * 0.068)));
    wall.style.setProperty("--quote-font", qf + "px");

    let y = 0;
    let i = 0;
    let photoRow = 0;
    let quoteIndex = 0;
    let pending = []; // photos accumulated for the current row, not yet placed
    let pendingSum = 0;
    // the most recently placed photo row, kept only while it's still the LAST
    // placed row (a quote/video row after it invalidates it) — the final sparse
    // run folds into it so the gallery ends with a full row, not a gap.
    let lastRun = null;
    const POS = ["left", "right", "center", "left", "center", "right"];

    // Place a run of photos as one justified row: scaled so their true-ratio
    // widths sum EXACTLY to the container width — the row always fills, and no
    // photo is ever cropped. Cumulative rounding keeps the fill pixel-perfect.
    const placeRun = (run, sum, top) => {
      const gaps = gap * (run.length - 1);
      const hEx = (cw - gaps) / sum;
      const h = Math.round(hEx);
      let x = 0, acc = 0;
      run.forEach((p, k) => {
        acc += p.aspect * hEx;
        const right = Math.round(acc) + k * gap;
        const w = Math.max(1, right - x);
        p.el.style.left = x + "px";
        p.el.style.top = top + "px";
        p.el.style.width = w + "px";
        p.el.style.height = h + "px";
        x = right + gap;
      });
      return h;
    };

    const emitPhotos = (final) => {
      if (!pending.length) return;
      const hFit = (cw - gap * (pending.length - 1)) / pendingSum;
      if (final && hFit > maxH && lastRun) {
        // trailing run too sparse to fill at a sane height — fold it into the
        // previous photo row and re-justify the combined row (row gets shorter)
        const run = [...lastRun.items, ...pending];
        y = lastRun.y;
        y += placeRun(run, lastRun.sum + pendingSum, y) + gap;
      } else {
        // justified: fills the width whatever the run size
        if (!final) lastRun = { items: [...pending], sum: pendingSum, y };
        y += placeRun(pending, pendingSum, y) + gap;
      }
      photoRow += 1;
      pending = [];
      pendingSum = 0;
    };

    while (i < items.length) {
      const it = items[i];

      // The one video gets its OWN full-width 16:9 row; a partial photo run
      // carries past it into the next row, so nothing is orphaned above it.
      if (it.video) {
        lastRun = null; // rows above the video can't be re-justified later
        const fH = Math.round(cw * 9 / 16);
        it.el.style.left = "0px";
        it.el.style.top = y + "px";
        it.el.style.width = cw + "px";
        it.el.style.height = fH + "px";
        y += fH + gap;
        i += 1;
        continue;
      }

      // A quote SHARES a row with photos and absorbs the leftover width, so the
      // row fills with no gap. It sits on the left, in the centre, or on the right
      // — the position cycles so it varies down the page. Its height is still
      // measured to the wrapped text (deeper for longer quotes).
      if (it.quote) {
        const qw0 = Math.round(Math.max(cw * 0.28, Math.min(cw * 0.55, 46 * Math.sqrt(it.len))));
        it.el.style.width = qw0 + "px";
        it.el.style.height = "auto";
        const qh = Math.ceil(it.el.getBoundingClientRect().height); // content-fit

        // The photos pending from this run become the quote's companions (so none
        // is orphaned into a gap before it) — unless they're already too wide to
        // leave the quote its room, in which case give them their own row first.
        let cells;
        const pendingW =
          pending.reduce((s, p) => s + Math.round(p.aspect * qh), 0) + pending.length * gap;
        if (pending.length && pendingW > cw - qw0) {
          emitPhotos();
          cells = [];
        } else {
          cells = pending.map((p) => ({ el: p.el, w: Math.round(p.aspect * qh) }));
          pending = [];
          pendingSum = 0;
        }
        // add a few photos from ahead too, keeping the quote at least qw0 wide
        let usedW = cells.reduce((s, c) => s + c.w, 0);
        let j = i + 1;
        while (j < items.length && !items[j].quote && !items[j].video) {
          const w = Math.round(items[j].aspect * qh);
          if (cw - (usedW + w) - (cells.length + 1) * gap < qw0) break;
          cells.push({ el: items[j].el, w });
          usedW += w;
          j += 1;
        }
        const qw = cw - usedW - cells.length * gap; // quote absorbs the leftover → row fills
        const quoteCell = { el: it.el, w: qw };
        const pos = POS[quoteIndex % POS.length];
        quoteIndex += 1;
        let seq;
        if (pos === "left" || !cells.length) seq = [quoteCell, ...cells];
        else if (pos === "right") seq = [...cells, quoteCell];
        else {
          const half = Math.ceil(cells.length / 2);
          seq = [...cells.slice(0, half), quoteCell, ...cells.slice(half)];
        }
        let x = 0;
        for (const c of seq) {
          c.el.style.left = x + "px";
          c.el.style.top = y + "px";
          c.el.style.width = c.w + "px";
          c.el.style.height = qh + "px";
          x += c.w + gap;
        }
        i = j;
        y += qh + gap;
        lastRun = null; // rows above the quote can't be re-justified later
        continue;
      }

      // A photo: add it to the current run, and flush the run into a row once it
      // would fill (its true-ratio widths reach the container at the target height).
      pending.push(it);
      pendingSum += it.aspect;
      i += 1;
      const target = baseH * VAR[photoRow % VAR.length];
      if (pendingSum * target + gap * (pending.length - 1) >= cw) emitPhotos();
    }
    emitPhotos(true); // the final run: folds into the row above if too sparse
    wall.style.height = y + "px";
  }

  let resizeRAF = 0;
  function onResize() {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(layout);
  }

  // Stagger the tiles' first appearance: the room "comes on" like stars at
  // dusk. Runs once, the first time the view is shown.
  function kindle() {
    if (kindled) return;
    kindled = true;
    const tiles = [...container.querySelectorAll(".sl-tile")];
    // Kindle in a gently shuffled order so lighting spreads, not sweeps.
    const order = tiles
      .map((el, i) => ({ el, k: (i * 7919) % tiles.length }))
      .sort((a, b) => a.k - b.k);
    order.forEach(({ el }, i) => {
      setTimeout(() => el.classList.add("lit"), 60 * i + Math.random() * 50);
    });
  }

  build();

  return {
    refresh() {
      if (built) {
        layout();
        kindle();
      } else {
        // data may still be loading on first show; lay out & kindle once it lands
        const wait = setInterval(() => {
          if (built) { clearInterval(wait); layout(); kindle(); }
        }, 120);
      }
    },
  };
}
