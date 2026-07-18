// Participant side panel: interview media, journey line, postcards.

import { cityShort, thumb, thumbFallback } from "./util.js";
import { openLightbox } from "./lightbox.js";

export function initPanel(data, { onShowJourney, onClose, onLightbox }) {
  const panel = document.getElementById("panel");
  const content = document.getElementById("panel-content");

  document.getElementById("panel-close").addEventListener("click", close);

  // open a group of photos in the shared lightbox (Esc / ← → handled there),
  // pausing the globe's spin behind it for the duration
  function showPhotos(list, start) {
    onLightbox?.(true);
    openLightbox(list, start, () => onLightbox?.(false));
  }

  // Build the readable path from the participant's computed journey legs:
  // e.g. Montreal → Millbrook → Western Ukraine.
  function journeyLine(p) {
    if (!p.journey || !p.journey.length) {
      return `<span class="leg">${cityShort(p.city)}</span>`;
    }
    const stops = [p.journey[0].from, ...p.journey.map((l) => l.to)];
    return stops
      .map((s) => `<span class="leg">${s}</span>`)
      .join('<span class="arrow">&#10148;</span>');
  }

  // youtube.com/watch?v=ID , youtu.be/ID , or an /embed/ID URL → the bare id.
  const youTubeId = (u) => {
    const m = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/.exec(u || "");
    return m ? m[1] : null;
  };

  function mediaBlock(p) {
    const m = p.media;
    if (!m) return postcardBack(p); // postcard-only: quote from their cards
    if (m.type === "video") {
      const yt = youTubeId(m.url || m.src);
      const player = yt
        ? `<div class="p-media p-video"><iframe src="https://www.youtube.com/embed/${yt}" title="${m.title || "Video"}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe></div>`
        : `<div class="p-media"><video controls preload="metadata" src="${m.src || m.url}"></video></div>`;
      // a video interview can still carry a postcard back (quote + portrait);
      // no "read the interview" link — the interview is playing right above it
      return player + (p.pullQuote ? postcardBack(p, { link: false }) : "");
    }
    if (m.type === "audio") {
      return `<div class="p-media"><audio controls preload="metadata" src="${m.src}"></audio></div>`;
    }
    return postcardBack(p);
  }

  // Written interviews render as the back of a postcard: pull-quote in the
  // message area, portrait (or a decorative stamp) in the stamp corner, the
  // participant's city as the postmark, context line, and the blog link.
  function postcardBack(p, opts = {}) {
    const m = p.media;
    // The interview lives on a specific page of the newsletter PDF (#page=N).
    // Chrome's built-in viewer, Firefox and Acrobat honour that fragment, but
    // the Adobe Acrobat *browser extension* silently drops it (a long-standing
    // Adobe bug). Surfacing the page number keeps the reference usable even when
    // the reader lands on page 1.
    const pdfPage = (m?.url?.match(/#page=(\d+)/) || [])[1];
    const facePos = /^face:/.test(p.portraitPosition || "");
    const stamp = p.portrait
      ? `<img class="pb-portrait" src="${thumb(p.portrait)}" data-full="${p.portrait}" alt="Portrait of ${p.name}"${
          p.portraitPosition && !facePos ? ` style="object-position:${p.portraitPosition}"` : ""
        } />`
      : `<span class="pb-stamp-art" aria-hidden="true">&#9993;</span>`;
    return `
      <div class="p-postcard-back">
        <div class="pb-row">
          <blockquote class="pb-quote">&ldquo;${p.pullQuote || m?.title || ""}&rdquo;</blockquote>
          <div class="pb-corner">
            <div class="pb-stamp">${stamp}</div>
            <div class="pb-postmark"><span>${cityShort(p.city)}</span></div>
          </div>
        </div>
        ${p.quoteContext ? `<p class="pb-context">${p.quoteContext}</p>` : ""}
        ${m?.url && opts.link !== false ? `<a class="pb-read" href="${m.url}" target="_blank" rel="noopener">Read the full interview${pdfPage ? ` &mdash; newsletter p.&nbsp;${pdfPage}` : ""} &#8594;</a>` : ""}
      </div>`;
  }

  function open(p) {
    content.innerHTML = `
      <div class="p-name">${p.name}</div>
      <div class="p-place">${[p.city, p.country].filter(Boolean).join(" &middot; ")}</div>
      <p class="p-bio">${p.bio}</p>
      <div class="p-journey">${journeyLine(p)}</div>
      ${
        p.media || p.pullQuote
          ? `<div class="p-section-title">${p.media?.type === "article" ? "Their story" : "In their own words"}</div>
             ${mediaBlock(p)}`
          : ""
      }
      ${
        p.postcards?.length
          ? `<div class="p-section-title">${p.receiving ? "Cards arriving at the front" : "Postcards they sent"}</div>
             <div class="p-postcards">${p.postcards
               .map((src, i) => {
                 // photoPositions (parallel to postcards) nudges the thumbnail
                 // crop so faces in people-photos stay in frame.
                 const pos = p.photoPositions?.[i];
                 return `<img src="${thumb(src)}" data-full="${src}" alt="Postcard by ${p.name}" loading="lazy"${
                   pos ? ` style="object-position:${pos}"` : ""
                 } />`;
               })
               .join("")}</div>`
          : ""
      }
      ${
        p.defenderReplies?.length
          ? `<div class="p-section-title">A reply from the front</div>
             <div class="p-postcards p-replies">${p.defenderReplies
               .map((src) => `<img src="${thumb(src)}" data-full="${src}" alt="Reply from a Defender" loading="lazy" />`)
               .join("")}</div>`
          : ""
      }
      <div class="p-actions"><button id="btn-journey">See the journey on the globe</button></div>
    `;

    // Each photo strip (her postcards; the replies from the front) is its own
    // group: arrow keys browse within the strip that was opened. Strips show
    // thumbnails; the lightbox gets the full-size originals (data-full).
    content.querySelectorAll(".p-postcards").forEach((strip) => {
      const imgs = [...strip.querySelectorAll("img")];
      const group = imgs.map((im) => ({
        src: im.dataset.full, preview: thumb(im.dataset.full),
      })); // no captions in the panel
      imgs.forEach((im, k) => {
        thumbFallback(im, im.dataset.full);
        im.addEventListener("click", () => showPhotos(group, k));
      });
    });
    // The stamp portrait opens full-size in the lightbox too — the stamp
    // crop is tiny, so visitors can see the person properly.
    const stampPortrait = content.querySelector(".pb-portrait");
    if (stampPortrait) {
      thumbFallback(stampPortrait, stampPortrait.dataset.full);
      stampPortrait.addEventListener("click", () => {
        showPhotos([{ src: stampPortrait.dataset.full, preview: thumb(stampPortrait.dataset.full) }], 0);
      });
      // portraitPosition "face:FX% FY% Z" recrops IN THE STAMP ONLY (the jpg is
      // untouched; the lightbox above still shows the whole photo): the image is
      // scaled Z× beyond cover-fit and slid so the face at (FX,FY)% of the photo
      // sits at the stamp's centre, clamped so no gaps show at the edges.
      const fp = /^face:\s*([\d.]+)%\s+([\d.]+)%\s+([\d.]+)\s*$/.exec(p.portraitPosition || "");
      if (fp) {
        const fx = +fp[1] / 100, fy = +fp[2] / 100, z = +fp[3];
        const box = stampPortrait.parentElement; // .pb-stamp
        const place = () => {
          const iw = stampPortrait.naturalWidth, ih = stampPortrait.naturalHeight;
          if (!iw || !ih) return;
          const w = box.clientWidth, h = box.clientHeight;
          const s = Math.max(w / iw, h / ih) * z;
          const W = iw * s, H = ih * s;
          const ox = Math.min(0, Math.max(w - W, w / 2 - fx * W));
          const oy = Math.min(0, Math.max(h - H, h / 2 - fy * H));
          Object.assign(stampPortrait.style, {
            position: "absolute", width: W + "px", height: H + "px",
            left: ox + "px", top: oy + "px", maxWidth: "none",
            objectFit: "fill", objectPosition: "0 0",
          });
        };
        if (stampPortrait.complete) place();
        stampPortrait.addEventListener("load", place); // also re-place after a thumb→full fallback
      }
    }
    content.querySelector("#btn-journey").addEventListener("click", () => onShowJourney(p.id));

    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
  }

  function close() {
    // Stop any playing media when the panel slides away.
    content.querySelectorAll("video, audio").forEach((el) => el.pause());
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    onClose();
  }

  // Esc closes the panel — but if a lightbox is open on top of it, that
  // handler consumes the press (preventDefault), so the first Esc closes
  // only the lightbox and a second closes the panel.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !e.defaultPrevented && panel.classList.contains("open")) {
      close();
    }
  });

  return { open, close };
}
