// ── Comet controller ──────────────────────────────────────────────────────────
// Trigger: spacebar, any MIDI note-on (via midi.js), or auto after idle.

let cometActive = false;
let cometPhase  = -1.0;
let cometSpeed  = 0.192; // 40% slower than original 0.32
let cometSize   = 1.0;   // set fresh each trigger
let cometFrom   = [-1, 0];
let cometTo     = [ 1, 0];

let idleTimer = null;

function randomCometPath() {
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
  return { from, to };
}

function triggerComet() {
  if (cometActive) return;
  const { from, to } = randomCometPath();
  cometFrom  = from;
  cometTo    = to;
  cometPhase = 0.0;
  cometSize  = 0.4 + Math.random() * 1.6; // 0.4× tiny to 2.0× large
  cometSpeed = 0.12 + Math.random() * 0.15; // vary speed too for depth feel
  cometActive = true;
  scheduleIdle();
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  // 40% less frequent than before: 28–70s idle window
  idleTimer = setTimeout(triggerComet, 28000 + Math.random() * 42000);
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
    cometPhase += dt * cometSpeed;
    if (cometPhase >= 1.0) {
      cometPhase  = -1.0;
      cometActive = false;
    }
  }

  if (window.planetUniforms) {
    window.planetUniforms.setCometPhase(cometPhase);
    window.planetUniforms.setCometFrom(cometFrom[0], cometFrom[1]);
    window.planetUniforms.setCometTo(cometTo[0], cometTo[1]);

    // size pulses gently as it moves — parallax shimmer
    const pulsedSize = cometActive
      ? cometSize * (1.0 + 0.18 * Math.sin(cometPhase * Math.PI * 5))
      : 1.0;
    window.planetUniforms.setCometSize(pulsedSize);
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

scheduleIdle();

window.triggerComet   = triggerComet;
window.resetCometIdle = resetIdle;
