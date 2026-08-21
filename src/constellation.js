// Constellations — participants as stars in overlapping figures, like the
// real sky where Alpheratz belongs to Pegasus AND Andromeda. Every shared
// public attribute with 3+ people is a figure (see buildConstellations in
// grouping.js). Stars settle inside a 3D ball via a small force simulation;
// each figure is drawn as one open chain through its members (nearest-
// neighbour + 2-opt), the way real atlas figures are single winding lines
// rather than closed rings or branchy trees. Selecting a star lights ALL its
// figures; connection is expressed through shared figure membership, plus a
// few curated companion bonds.

import { cityShort } from "./util.js";

export function initConstellation(canvas, data, onSelect) {
  const ctx = canvas.getContext("2d");
  const { participants, constellations = [] } = data;

  // Deterministic per-string jitter so the sky looks the same on every visit.
  function hash01(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }

  // --- constellation layout ---------------------------------------------------
  // Figures may overlap (a star can belong to several). Figures carry no fixed
  // centre of their own: where each one sits in space emerges from the force
  // layout below (its live centre of mass). Here we just need the figure
  // metadata and an empty node list to fill.
  const groups = constellations.map((g) => ({
    ...g, c: { x: 0, y: 0, z: 0 }, nodes: [],
  }));

  const groupsOf = new Map(); // star id -> all its groups
  for (const g of groups) {
    for (const id of g.members) {
      if (!groupsOf.has(id)) groupsOf.set(id, []);
      groupsOf.get(id).push(g);
    }
  }

  // Every star lives inside a 3D BALL, not just on the shell — figures cluster
  // in space and the interior is used, so the cloud reads with real depth as it
  // turns. Start each star at a deterministic point inside the ball.
  const spiral = Math.PI * (3 - Math.sqrt(5));
  const nodes = participants.map((p, i) => {
    const yy = 1 - ((i + 0.5) / participants.length) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const th = i * spiral;
    const rad = 0.4 + 0.55 * hash01(p.id); // varied radius → fills the interior
    return {
      p, groups: groupsOf.get(p.id) || [],
      bx: Math.cos(th) * rr * rad, by: yy * rad, bz: Math.sin(th) * rr * rad,
      sx: 0, sy: 0, depth: 0, persp: 1,
      phase: Math.random() * Math.PI * 2, dph: 0.2 + Math.random() * 0.5,
    };
  });
  const nodeById = new Map(nodes.map((n) => [n.p.id, n]));
  for (const g of groups) g.nodes = g.members.map((id) => nodeById.get(id)).filter(Boolean);

  // A small force simulation settles the cloud into a sphere. Each star drifts
  // toward the shell radius, so the single-figure and unaffiliated stars form a
  // spherical crust; each star is also pulled toward the live centre of every
  // figure it belongs to, so the multi-figure "bridge" people get tugged inward
  // and inhabit the interior (someone in several figures sits BETWEEN them, and
  // the links stay short). All stars repel so nothing piles up. The result is
  // roughly a 70% crust / 30% core split — never snapped onto the surface, so
  // the depth is real.
  {
    const N = nodes.length;
    const MIN_SEP = 0.44, K_COH = 0.05, K_RAD = 0.045, R_TARGET = 0.9, R_MAX = 1.05;
    // Lone (figure-less) stars have no cohesion pulling them inward, so with the
    // same radial target they'd ride the outer wall, detached from the cloud.
    // A smaller target seats them just outside the figure crust instead.
    const R_LONE = 0.74;
    const K_FILL = 0.002; // long-range push felt only by lone stars (shell-filling)
    const fx = new Float64Array(N), fy = new Float64Array(N), fz = new Float64Array(N);
    const recentre = () => {
      for (const g of groups) {
        let cx = 0, cy = 0, cz = 0;
        for (const m of g.nodes) { cx += m.bx; cy += m.by; cz += m.bz; }
        const k = g.nodes.length || 1;
        g.c.x = cx / k; g.c.y = cy / k; g.c.z = cz / k;
      }
    };
    for (let pass = 0; pass < 260; pass++) {
      fx.fill(0); fy.fill(0); fz.fill(0);
      recentre();
      // cohesion: toward the centre of every figure the star belongs to
      for (let i = 0; i < N; i++) {
        const n = nodes[i];
        for (const g of n.groups) {
          fx[i] += (g.c.x - n.bx) * K_COH;
          fy[i] += (g.c.y - n.by) * K_COH;
          fz[i] += (g.c.z - n.bz) * K_COH;
        }
      }
      // repulsion: 3D soft core so nothing overlaps
      for (let i = 0; i < N; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < N; j++) {
          const b = nodes[j];
          const dx = a.bx - b.bx, dy = a.by - b.by, dz = a.bz - b.bz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= MIN_SEP * MIN_SEP) continue;
          const d = Math.sqrt(d2) || 1e-6;
          const f = 0.5 * (MIN_SEP - d) / d;
          fx[i] += dx * f; fy[i] += dy * f; fz[i] += dz * f;
          fx[j] -= dx * f; fy[j] -= dy * f; fz[j] -= dz * f;
        }
      }
      // lone (figure-less) stars feel a gentle long-range push from every other
      // star, so they drift into the empty pockets of the shell and round out
      // the sphere. The push is projected TANGENTIALLY (its radial component is
      // stripped), so it spreads them across the shell but can never shove them
      // outward — the radial spring alone decides how far out they sit.
      for (let i = 0; i < N; i++) {
        const a = nodes[i];
        if (a.groups.length) continue;
        let px = 0, py = 0, pz = 0;
        for (let j = 0; j < N; j++) {
          if (j === i) continue;
          const b = nodes[j];
          const dx = a.bx - b.bx, dy = a.by - b.by, dz = a.bz - b.bz;
          const d2 = dx * dx + dy * dy + dz * dz;
          const d = Math.sqrt(d2) || 1e-6;
          const f = K_FILL / (d2 + 0.15);
          px += (dx / d) * f; py += (dy / d) * f; pz += (dz / d) * f;
        }
        const ar = Math.hypot(a.bx, a.by, a.bz) || 1e-6;
        const rx = a.bx / ar, ry = a.by / ar, rz = a.bz / ar;
        const dot = px * rx + py * ry + pz * rz;
        fx[i] += px - dot * rx; fy[i] += py - dot * ry; fz[i] += pz - dot * rz;
      }
      // integrate, then a radial spring toward the shell + a soft outer wall.
      // The spring pulls stars out to R_TARGET; cohesion is what holds the
      // multi-figure bridges inward, so the crust/core split emerges on its own.
      for (let i = 0; i < N; i++) {
        const n = nodes[i];
        n.bx += fx[i]; n.by += fy[i]; n.bz += fz[i];
        const r = Math.hypot(n.bx, n.by, n.bz) || 1e-6;
        const rT = n.groups.length ? R_TARGET : R_LONE;
        const pull = K_RAD * (rT - r) / r;
        n.bx += n.bx * pull; n.by += n.by * pull; n.bz += n.bz * pull;
        if (r > R_MAX) { const s = R_MAX / r; n.bx *= s; n.by *= s; n.bz *= s; }
      }
      // keep the cloud centred on the origin so it can't drift off to one side
      let mx = 0, my = 0, mz = 0;
      for (let i = 0; i < N; i++) { mx += nodes[i].bx; my += nodes[i].by; mz += nodes[i].bz; }
      mx /= N; my /= N; mz /= N;
      for (let i = 0; i < N; i++) { nodes[i].bx -= mx; nodes[i].by -= my; nodes[i].bz -= mz; }
    }
    recentre();
  }

  // Curated companion bonds: each home base's steward and their companion — a
  // pet, or a partner in life. Pull the companion (a background star) in beside
  // its steward and tie them with a warm thread, so the relationship reads apart
  // from the attribute figures.
  const BOND_PAIRS = [
    ["mr-cat", "tamara"],      // Ukraine base — Mr. Cat & Tamara
    ["charlie", "peter"],      // Australia branch — Charlie & Peter
    ["jean-michel", "helen"],  // Canada branch — Jean-Michel & Helen (a couple)
  ];
  const bonds = [];
  const bondPartner = new Map(); // node -> its bonded node (both directions)
  for (const [aid, bid] of BOND_PAIRS) {
    const na = nodeById.get(aid), nb = nodeById.get(bid);
    if (!na || !nb) continue;
    // Seat a companion that has no figure of its own a relaxed step from its
    // steward. One that belongs to a figure (e.g. Jean-Michel among The Artists)
    // keeps its place there; the bond simply reaches across, so we never distort
    // that figure's shape.
    if (na.groups.length === 0) {
      const ref = Math.abs(nb.by) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      let ux = nb.by * ref.z - nb.bz * ref.y, uy = nb.bz * ref.x - nb.bx * ref.z, uz = nb.bx * ref.y - nb.by * ref.x;
      const ul = Math.hypot(ux, uy, uz) || 1e-6; ux /= ul; uy /= ul; uz /= ul;
      const off = 0.3; // a short step to one side of the steward, inside the ball
      na.bx = nb.bx + ux * off; na.by = nb.by + uy * off; na.bz = nb.bz + uz * off;
    }
    bonds.push({ a: na, b: nb });
    bondPartner.set(na, nb); bondPartner.set(nb, na);
  }

  // Figure lines. Each figure is drawn as ONE open chain through all its
  // members — the way real atlas figures read (Draco's fourteen stars are a
  // single winding line). A minimum spanning tree is shorter but its branchy
  // forks read as a net, not a constellation. Nearest-neighbour walk from an
  // extremal star, then 2-opt passes unkink the chain (figures are small).
  const figureEdges = [];
  for (const g of groups) {
    const m = g.nodes;
    if (m.length < 2) continue;
    let cx = 0, cy = 0, cz = 0;
    for (const s of m) { cx += s.bx; cy += s.by; cz += s.bz; }
    cx /= m.length; cy /= m.length; cz /= m.length;
    g.labelDir = { x: cx, y: cy, z: cz }; // label at the figure's 3D centre
    const d2 = (a, b) => (a.bx - b.bx) ** 2 + (a.by - b.by) ** 2 + (a.bz - b.bz) ** 2;
    // start at the member farthest from the centroid — a natural end of the figure
    let start = 0, far = -1;
    m.forEach((s, i) => {
      const d = (s.bx - cx) ** 2 + (s.by - cy) ** 2 + (s.bz - cz) ** 2;
      if (d > far) { far = d; start = i; }
    });
    const path = [m[start]];
    const left = new Set(m.filter((_, i) => i !== start));
    while (left.size) {
      const tail = path[path.length - 1];
      let nb = null, bd = Infinity;
      for (const s of left) { const d = d2(tail, s); if (d < bd) { bd = d; nb = s; } }
      path.push(nb);
      left.delete(nb);
    }
    // 2-opt: reverse segments while it shortens the chain — untangles switchbacks
    const len = (a, b) => Math.sqrt(d2(a, b));
    let improved = true, guard = 0;
    while (improved && guard++ < 40) {
      improved = false;
      for (let i = 0; i < path.length - 2; i++) {
        for (let j = i + 2; j < path.length - 1; j++) {
          if (len(path[i], path[i + 1]) + len(path[j], path[j + 1]) >
              len(path[i], path[j]) + len(path[i + 1], path[j + 1]) + 1e-9) {
            for (let lo = i + 1, hi = j; lo < hi; lo++, hi--) {
              const t = path[lo]; path[lo] = path[hi]; path[hi] = t;
            }
            improved = true;
          }
        }
      }
    }
    for (let k = 0; k < path.length - 1; k++) {
      figureEdges.push({ a: path[k], b: path[k + 1], group: g });
    }
  }

  // Space the figure "cores". Related figures cluster (they share members), so
  // two constellation labels can land almost on top of each other and become
  // hard to read or click (e.g. The Postcrossers vs The Open Air). Push the
  // label positions apart in 3D to a minimum separation — this moves only the
  // labels, never the stars.
  {
    const labelled = groups.filter((g) => g.labelDir);
    const MIN_LBL = 0.44;
    for (let pass = 0; pass < 60; pass++) {
      for (let i = 0; i < labelled.length; i++) {
        for (let j = i + 1; j < labelled.length; j++) {
          const a = labelled[i].labelDir, b = labelled[j].labelDir;
          const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          if (d >= MIN_LBL) continue;
          const push = 0.5 * (MIN_LBL - d) / d;
          a.x += dx * push; a.y += dy * push; a.z += dz * push;
          b.x -= dx * push; b.y -= dy * push; b.z -= dz * push;
        }
      }
    }
  }

  // A star shares a figure with another if any of its groups overlap — or if the
  // two are bonded companions.
  const shareFigure = (a, b) =>
    a.groups.some((g) => b.groups.includes(g)) || bondPartner.get(a) === b;

  // --- camera -----------------------------------------------------------------
  const cam = { rotY: 0.5, rotX: -0.15, zoom: 1, panX: 0, panY: 0 };
  let W = 0, H = 0, SCALE = 1;
  const FOCAL = 3.0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function needsLayout() {
    return (
      canvas.width !== Math.round(canvas.clientWidth * devicePixelRatio) ||
      canvas.height !== Math.round(canvas.clientHeight * devicePixelRatio)
    );
  }
  function layout() {
    W = canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    H = canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
    SCALE = Math.min(W, H) * 0.4;
  }

  function projectDir(x, y, z) {
    const cY = Math.cos(cam.rotY), sY = Math.sin(cam.rotY);
    const x1 = x * cY + z * sY;
    const z1 = -x * sY + z * cY;
    const cX = Math.cos(cam.rotX), sX = Math.sin(cam.rotX);
    const y2 = y * cX - z1 * sX;
    const z2 = y * sX + z1 * cX;
    const persp = FOCAL / (FOCAL - z2);
    return {
      sx: W / 2 + cam.panX + x1 * SCALE * cam.zoom * persp,
      sy: H * 0.52 + cam.panY - y2 * SCALE * cam.zoom * persp,
      depth: z2,
      persp,
    };
  }

  function project(n, t) {
    const d = 0.035; // gentle drift — small enough to keep the figures crisp
    const pr = projectDir(
      n.bx + Math.sin(t * 0.0002 * n.dph + n.phase) * d,
      n.by + Math.cos(t * 0.00017 * n.dph + n.phase) * d,
      n.bz + Math.sin(t * 0.00023 * n.dph + n.phase * 1.7) * d
    );
    n.sx = pr.sx; n.sy = pr.sy; n.depth = pr.depth; n.persp = pr.persp;
  }

  // --- selection & focus ------------------------------------------------------
  let selected = null;
  let hovered = null;
  let hoveredGroup = null; // constellation whose NAME the pointer is over
  let targetRotY = cam.rotY, targetRotX = cam.rotX, targetZoom = cam.zoom;
  let targetPanX = 0, targetPanY = 0;
  function faceNode(n) {
    const mag = Math.hypot(n.bx, n.bz) || 1e-6;
    targetRotY = Math.atan2(-n.bx, n.bz);
    targetRotX = clamp(Math.atan2(n.by, mag), -1.2, 1.2);
    targetPanX = 0; targetPanY = 0; // glide back to centre when focusing a star
  }
  function select(node) {
    selected = node;
    if (node) faceNode(node);
  }

  // --- interaction ------------------------------------------------------------
  function nodeAt(mx, my) {
    const x = mx * devicePixelRatio, y = my * devicePixelRatio;
    let best = null, bestD = 30 * devicePixelRatio;
    for (const n of nodes) {
      const d = Math.hypot(n.sx - x, n.sy - y);
      const r = (n.hitR || 20);
      const tol = Math.max(bestD, r);
      if (d < tol && d < (best ? bestD : tol)) { best = n; bestD = d; }
    }
    return best;
  }

  function labelAt(mx, my) {
    const x = mx * devicePixelRatio, y = my * devicePixelRatio;
    let best = null, bestD = 26 * devicePixelRatio;
    for (const g of groups) {
      if (g._lsx == null) continue;
      const d = Math.hypot(g._lsx - x, g._lsy - y);
      if (d < bestD) { best = g; bestD = d; }
    }
    return best;
  }

  let dragging = false, panning = false, dragMoved = false, lastX = 0, lastY = 0;
  let spinResumeAt = 0; // idle auto-rotation stays paused until this timestamp
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 1) {
      // Middle button "lifts" the whole cloud — a screen-space pan, as in 3D
      // software. preventDefault stops the browser's autoscroll widget.
      e.preventDefault();
      panning = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = "move";
      return;
    }
    if (e.button !== 0) return;
    dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    if (panning) {
      const s = devicePixelRatio; // pan lives in canvas (device) pixels
      cam.panX += (e.clientX - lastX) * s;
      cam.panY += (e.clientY - lastY) * s;
      targetPanX = cam.panX; targetPanY = cam.panY;
      lastX = e.clientX; lastY = e.clientY; hovered = null; hoveredGroup = null;
      return;
    }
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      targetRotY += dx * 0.006;
      targetRotX = clamp(targetRotX + dy * 0.006, -1.35, 1.35);
      cam.rotY += dx * 0.006; cam.rotX = clamp(cam.rotX + dy * 0.006, -1.35, 1.35);
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
      lastX = e.clientX; lastY = e.clientY; hovered = null; hoveredGroup = null;
      return;
    }
    hovered = nodeAt(e.clientX - r.left, e.clientY - r.top);
    hoveredGroup = hovered ? null : labelAt(e.clientX - r.left, e.clientY - r.top);
    canvas.style.cursor = hovered || hoveredGroup ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; hoveredGroup = null; });
  canvas.addEventListener("pointerup", (e) => {
    if (panning) {
      panning = false; canvas.style.cursor = "grab";
      spinResumeAt = performance.now() + 4000;
      return;
    }
    if (!dragging) return;
    dragging = false; canvas.style.cursor = "grab";
    spinResumeAt = performance.now() + 4000; // a click/drag freezes the drift briefly
    if (dragMoved) return;
    const r = canvas.getBoundingClientRect();
    const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (n) { select(n); onSelect(n.p.id); }
    else { select(null); onSelect(null); }
  });
  // Middle-click paste/autoscroll must not fire on the sky.
  canvas.addEventListener("auxclick", (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    targetZoom = clamp(targetZoom * Math.exp(-e.deltaY * 0.0012), 0.55, 3);
    spinResumeAt = performance.now() + 4000;
  }, { passive: false });

  // --- render -----------------------------------------------------------------
  let frameCount = 0, lastError = null;
  function frame(t) {
    try { frameInner(t); } catch (err) { lastError = String(err.stack || err); }
    requestAnimationFrame(frame);
  }
  function frameInner(t) {
    frameCount++;
    if (needsLayout()) layout();
    const dpr = devicePixelRatio;

    if (!dragging && !selected && t >= spinResumeAt) targetRotY += 0.0008;
    cam.rotY += (targetRotY - cam.rotY) * 0.08;
    cam.rotX += (targetRotX - cam.rotX) * 0.08;
    cam.zoom += (targetZoom - cam.zoom) * 0.1;
    cam.panX += (targetPanX - cam.panX) * 0.1;
    cam.panY += (targetPanY - cam.panY) * 0.1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (const n of nodes) project(n, t);
    const order = [...nodes].sort((a, b) => a.depth - b.depth);

    const focus = selected || hovered;
    const activeGroups = hoveredGroup ? [hoveredGroup] : (focus ? focus.groups : null);
    const isLit = (n) => {
      if (hoveredGroup) return n.groups.includes(hoveredGroup);
      return !selected || n === selected || shareFigure(n, selected);
    };

    // figure lines — the constellation branches, silvery like a star atlas
    for (const e of figureEdges) {
      const near = ((e.a.depth + e.b.depth) / 2 + 1) / 2;
      const active = activeGroups?.includes(e.group) ?? false;
      const dim = selected && !active;
      let alpha = 0.16 * (0.35 + 0.65 * near);
      if (active) alpha = 0.5;
      if (dim) alpha *= 0.25;
      ctx.strokeStyle = `rgba(200, 206, 244, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (active ? 1.2 : 0.7) * dpr;
      ctx.beginPath();
      ctx.moveTo(e.a.sx, e.a.sy);
      ctx.lineTo(e.b.sx, e.b.sy);
      ctx.stroke();
    }

    // companion bonds — a warm gold thread tying each home base's steward to
    // their companion (a pet, or a partner in life).
    for (const e of bonds) {
      const near = ((e.a.depth + e.b.depth) / 2 + 1) / 2;
      const lit = isLit(e.a) || isLit(e.b);
      const alpha = (lit ? 0.62 : selected ? 0.12 : 0.36) * (0.4 + 0.6 * near);
      ctx.strokeStyle = `rgba(232, 196, 118, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (lit ? 1.4 : 1) * dpr;
      ctx.beginPath();
      ctx.moveTo(e.a.sx, e.a.sy);
      ctx.lineTo(e.b.sx, e.b.sy);
      ctx.stroke();
    }

    // constellation names — printed on the sky like a celestial map
    for (const g of groups) {
      // a mystery figure never shows its name (nor offers a hover target):
      // visitors are left to guess what its stars share
      if (g.mystery) { g._lsx = null; continue; }
      const dir = g.labelDir || g.c;
      const pr = projectDir(dir.x, dir.y, dir.z);
      if (pr.depth < -0.4) { g._lsx = null; continue; } // clearly behind — not hoverable
      g._lsx = pr.sx; g._lsy = pr.sy;
      const a = Math.min(1, (pr.depth + 0.75) * 1.1) *
        (activeGroups && !activeGroups.includes(g) ? 0.3 : 0.85);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = `500 ${12.5 * dpr}px "Jost", sans-serif`;
      // A revealed figure (the answer to a past round) is named in gold, so it
      // reads as the solution rather than as ordinary map furniture.
      ctx.fillStyle = g.revealed ? "rgba(232, 196, 118, 0.95)" : "rgba(151, 176, 230, 0.9)";
      const nm = g.name.toUpperCase().split("").join(" ");
      ctx.fillText(nm, pr.sx, pr.sy - 4 * dpr);
      ctx.font = `italic 400 ${11 * dpr}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillStyle = g.revealed ? "rgba(232, 196, 118, 0.7)" : "rgba(151, 176, 230, 0.65)";
      // The caption fades on the far side of the sphere, most in the wide
      // (zoomed-out) view where a back caption would land across someone's name;
      // zoom in and the captions stay legible all the way round.
      const zoomIn = clamp((cam.zoom - 1.0) / 0.8, 0, 1);
      const frontness = clamp((pr.depth + 0.25) / 0.5, 0, 1);
      ctx.globalAlpha = a * (zoomIn + (1 - zoomIn) * frontness);
      ctx.fillText(g.caption, pr.sx, pr.sy + 12 * dpr);
      ctx.globalAlpha = 1;
    }

    // stars + names (near ones on top)
    for (const n of order) {
      const isSel = n === selected;
      const isHover = n === hovered;
      const lit = isLit(n);
      const tw = 0.6 + 0.4 * Math.sin(n.phase + t / 900);
      const baseAlpha = lit ? 1 : 0.16;
      const nearFade = 0.55 + 0.45 * ((n.depth + 1) / 2);

      // starburst with diffraction spikes
      const glow = (isSel ? 16 : isHover ? 12 : 7 * tw) * n.persp;
      ctx.globalAlpha = baseAlpha * nearFade;
      const size = (isSel ? 4.5 : 3) * n.persp * dpr;
      const rayRGB = n.p.receiving ? "188, 217, 255" : "244, 227, 184";
      const rayLen = size * (isSel || isHover ? 6.5 : 3.6 + 2.2 * tw);
      const diagLen = rayLen * 0.42;
      // soft glowing halo behind the star, twinkling and swelling on focus
      const haloR = size * ((isSel || isHover ? 4.2 : 3.0) + 0.8 * tw);
      const hg = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, haloR);
      hg.addColorStop(0, `rgba(${rayRGB}, 0.34)`);
      hg.addColorStop(0.45, `rgba(${rayRGB}, 0.12)`);
      hg.addColorStop(1, `rgba(${rayRGB}, 0)`);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, haloR, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 8; k++) {
        const diag = k >= 4;
        const ang = diag ? (Math.PI / 4) * (2 * (k - 4) + 1) : (Math.PI / 2) * k;
        const len = diag ? diagLen : rayLen;
        const ex = n.sx + Math.cos(ang) * len;
        const ey = n.sy + Math.sin(ang) * len;
        const g = ctx.createLinearGradient(n.sx, n.sy, ex, ey);
        g.addColorStop(0, `rgba(${rayRGB}, 0.9)`);
        g.addColorStop(0.35, `rgba(${rayRGB}, 0.35)`);
        g.addColorStop(1, `rgba(${rayRGB}, 0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = (diag ? 0.7 : 1.05) * dpr;
        ctx.beginPath();
        ctx.moveTo(n.sx, n.sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.shadowColor = n.p.receiving ? "rgba(150,200,255,0.9)" : "rgba(232,196,118,0.9)";
      ctx.shadowBlur = glow * dpr;
      ctx.fillStyle = n.p.receiving ? "#bcd9ff" : "#f4e3b8";
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, size * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // name — warm serif (gold when focused)
      const fs = (isSel ? 26 : isHover ? 21 : 16) * n.persp * dpr;
      ctx.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillStyle = isSel || isHover ? "#e8c476" : "#f6ecc9";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4 * dpr;
      ctx.fillText(n.p.name, n.sx, n.sy - 10 * n.persp * dpr);
      ctx.shadowBlur = 0;
      n.hitR = (ctx.measureText(n.p.name).width / 2 + 8 * dpr);

      if (isSel || isHover) {
        ctx.font = `400 ${10 * dpr}px "Jost", sans-serif`;
        ctx.fillStyle = "#ef9188";
        ctx.fillText(cityShort(n.p.city).toUpperCase(), n.sx, n.sy + 16 * n.persp * dpr);
      }
      ctx.globalAlpha = 1;
    }
  }

  // no resize listeners needed: the frame loop re-checks needsLayout() each frame
  layout();
  requestAnimationFrame(frame);

  canvas.__debug = {
    nodes, figureEdges, groups,
    get selected() { return selected; },
    get frames() { return frameCount; }, get lastError() { return lastError; },
  };

  return {
    selectParticipant(id) {
      select(id ? nodeById.get(id) ?? null : null);
    },
    refresh() { if (needsLayout()) layout(); },
  };
}
