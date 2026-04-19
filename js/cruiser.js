// ── cruiser.js — Sierra-style pixel space cruiser ────────────────────────────
// Arrow keys: left/right steer, up = boost, down = brake.
// Auto-flies across screen periodically when idle.

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

// Ship sprite — 20 wide × 10 tall, nose points RIGHT
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

const SCALE = 3;                      // smaller than before (was 5)
const SW = S[0].length * SCALE;
const SH = S.length    * SCALE;

// ── pre-render sprite ─────────────────────────────────────────────────────────
const spr = document.createElement('canvas');
spr.width  = S[0].length;
spr.height = S.length;
const sc = spr.getContext('2d');
S.forEach((row, y) => row.forEach((v, x) => {
  if (!v) return;
  sc.fillStyle = P[v];
  sc.fillRect(x, y, 1, 1);
}));

// ── physics constants ─────────────────────────────────────────────────────────
const ACCEL   = 210;   // px/s²  left / right thrust
const BOOST   = 300;   // px/s²  forward boost (up key)
const BRAKE   = 7.0;   // exponential decay rate (per second) for down key
const MAX_SPD = 500;   // px/s hard cap
const FRIC    = 0.984; // per-frame coefficient (applied at 60 fps equivalent)

// ── engine particles ──────────────────────────────────────────────────────────
const particles = [];
function emitParticles(ex, ey, facingRight, count) {
  const dir = facingRight ? -1 : 1;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: ex + dir * Math.random() * 8,
      y: ey + (Math.random() - 0.5) * 5,
      vx: dir * (1.2 + Math.random() * 2.5),
      vy: (Math.random() - 0.5) * 1.0,
      life: 1.0,
      decay: 0.04 + Math.random() * 0.045,
      r: Math.random() < 0.5 ? 2 : 1,
      col: `hsl(${(Math.random() * 360) | 0},100%,${55 + (Math.random() * 30) | 0}%)`,
    });
  }
  if (particles.length > 100) particles.splice(0, particles.length - 100);
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
let manual      = false;   // true = player is driving
let x           = 0;
let y           = 0;
let vx          = 0;
let facingRight = true;
let wobble      = 0;
let wobbleAmp   = 0;
let wobbleFreq  = 0;
let idleTimer   = null;

// ── keyboard ──────────────────────────────────────────────────────────────────
const CTRL = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const keys = {};

document.addEventListener('keydown', e => {
  if (!CTRL.has(e.code)) return;
  e.preventDefault();
  keys[e.code] = true;

  if (!active) {
    // spawn ship for player on first keypress
    manual      = true;
    facingRight = e.code !== 'ArrowLeft';
    x           = facingRight ? -SW - 10 : window.innerWidth + 10;
    y           = window.innerHeight * 0.42 - SH / 2;
    vx          = facingRight ? 55 : -55;
    wobbleAmp   = 5;
    wobbleFreq  = 1.1;
    wobble      = 0;
    active      = true;
  }
  manual = true;
});

document.addEventListener('keyup', e => {
  if (CTRL.has(e.code)) keys[e.code] = false;
});

// ── auto trigger ──────────────────────────────────────────────────────────────
function trigger() {
  if (active) return;
  manual      = false;
  facingRight = Math.random() < 0.5;
  y           = window.innerHeight * (0.15 + Math.random() * 0.65) - SH / 2;
  wobbleAmp   = 10 + Math.random() * 20;
  wobbleFreq  = 0.8 + Math.random() * 1.4;
  wobble      = 0;
  const speed = 55 + Math.random() * 90;
  x           = facingRight ? -SW - 20 : window.innerWidth + 20;
  vx          = facingRight ? speed : -speed;
  active      = true;
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
    if (manual) {
      // ── player controls ───────────────────────────────────────────────────
      if (keys.ArrowLeft)  { vx -= ACCEL * dt; facingRight = false; }
      if (keys.ArrowRight) { vx += ACCEL * dt; facingRight = true;  }
      if (keys.ArrowUp)    { vx += (facingRight ? 1 : -1) * BOOST * dt; }
      if (keys.ArrowDown)  { vx *= Math.exp(-BRAKE * dt); }

      // friction + speed cap
      vx *= Math.pow(FRIC, dt * 60);
      if (Math.abs(vx) > MAX_SPD) vx = MAX_SPD * Math.sign(vx);

      // wrap x so player can loop around screen
      if (x > window.innerWidth  + SW + 10) x = -SW - 10;
      if (x < -SW - 10)                     x = window.innerWidth + SW + 10;

    } else {
      // ── auto flyby — wrap to opposite side ────────────────────────────────
      if (facingRight && x > window.innerWidth + SW + 20) {
        x = -SW - 20;
        y = window.innerHeight * (0.15 + Math.random() * 0.65) - SH / 2;
        wobbleAmp  = 10 + Math.random() * 20;
        wobbleFreq = 0.8 + Math.random() * 1.4;
        wobble     = 0;
      } else if (!facingRight && x < -SW - 20) {
        x = window.innerWidth + SW + 20;
        y = window.innerHeight * (0.15 + Math.random() * 0.65) - SH / 2;
        wobbleAmp  = 10 + Math.random() * 20;
        wobbleFreq = 0.8 + Math.random() * 1.4;
        wobble     = 0;
      }
    }

    // move
    x      += vx * dt;
    wobble += wobbleFreq * dt;
    const drawY = y + Math.sin(wobble * Math.PI * 2) * wobbleAmp;

    // particles — more when boosting, fewer when braking
    const pCount = keys.ArrowDown ? 2 : keys.ArrowUp ? 14 : 7;
    const ex = facingRight ? x : x + SW;
    emitParticles(ex, drawY + SH * 0.5, facingRight, pCount);

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
  }

  // draw particles (always — trail lingers after ship exits)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx;
    p.y    += p.vy;
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
