// ── catfloat.js — small cat face drifts through space ────────────────────────
// Canvas 2D rendered cat face; floats, wobbles, blinks, breathes.

(function () {

const SIZE = 88;   // CSS px (canvas logical size)
const DPR  = Math.min(window.devicePixelRatio || 1, 2);

const canvas = document.createElement('canvas');
canvas.width  = SIZE * DPR;
canvas.height = SIZE * DPR;
canvas.style.cssText = [
  'position:fixed',
  'top:0', 'left:0',
  'pointer-events:auto',
  'z-index:2',
  'cursor:pointer',
  'will-change:transform',
  `width:${SIZE}px`,
  `height:${SIZE}px`,
  'filter:drop-shadow(0 0 7px rgba(220,160,10,0.55)) drop-shadow(0 0 18px rgba(80,120,255,0.25))',
].join(';');

canvas.addEventListener('click', () => {
  if (typeof window.playCatSound === 'function') window.playCatSound();
  // little startle — briefly boost drift speed
  vx = (Math.abs(vx) + 60) * Math.sign(vx || 1) * (Math.random() < 0.5 ? 1 : -1);
  vy = (Math.random() - 0.5) * 80;
});
document.body.appendChild(canvas);

const ctx = canvas.getContext('2d');
ctx.scale(DPR, DPR);

// ── rounded rect (polyfill-safe) ─────────────────────────────────────────────
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// ── draw cat ──────────────────────────────────────────────────────────────────
function drawCat(blinking, breathe) {
  ctx.clearRect(0, 0, SIZE, SIZE);

  const cx = SIZE * 0.50;
  const cy = SIZE * 0.58;        // lower so ears fit above
  const r  = SIZE * 0.35 * breathe;  // breathe scales radius slightly

  // ── ears (behind head) ───────────────────────────────────────────────────
  ctx.fillStyle = '#7a7d90';
  ctx.beginPath();
  ctx.moveTo(cx - r*0.72, cy - r*0.72);
  ctx.lineTo(cx - r*0.20, cy - r*1.48);
  ctx.lineTo(cx + r*0.06, cy - r*0.80);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - r*0.06, cy - r*0.80);
  ctx.lineTo(cx + r*0.20, cy - r*1.48);
  ctx.lineTo(cx + r*0.72, cy - r*0.72);
  ctx.closePath();
  ctx.fill();

  // inner ear pink
  ctx.fillStyle = '#bb6272';
  ctx.beginPath();
  ctx.moveTo(cx - r*0.60, cy - r*0.76);
  ctx.lineTo(cx - r*0.20, cy - r*1.22);
  ctx.lineTo(cx + r*0.02, cy - r*0.84);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - r*0.02, cy - r*0.84);
  ctx.lineTo(cx + r*0.20, cy - r*1.22);
  ctx.lineTo(cx + r*0.60, cy - r*0.76);
  ctx.closePath();
  ctx.fill();

  // ── head ─────────────────────────────────────────────────────────────────
  const headGrad = ctx.createRadialGradient(
    cx - r*0.25, cy - r*0.28, r*0.08,
    cx,          cy,          r
  );
  headGrad.addColorStop(0,   '#cdd0dc');
  headGrad.addColorStop(0.6, '#8e91a4');
  headGrad.addColorStop(1,   '#44475a');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // ── eyes ─────────────────────────────────────────────────────────────────
  const eyeW = r * 0.30;
  const eyeH = blinking ? r * 0.06 : r * 0.56;
  const eyeLx = cx - r * 0.34;
  const eyeRx = cx + r * 0.34;
  const eyeY  = cy - r * 0.04;
  const eyeRad = eyeW * 0.30;

  if (!blinking) {
    // gold iris — gradient per eye
    const mkEyeGrad = (ex) => {
      const g = ctx.createRadialGradient(ex - eyeW*0.18, eyeY - eyeH*0.24, eyeW*0.04, ex, eyeY, eyeH*0.60);
      g.addColorStop(0,   '#ffe040');
      g.addColorStop(0.5, '#e09800');
      g.addColorStop(1,   '#8a5600');
      return g;
    };
    ctx.fillStyle = mkEyeGrad(eyeLx);
    rrect(eyeLx - eyeW/2, eyeY - eyeH/2, eyeW, eyeH, eyeRad);
    ctx.fill();

    ctx.fillStyle = mkEyeGrad(eyeRx);
    rrect(eyeRx - eyeW/2, eyeY - eyeH/2, eyeW, eyeH, eyeRad);
    ctx.fill();

    // pupils (dark vertical slit)
    const pupW = eyeW * 0.20;
    ctx.fillStyle = '#07050d';
    rrect(eyeLx - pupW/2, eyeY - eyeH/2, pupW, eyeH, pupW*0.4);
    ctx.fill();
    rrect(eyeRx - pupW/2, eyeY - eyeH/2, pupW, eyeH, pupW*0.4);
    ctx.fill();

    // specular dot
    ctx.fillStyle = 'rgba(255,248,190,0.70)';
    ctx.beginPath();
    ctx.ellipse(eyeLx - eyeW*0.16, eyeY - eyeH*0.28, eyeW*0.10, eyeH*0.12, -0.35, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(eyeRx - eyeW*0.16, eyeY - eyeH*0.28, eyeW*0.10, eyeH*0.12, -0.35, 0, Math.PI*2);
    ctx.fill();

  } else {
    // blink — just a thin dark arc
    ctx.strokeStyle = '#333546';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(eyeLx, eyeY, eyeW*0.42, Math.PI*0.1, Math.PI*0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeRx, eyeY, eyeW*0.42, Math.PI*0.1, Math.PI*0.9);
    ctx.stroke();
  }

  // ── rim light (subtle blue edge) ─────────────────────────────────────────
  const rimGrad = ctx.createRadialGradient(cx, cy, r*0.78, cx, cy, r);
  rimGrad.addColorStop(0,   'rgba(80,110,220,0)');
  rimGrad.addColorStop(1,   'rgba(80,120,255,0.28)');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── motion state ──────────────────────────────────────────────────────────────
let px = window.innerWidth  * (0.08 + Math.random() * 0.18);
let py = window.innerHeight * (0.10 + Math.random() * 0.25);
let vx = (14 + Math.random() * 16) * (Math.random() < 0.5 ? 1 : -1);
let vy = (10 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1);

// independent wobble oscillators
let wbX = Math.random() * Math.PI * 2;
let wbY = Math.random() * Math.PI * 2;
const WFX = 0.38 + Math.random() * 0.18;   // wobble frequency X
const WFY = 0.29 + Math.random() * 0.14;   // wobble frequency Y
const WAX = 18, WAY = 13;                  // wobble amplitude px

// breathing
let breathPhase = Math.random() * Math.PI * 2;
const BREATH_FREQ = 0.28;

// blink
let blinkCountdown = 2.5 + Math.random() * 5.0;
let blinking = false;
let blinkT   = 0;
const BLINK_DUR = 0.14;

let lastTs = null;

function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) * 0.001, 0.05);
  lastTs = ts;

  // drift
  wbX += WFX * dt;
  wbY += WFY * dt;
  px += (vx + Math.sin(wbX) * WAX) * dt;
  py += (vy + Math.cos(wbY) * WAY) * dt;

  // soft bounce at screen edges (with a margin so cat stays fully visible)
  const mx = SIZE * 0.5, my = SIZE * 0.8;
  if (px < -mx)                       { px = -mx;                        vx =  Math.abs(vx); }
  if (px > window.innerWidth  - mx)   { px = window.innerWidth  - mx;    vx = -Math.abs(vx); }
  if (py < -my)                       { py = -my;                        vy =  Math.abs(vy); }
  if (py > window.innerHeight - my/2) { py = window.innerHeight - my/2;  vy = -Math.abs(vy); }

  // breathe: 1.0 ± 0.04
  breathPhase += BREATH_FREQ * dt;
  const breathe = 1.0 + Math.sin(breathPhase) * 0.04;

  // blink
  blinkCountdown -= dt;
  if (blinkCountdown <= 0 && !blinking) {
    blinking = true;
    blinkT   = 0;
    blinkCountdown = 3.0 + Math.random() * 6.0;
  }
  if (blinking) {
    blinkT += dt;
    if (blinkT >= BLINK_DUR) blinking = false;
  }

  drawCat(blinking, breathe);

  // position: canvas top-left sits at (px, py) offset from screen origin
  canvas.style.transform = `translate(${(px - SIZE*0.5).toFixed(1)}px,${(py - SIZE*0.58).toFixed(1)}px)`;

  requestAnimationFrame(tick);
}

drawCat(false, 1.0);
requestAnimationFrame(tick);

window.triggerCatFloat = () => {
  vx = (20 + Math.random() * 20) * Math.sign(vx || 1);
  vy = (15 + Math.random() * 15) * Math.sign(vy || 1);
};

})();
