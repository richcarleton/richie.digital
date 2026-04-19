// ── walker.js — moonwalking balding leisure suit guy ─────────────────────────
// Faces RIGHT, always moves LEFT. That's the whole joke.

(function () {

const P = [
  null,       // 0  transparent
  '#f5b87a',  // 1  skin
  '#c07030',  // 2  shadow skin
  '#5c2a08',  // 3  hair (sparse)
  '#ede0a8',  // 4  suit cream
  '#c8a050',  // 5  suit shadow / lapel
  '#fcfcf4',  // 6  shirt white
  '#1c0c05',  // 7  shoe
  '#9a6218',  // 8  belt
  '#180808',  // 9  eye
];

// Body rows 0-10 — static across all frames
const BODY = [
  [0,0,0,1,1,0,0,0,0,0],   // bald head (tiny tuft)
  [0,0,3,1,1,1,3,0,0,0],   // head, wispy side hair
  [0,0,3,1,1,1,3,0,0,0],
  [0,0,0,2,9,1,0,0,0,0],   // eye, facing right
  [0,0,0,1,1,0,0,0,0,0],   // chin
  [0,0,0,1,0,0,0,0,0,0],   // neck
  [0,5,5,4,4,4,5,5,0,0],   // suit shoulder / wide lapels
  [5,4,6,4,4,6,4,4,5,0],   // V-neck + shirt peek
  [0,5,4,4,4,4,4,5,0,0],   // suit body
  [0,5,4,4,4,4,4,5,0,0],
  [0,0,8,8,8,8,8,0,0,0],   // belt
];

// 4 moonwalk leg frames (rows 11-15)
// Left foot = left side of sprite, right foot = right side
// Moonwalk trick: one foot flat, other on tiptoe (heel raised)
const LEGS = [
  // F0: left foot flat, right on tiptoe — gliding left
  [
    [0,0,4,4,0,4,4,0,0,0],
    [0,4,5,0,0,0,5,4,0,0],
    [4,5,5,0,0,0,5,5,0,0],
    [7,7,0,0,0,0,0,7,0,0],
    [0,0,0,0,0,0,0,7,0,0],   // right heel up — just toe showing
  ],
  // F1: mid-slide transition
  [
    [0,0,4,4,0,4,4,0,0,0],
    [0,4,5,0,0,0,5,4,0,0],
    [4,5,5,0,0,4,5,5,0,0],
    [7,7,0,0,0,5,5,7,0,0],
    [0,0,0,0,0,7,7,0,0,0],
  ],
  // F2: right foot flat, left on tiptoe
  [
    [0,0,4,4,0,4,4,0,0,0],
    [0,4,5,0,0,0,5,4,0,0],
    [0,5,5,4,0,0,5,5,4,0],
    [0,7,0,0,0,0,7,7,7,0],
    [0,7,0,0,0,0,0,0,0,0],   // left heel up — just toe showing
  ],
  // F3: mid-slide transition (opposite)
  [
    [0,0,4,4,0,4,4,0,0,0],
    [0,4,5,0,0,0,5,4,0,0],
    [0,4,5,5,0,0,5,5,4,0],
    [0,5,5,7,0,0,7,7,7,0],
    [0,7,7,0,0,0,0,0,0,0],
  ],
];

const SW = 10, SH = 16;

// Pre-render 4 colour frames + 4 shadow frames
const frames  = [];
const shadows = [];
for (let f = 0; f < 4; f++) {
  const rows = [...BODY, ...LEGS[f]];

  const fc = document.createElement('canvas');
  fc.width = SW; fc.height = SH;
  const fctx = fc.getContext('2d');
  rows.forEach((row, y) => row.forEach((v, x) => {
    if (!v) return;
    fctx.fillStyle = P[v];
    fctx.fillRect(x, y, 1, 1);
  }));
  frames.push(fc);

  const sc = document.createElement('canvas');
  sc.width = SW; sc.height = SH;
  const sctx = sc.getContext('2d');
  rows.forEach((row, y) => row.forEach((v, x) => {
    if (!v) return;
    sctx.fillStyle = 'rgba(8, 15, 55, 0.68)';
    sctx.fillRect(x, y, 1, 1);
  }));
  shadows.push(sc);
}

// Main canvas
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3;';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// State
let active     = false;
let x          = 0;
let y          = 0;
let vx         = 0;
let dScale     = 4;
let dW         = SW * dScale;
let dH         = SH * dScale;
let frame      = 0;
let frameTimer = 0;
const ANIM_FPS = 8;
let idleTimer  = null;

function trigger() {
  if (active) return;
  dScale = 3 + Math.random() * 3.5;   // 3× to 6.5× — sometimes tiny, sometimes thicc
  dW     = SW * dScale;
  dH     = SH * dScale;
  x      = window.innerWidth + dW + 10;
  y      = window.innerHeight * (0.12 + Math.random() * 0.68) - dH / 2;
  vx     = -(38 + Math.random() * 42); // always shuffles LEFT
  frame  = 0;
  frameTimer = 0;
  active = true;
  scheduleIdle();
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(trigger, 180000 + Math.random() * 180000); // 3–6 min
}

let lastTs = null;
function tick(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min((ts - lastTs) * 0.001, 0.05);
  lastTs = ts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (active) {
    x += vx * dt;

    frameTimer += dt;
    if (frameTimer >= 1 / ANIM_FPS) {
      frame = (frame + 1) % 4;
      frameTimer = 0;
    }

    // Shadow — offset lower-right, consistent with main cat's light direction
    const shx = dScale * 0.9;
    const shy = dScale * 1.2;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(shadows[frame], x + shx, y + shy, dW, dH);
    ctx.restore();

    // Sprite — NEVER flipped, always faces right while moving left
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frames[frame], x, y, dW, dH);
    ctx.restore();

    if (x < -dW - 20) {
      active = false;
    }
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
scheduleIdle();

window.triggerWalker = trigger;

})();
