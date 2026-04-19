// ── cruiser.js — Sierra-style pixel space cruiser ────────────────────────────
// Arrow keys: left/right steer, up = boost, down = brake.
// Auto-flies rarely; random zoom level each pass; always straight; drop-shadow.

(function () {

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

const RAW_W = S[0].length;
const RAW_H = S.length;

// ── pre-render colour sprite at 1×1px ────────────────────────────────────────
const spr = document.createElement('canvas');
spr.width = RAW_W; spr.height = RAW_H;
const sc = spr.getContext('2d');
S.forEach((row, y) => row.forEach((v, x) => {
  if (!v) return;
  sc.fillStyle = P[v];
  sc.fillRect(x, y, 1, 1);
}));

// ── pre-render shadow sprite — dark blue silhouette ───────────────────────────
const shd = document.createElement('canvas');
shd.width = RAW_W; shd.height = RAW_H;
const shc = shd.getContext('2d');
S.forEach((row, y) => row.forEach((v, x) => {
  if (!v) return;
  shc.fillStyle = 'rgba(8, 16, 60, 0.72)';
  shc.fillRect(x, y, 1, 1);
}));

// ── physics constants ─────────────────────────────────────────────────────────
const ACCEL   = 210;
const BOOST   = 300;
const BRAKE   = 7.0;
const MAX_SPD = 500;
const FRIC    = 0.984;

// ── particles ─────────────────────────────────────────────────────────────────
const particles = [];
function emitParticles(ex, ey, facingRight, count, scale) {
  const dir  = facingRight ? -1 : 1;
  const sz   = Math.max(1, scale * 0.55 | 0);
  for (let i = 0; i < count; i++) {
    particles.push({
      x:     ex + dir * Math.random() * 8 * scale,
      y:     ey + (Math.random() - 0.5) * 5 * scale,
      vx:    dir * (1.2 + Math.random() * 2.5),
      vy:    (Math.random() - 0.5) * 1.0,
      life:  1.0,
      decay: 0.04 + Math.random() * 0.045,
      r:     Math.random() < 0.5 ? sz + 1 : sz,
      col:   `hsl(${(Math.random() * 360) | 0},100%,${55 + (Math.random() * 30) | 0}%)`,
    });
  }
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
let manual      = false;
let x = 0, y = 0, vx = 0;
let facingRight = true;
let displayScale = 3;          // randomised per auto flyby
let dW = RAW_W * 3;            // display width
let dH = RAW_H * 3;            // display height
let passesLeft  = 1;           // auto passes before deactivating
let idleTimer   = null;

// ── keyboard ──────────────────────────────────────────────────────────────────
const CTRL = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const keys = {};

document.addEventListener('keydown', e => {
  if (!CTRL.has(e.code)) return;
  e.preventDefault();
  keys[e.code] = true;
  if (!active) {
    manual      = true;
    displayScale = 3;
    dW = RAW_W * displayScale;
    dH = RAW_H * displayScale;
    facingRight = e.code !== 'ArrowLeft';
    x  = facingRight ? -dW - 10 : window.innerWidth + 10;
    y  = window.innerHeight * 0.42 - dH / 2;
    vx = facingRight ? 55 : -55;
    active = true;
  }
  manual = true;
});
document.addEventListener('keyup', e => { if (CTRL.has(e.code)) keys[e.code] = false; });

// ── auto trigger ──────────────────────────────────────────────────────────────
function trigger() {
  if (active) return;
  manual = false;

  // random zoom: small (distant) to large (close)
  displayScale = 2 + Math.random() * 5.5;   // 2× … 7.5×
  dW = RAW_W * displayScale;
  dH = RAW_H * displayScale;

  facingRight  = Math.random() < 0.5;
  y            = window.innerHeight * (0.08 + Math.random() * 0.78) - dH / 2;
  passesLeft   = Math.random() < 0.25 ? 2 : 1;   // occasionally 2 passes

  const speed  = 55 + Math.random() * 100;
  x            = facingRight ? -dW - 20 : window.innerWidth + 20;
  vx           = facingRight ? speed : -speed;
  active       = true;
  scheduleIdle();
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(trigger, 90000 + Math.random() * 90000);   // 90–180 s
}

// ── render loop ───────────────────────────────────────────────────────────────
let lastTs = null;
function tick(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min((ts - lastTs) * 0.001, 0.05);
  lastTs = ts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (active) {
    if (manual) {
      if (keys.ArrowLeft)  { vx -= ACCEL * dt; facingRight = false; }
      if (keys.ArrowRight) { vx += ACCEL * dt; facingRight = true;  }
      if (keys.ArrowUp)    { vx += (facingRight ? 1 : -1) * BOOST * dt; }
      if (keys.ArrowDown)  { vx *= Math.exp(-BRAKE * dt); }
      vx *= Math.pow(FRIC, dt * 60);
      if (Math.abs(vx) > MAX_SPD) vx = MAX_SPD * Math.sign(vx);
      // wrap
      if (x > window.innerWidth  + dW + 10) x = -dW - 10;
      if (x < -dW - 10)                     x = window.innerWidth + dW + 10;

    } else {
      // auto: straight flight, wrap and count passes
      const exitRight = facingRight  && x > window.innerWidth  + dW + 20;
      const exitLeft  = !facingRight && x < -dW - 20;
      if (exitRight || exitLeft) {
        passesLeft--;
        if (passesLeft <= 0) {
          active = false;
          particles.length = 0;
        } else {
          x = facingRight ? -dW - 20 : window.innerWidth + dW + 20;
          y = window.innerHeight * (0.08 + Math.random() * 0.78) - dH / 2;
        }
      }
    }

    x += vx * dt;
    // no wobble — always straight

    // ── shadow pass (offset lower-right, matching the cat's light direction) ──
    const shadowX = displayScale * 0.8;
    const shadowY = displayScale * 1.1;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.imageSmoothingEnabled = false;
    if (!facingRight) {
      ctx.translate(x + dW + shadowX, y + shadowY);
      ctx.scale(-1, 1);
      ctx.drawImage(shd, 0, 0, dW, dH);
    } else {
      ctx.drawImage(shd, x + shadowX, y + shadowY, dW, dH);
    }
    ctx.restore();

    // ── sprite ────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (!facingRight) {
      ctx.translate(x + dW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, 0, 0, dW, dH);
    } else {
      ctx.drawImage(spr, x, y, dW, dH);
    }
    ctx.restore();

    // ── particles ─────────────────────────────────────────────────────────────
    const pCount = keys.ArrowDown ? 2 : keys.ArrowUp ? 14 : 6;
    const ex = facingRight ? x : x + dW;
    emitParticles(ex, y + dH * 0.5, facingRight, pCount, displayScale);
  }

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
