// ── Comet controller ──────────────────────────────────────────────────────────
// Orbital Bézier trajectories — curves around the planet at screen centre.

// ── Bézier helpers ────────────────────────────────────────────────────────────
function bzPos(p0, p1, p2, t) {
  const m = 1 - t;
  return [
    m*m*p0[0] + 2*m*t*p1[0] + t*t*p2[0],
    m*m*p0[1] + 2*m*t*p1[1] + t*t*p2[1]
  ];
}
function bzTan(p0, p1, p2, t) {
  const dx = 2*(1-t)*(p1[0]-p0[0]) + 2*t*(p2[0]-p1[0]);
  const dy = 2*(1-t)*(p1[1]-p0[1]) + 2*t*(p2[1]-p1[1]);
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  return [dx/len, dy/len];
}

// ── orbital path generation ───────────────────────────────────────────────────
function randomOrbitalPath() {
  const edge   = Math.floor(Math.random() * 4);
  const margin = 0.95;
  let from, to;
  if (edge === 0) {
    from = [-margin, (Math.random() - 0.5) * 0.7];
    to   = [ margin, (Math.random() - 0.5) * 0.7];
  } else if (edge === 1) {
    from = [ margin, (Math.random() - 0.5) * 0.7];
    to   = [-margin, (Math.random() - 0.5) * 0.7];
  } else if (edge === 2) {
    from = [(Math.random() - 0.5) * 1.2,  margin];
    to   = [(Math.random() - 0.5) * 1.2, -margin];
  } else {
    from = [(Math.random() - 0.5) * 1.2, -margin];
    to   = [(Math.random() - 0.5) * 1.2,  margin];
  }
  // Control point perpendicular to the chord — bows path around the planet
  const cx = to[0] - from[0], cy = to[1] - from[1];
  const len = Math.sqrt(cx*cx + cy*cy) || 1;
  const perp = [-cy / len, cx / len];                    // unit perpendicular
  const mid  = [(from[0]+to[0])/2, (from[1]+to[1])/2];
  const swing = (0.28 + Math.random() * 0.28) * (Math.random() < 0.5 ? 1 : -1);
  const ctrl  = [mid[0] + perp[0]*swing, mid[1] + perp[1]*swing];
  return { from, ctrl, to };
}

// ── state ─────────────────────────────────────────────────────────────────────
let cometActive = false;
let cometPhase  = -1.0;
let cometSpeed  = 0.192;
let cometSize   = 1.0;
let cometFrom, cometCtrl, cometTo;

let idleTimer = null;

function triggerComet() {
  if (cometActive) return;
  const { from, ctrl, to } = randomOrbitalPath();
  cometFrom  = from;
  cometCtrl  = ctrl;
  cometTo    = to;
  cometPhase = 0.0;
  cometSize  = 0.4 + Math.random() * 1.6;
  cometSpeed = 0.12 + Math.random() * 0.15;
  cometActive = true;
  scheduleIdle();
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(triggerComet, 28000 + Math.random() * 42000);
}
function resetIdle() { scheduleIdle(); }

// ── update loop ───────────────────────────────────────────────────────────────
let lastTs = null;
function tick(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = (ts - lastTs) * 0.001;
  lastTs = ts;

  if (cometActive) {
    cometPhase += dt * cometSpeed;
    if (cometPhase >= 1.0) {
      cometPhase  = -1.0;
      cometActive = false;
    }
  }

  window._cometActive = cometActive;

  if (window.planetUniforms) {
    window.planetUniforms.setCometPhase(cometPhase);

    if (cometActive) {
      const pos  = bzPos(cometFrom, cometCtrl, cometTo, cometPhase);
      const dir  = bzTan(cometFrom, cometCtrl, cometTo, cometPhase);
      const size = cometSize * (1.0 + 0.18 * Math.sin(cometPhase * Math.PI * 5));
      window.planetUniforms.setCometPos(pos[0], pos[1]);
      window.planetUniforms.setCometDir(dir[0], dir[1]);
      window.planetUniforms.setCometSize(size);
    }
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ── keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  resetIdle();
  if (e.code === 'Space') { e.preventDefault(); triggerComet(); }
});

scheduleIdle();

window.triggerComet   = triggerComet;
window.resetCometIdle = resetIdle;
// expose path helpers for sticker.js
window.randomOrbitalPath = randomOrbitalPath;
window.bzPos = bzPos;
window.bzTan = bzTan;
