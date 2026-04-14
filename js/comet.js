// ── Comet controller ──────────────────────────────────────────────────────────
// Trigger: spacebar, any MIDI note-on (via midi.js), or auto after idle.

let cometActive = false;
let cometPhase  = -1.0;
const COMET_SPEED = 0.32; // 0→1 in ~3s

let cometFrom = [-1, 0];
let cometTo   = [ 1, 0];

let idleTimer = null;

function randomCometPath() {
  const edge   = Math.floor(Math.random() * 4);
  const margin = 0.95;
  let from, to;
  if (edge === 0) {       // left → right
    from = [-margin, (Math.random() - 0.5) * 0.7];
    to   = [ margin, (Math.random() - 0.5) * 0.7];
  } else if (edge === 1) { // right → left
    from = [ margin, (Math.random() - 0.5) * 0.7];
    to   = [-margin, (Math.random() - 0.5) * 0.7];
  } else if (edge === 2) { // top → bottom
    from = [(Math.random() - 0.5) * 1.2,  margin];
    to   = [(Math.random() - 0.5) * 1.2, -margin];
  } else {                 // bottom → top
    from = [(Math.random() - 0.5) * 1.2, -margin];
    to   = [(Math.random() - 0.5) * 1.2,  margin];
  }
  return { from, to };
}

function triggerComet() {
  if (cometActive) return;
  const { from, to } = randomCometPath();
  cometFrom  = from;
  cometTo    = to;
  cometPhase = 0.0;
  cometActive = true;
  scheduleIdle();
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  // auto-fire again after 20–50s of no input
  idleTimer = setTimeout(triggerComet, 20000 + Math.random() * 30000);
}

function resetIdle() {
  scheduleIdle();
}

// ── update loop ───────────────────────────────────────────────────────────────
let lastTs = null;

function tick(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = (ts - lastTs) * 0.001;
  lastTs = ts;

  if (cometActive) {
    cometPhase += dt * COMET_SPEED;
    if (cometPhase >= 1.0) {
      cometPhase  = -1.0;
      cometActive = false;
    }
  }

  if (window.planetUniforms) {
    window.planetUniforms.setCometPhase(cometPhase);
    window.planetUniforms.setCometFrom(cometFrom[0], cometFrom[1]);
    window.planetUniforms.setCometTo(cometTo[0], cometTo[1]);
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ── keyboard trigger ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  resetIdle();
  if (e.code === 'Space') {
    e.preventDefault();
    triggerComet();
  }
});

// ── kick off idle timer ───────────────────────────────────────────────────────
scheduleIdle();

// ── expose for midi.js ────────────────────────────────────────────────────────
window.triggerComet    = triggerComet;
window.resetCometIdle  = resetIdle;
