// ── sticker.js — orbital cat sticker flyby ───────────────────────────────────
// Follows the same Bézier orbital paths as comets.
// Loads img/sticker.png — falls back to 🐱 emoji if not found.
// Triggered randomly; spacebar also fires one alongside a comet.

const STICKER_SRC = 'img/sticker.png';

// ── shader-space → CSS pixel conversion ──────────────────────────────────────
function toCss(sx, sy) {
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  return [
    sx *  minDim + window.innerWidth  / 2,
    sy * -minDim + window.innerHeight / 2   // flip Y: shader Y-up → CSS Y-down
  ];
}

// ── create element ────────────────────────────────────────────────────────────
let el = null;

function buildElement() {
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:2',
    'display:none',
    'transform-origin:center center',
    'will-change:transform',
  ].join(';');

  const img = document.createElement('img');
  img.src = STICKER_SRC;
  img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';

  img.onerror = () => {
    // no image yet — use emoji cat
    wrap.removeChild(img);
    const span = document.createElement('span');
    span.textContent = '🐱';
    span.style.cssText = 'display:block;font-size:inherit;line-height:1;user-select:none';
    wrap.appendChild(span);
  };

  wrap.appendChild(img);
  document.body.appendChild(wrap);
  el = wrap;
}

// ── state ─────────────────────────────────────────────────────────────────────
let active      = false;
let phase       = -1;
let speed       = 0.10;
let spinAngle   = 0;
let spinRate    = 0;
let stickerSize = 64;
let from, ctrl, to;

let idleTimer = null;

function trigger() {
  if (active || !el) return;
  const path = window.randomOrbitalPath ? window.randomOrbitalPath() : fallbackPath();
  from  = path.from;
  ctrl  = path.ctrl;
  to    = path.to;
  phase = 0;
  speed = 0.08 + Math.random() * 0.12;
  spinAngle = Math.random() * 360;
  spinRate  = (Math.random() * 360 + 120) * (Math.random() < 0.5 ? 1 : -1); // deg/s
  stickerSize = 40 + Math.random() * 80;
  el.style.width  = stickerSize + 'px';
  el.style.height = stickerSize + 'px';
  // emoji size driven by font-size
  const span = el.querySelector('span');
  if (span) span.style.fontSize = stickerSize * 0.8 + 'px';
  el.style.display = 'block';
  active = true;
  scheduleIdle();
}

function fallbackPath() {
  return {
    from: [-0.95, 0],
    ctrl: [0, (Math.random() - 0.5) * 0.2],
    to:   [ 0.95, 0]
  };
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  // offset from comet schedule so they don't always coincide
  idleTimer = setTimeout(trigger, 35000 + Math.random() * 50000);
}

// ── update loop ───────────────────────────────────────────────────────────────
let lastTs = null;

function tick(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = (ts - lastTs) * 0.001;
  lastTs = ts;

  if (active && el) {
    phase += dt * speed;

    if (phase >= 1.0) {
      phase  = -1;
      active = false;
      el.style.display = 'none';
    } else {
      const bzPos = window.bzPos || defaultBzPos;
      const pos   = bzPos(from, ctrl, to, phase);
      const [cx, cy] = toCss(pos[0], pos[1]);

      spinAngle += spinRate * dt;

      el.style.transform = [
        `translate(${(cx - stickerSize / 2).toFixed(1)}px,`,
        `${(cy - stickerSize / 2).toFixed(1)}px)`,
        `rotate(${spinAngle.toFixed(1)}deg)`
      ].join(' ');
    }
  }

  requestAnimationFrame(tick);
}

function defaultBzPos(p0, p1, p2, t) {
  const m = 1 - t;
  return [
    m*m*p0[0] + 2*m*t*p1[0] + t*t*p2[0],
    m*m*p0[1] + 2*m*t*p1[1] + t*t*p2[1]
  ];
}

// ── boot ──────────────────────────────────────────────────────────────────────
buildElement();
requestAnimationFrame(tick);
scheduleIdle();

// also fire when spacebar triggers a comet (after a short delay)
const _origTrigger = window.triggerComet;
document.addEventListener('keydown', e => {
  if (e.code === 'Space') setTimeout(trigger, 400 + Math.random() * 800);
});

window.triggerSticker = trigger;
