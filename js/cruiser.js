// ── cruiser.js — Sierra-style pixel space cruiser ────────────────────────────
// Pre-renders a pixel-art sprite and slides it across the screen.

(function () {

// ── sprite palette ────────────────────────────────────────────────────────────
const P = [
  null,         // 0  transparent
  '#0b1628',    // 1  darkest hull
  '#163354',    // 2  dark hull
  '#225080',    // 3  hull base
  '#3a7ab8',    // 4  hull mid
  '#60a8e8',    // 5  hull light
  '#9fd0ff',    // 6  specular
  '#00ddff',    // 7  window cyan
  '#005577',    // 8  window frame
  '#004466',    // 9  window dark
  '#cc3300',    // 10 engine shadow
  '#ff6600',    // 11 engine mid
  '#ffdd00',    // 12 engine bright
  '#ffffff',    // 13 hotspot
];

// Ship sprite — 20 wide × 9 tall, nose points RIGHT
// Flip horizontally when flying right→left
const S = [
  [0, 0, 0, 0, 0, 0, 0, 3, 4, 5, 6, 5, 4, 3, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 2, 3, 4, 5, 6,13, 6, 5, 4, 3, 2, 0, 0, 0, 0],
  [0,10, 2, 3, 3, 4, 5, 6, 6, 8, 7, 7, 8, 6, 5, 4, 3, 2, 0, 0],
  [12,11,10, 2, 3, 4, 5, 6, 5, 4, 4, 4, 5, 6, 5, 4, 4, 3, 2, 1],
  [12,12,11,10, 2, 3, 4, 5, 6, 5, 5, 5, 4, 5, 6, 5, 4, 4, 3, 2],
  [12,12,11,10, 2, 3, 4, 5, 6, 5, 5, 5, 4, 5, 6, 5, 4, 4, 3, 2],
  [12,11,10, 2, 3, 4, 5, 6, 5, 4, 4, 4, 5, 6, 5, 4, 4, 3, 2, 1],
  [0,10, 2, 3, 3, 4, 5, 6, 6, 8, 7, 7, 8, 6, 5, 4, 3, 2, 0, 0],
  [0, 0, 0, 0, 0, 2, 3, 4, 5, 6,13, 6, 5, 4, 3, 2, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 3, 4, 5, 6, 5, 4, 3, 0, 0, 0, 0, 0, 0],
];

const SCALE = 5;
const SW = S[0].length * SCALE;  // sprite width in screen px
const SH = S.length    * SCALE;  // sprite height in screen px

// ── pre-render sprite to offscreen canvas ─────────────────────────────────────
const spr = document.createElement('canvas');
spr.width  = S[0].length;
spr.height = S.length;
const sc = spr.getContext('2d');
S.forEach((row, y) => {
  row.forEach((v, x) => {
    if (!v) return;
    sc.fillStyle = P[v];
    sc.fillRect(x, y, 1, 1);
  });
});

// ── engine particles ──────────────────────────────────────────────────────────
const particles = [];
function emitParticles(ex, ey, facingRight) {
  const dir = facingRight ? -1 : 1;
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: ex + dir * Math.random() * 12,
      y: ey + (Math.random() - 0.5) * 6,
      vx: dir * (1.5 + Math.random() * 3),
      vy: (Math.random() - 0.5) * 1.2,
      life: 1.0,
      decay: 0.035 + Math.random() * 0.04,
      r: Math.random() < 0.5 ? 3 : 2,
      col: Math.random() < 0.5 ? '#ffdd00' : '#ff6600',
    });
  }
  // cap
  if (particles.length > 120) particles.splice(0, particles.length - 120);
}

// ── main canvas ───────────────────────────────────────────────────────────────
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3;';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// ── state ─────────────────────────────────────────────────────────────────────
let active      = false;
let x           = 0;
let y           = 0;
let vx          = 0;
let facingRight = true;   // nose pointing right
let wobble      = 0;      // phase for vertical drift
let wobbleAmp   = 0;
let wobbleFreq  = 0;
let idleTimer   = null;

function trigger() {
  if (active) return;
  facingRight = Math.random() < 0.5;
  y = window.innerHeight * (0.15 + Math.random() * 0.65) - SH / 2;
  wobbleAmp  = 4 + Math.random() * 10;
  wobbleFreq = 0.4 + Math.random() * 0.6;
  wobble     = 0;
  const speed = 55 + Math.random() * 65;

  if (facingRight) {
    x  = -SW - 20;
    vx =  speed;
  } else {
    x  = window.innerWidth + 20;
    vx = -speed;
  }
  active = true;
  scheduleIdle();
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(trigger, 45000 + Math.random() * 55000);
}

// ── render loop ───────────────────────────────────────────────────────────────
let lastTs = null;
function tick(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min((ts - lastTs) * 0.001, 0.05);
  lastTs = ts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (active) {
    x      += vx * dt;
    wobble += wobbleFreq * dt;
    const drawY = y + Math.sin(wobble * Math.PI * 2) * wobbleAmp;

    // engine exhaust origin (left edge of sprite when facing right)
    const ex = facingRight ? x : x + SW;
    const ey = drawY + SH * 0.5;
    emitParticles(ex, ey, facingRight);

    // draw sprite
    ctx.save();
    if (!facingRight) {
      ctx.translate(x + SW, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, 0, 0, SW, SH);
    } else {
      ctx.drawImage(spr, x, drawY, SW, SH);
    }
    ctx.restore();

    // offscreen check
    if ((facingRight && x > window.innerWidth + SW + 20) ||
        (!facingRight && x < -SW - 20)) {
      active = false;
      particles.length = 0;
    }
  }

  // draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x   += p.vx;
    p.y   += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.r, p.r);
  }
  ctx.globalAlpha = 1;

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
scheduleIdle();

window.triggerCruiser = trigger;

})();
