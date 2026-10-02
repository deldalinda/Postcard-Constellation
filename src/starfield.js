// Ambient starfield behind every view — slow twinkle like the kiosk's night sky.

import { onSleep, onWake } from "./awake.js";
import { PHONE, canvasDpr } from "./util.js";

// The twinkle is a full-screen 2D canvas, cleared and repainted alongside the
// globe's own render loop, so it takes the shared ceiling (MAX_DPR, util.js).
// It was held at 1x on phones for a while: the stars are 1-2px dots, and at a
// third of the screen's resolution they lost their points and read as smudges,
// which bought 3 MB and no stability — the repaint that mattered is the one
// that used to run with nobody watching, and that stops now (see awake.js).
const SF_DPR = canvasDpr();

// Half the repaints on a phone, though. The twinkle cycles over seconds, so
// 30fps is indistinguishable from 60 and costs half the fill — the one change
// in this file that was free.
const SF_MIN_FRAME_MS = PHONE ? 33 : 0;
export function initStarfield(canvas) {
  const ctx = canvas.getContext("2d");
  let stars = [];
  let running = false;
  let rafId = null;

  function resize() {
    canvas.width = window.innerWidth * SF_DPR;
    canvas.height = window.innerHeight * SF_DPR;
    const count = Math.round((window.innerWidth * window.innerHeight) / 2600);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: (Math.random() * 1.1 + 0.3) * SF_DPR,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.8,
    }));
  }

  let lastPaint = 0;
  function frame(t) {
    if (!running) return;
    // Slow twinkle: 30fps on a phone is indistinguishable and halves the fill.
    if (SF_MIN_FRAME_MS && t - lastPaint < SF_MIN_FRAME_MS) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    lastPaint = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#eceafb";
    for (const s of stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase + (t / 1000) * s.speed));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (running) rafId = requestAnimationFrame(frame);
  }

  // This repainted for as long as the page was open, phone locked or not. iOS
  // reclaims a tab that keeps working with nobody watching, so the twinkle
  // sleeps with the rest of the exhibition — see awake.js for when that is.
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  onSleep(stop);
  onWake(start);

  resize();
  start();
}
