// Ambient starfield behind every view — slow twinkle like the kiosk's night sky.

// A full-screen 2D canvas at the raw device pixel ratio is 3.0M pixels on a
// phone, cleared and repainted every frame alongside the WebGL globe's own
// render loop. Two full-screen surfaces animating at 60fps was enough for iOS
// to kill the content process a few seconds after load — silently, with
// nothing in the console. Phones get a 1x buffer and a 30fps repaint; the
// stars are 1-2px dots that twinkle slowly, so neither is visible. Desktop is
// unchanged.
const PHONE = window.innerWidth < 820;
const SF_DPR = PHONE ? 1 : (window.devicePixelRatio || 1);
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
  // reclaims a tab that keeps working with nobody watching, so the loop stops
  // when the page is hidden and, on a phone, after a spell of no interaction.
  // Any touch restarts it.
  const SF_IDLE_MS = PHONE ? 30000 : 0;
  let idleT = null;

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    clearTimeout(idleT);
  }

  function start() {
    if (!running) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
    if (SF_IDLE_MS) {
      clearTimeout(idleT);
      idleT = setTimeout(stop, SF_IDLE_MS);
    }
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  ["pointerdown", "touchstart", "touchmove", "wheel", "keydown"].forEach((ev) =>
    window.addEventListener(ev, start, { passive: true })
  );

  resize();
  start();
}
