// @ts-nocheck
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');

let W, H, t = 0;
let speed = 0.12;

const LINE_COUNT = 18;
const STAR_COUNT = 160;

const COLORS = [
  [0, 140, 255],
  [0, 255, 231],
  [0, 75, 210],
  [55, 165, 255],
  [255, 95, 25],
];

let lines = [], stars = [];

// ── Mocap ──────────────────────────────────────────────────────────────────
let mocapFrames    = [];
let mocapStartTime = null;
let mocapYawMid    = 0, mocapYawHalf   = 1;
let mocapPitchMid  = 0, mocapPitchHalf = 1;

function normAngle(a) { return a > 180 ? a - 360 : a; }

fetch('mocap/2026-05-11_19-23-11_f-pose.json')
  .then(r => r.json())
  .then(data => {
    mocapFrames = data.facePoseList;
    const yaws   = mocapFrames.map(f => normAngle(f.rot.y));
    const pitches = mocapFrames.map(f => normAngle(f.rot.x));
    const minY = yaws.reduce((a, b)   => Math.min(a, b),  Infinity);
    const maxY = yaws.reduce((a, b)   => Math.max(a, b), -Infinity);
    const minP = pitches.reduce((a, b) => Math.min(a, b),  Infinity);
    const maxP = pitches.reduce((a, b) => Math.max(a, b), -Infinity);
    mocapYawMid    = (minY + maxY) / 2;
    mocapYawHalf   = Math.max((maxY - minY) / 2, 0.1);
    mocapPitchMid  = (minP + maxP) / 2;
    mocapPitchHalf = Math.max((maxP - minP) / 2, 0.1);
  });

function getMocapOffset() {
  if (!mocapFrames.length) return { dx: 0, dy: 0 };
  const now = performance.now();
  if (mocapStartTime === null) mocapStartTime = now;

  const MOCAP_FPS = 30;
  const frameF = ((now - mocapStartTime) / 1000 * MOCAP_FPS) % mocapFrames.length;
  const idx0   = Math.floor(frameF);
  const frac   = frameF - idx0;
  const idx1   = (idx0 + 1) % mocapFrames.length;

  const f0 = mocapFrames[idx0], f1 = mocapFrames[idx1];
  const yaw   = normAngle(f0.rot.y) + (normAngle(f1.rot.y) - normAngle(f0.rot.y)) * frac;
  const pitch = normAngle(f0.rot.x) + (normAngle(f1.rot.x) - normAngle(f0.rot.x)) * frac;

  return {
    dx: ((yaw   - mocapYawMid)   / mocapYawHalf)   * W * 0.12,
    dy: ((pitch - mocapPitchMid) / mocapPitchHalf) * H * 0.08,
  };
}

// ── Scene ──────────────────────────────────────────────────────────────────
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  buildLines();
  buildStars();
}

function buildLines() {
  lines = [];
  const vpx = W / 2, vpy = H / 2;
  const reach = Math.hypot(W, H) * 0.62;

  for (let i = 0; i < LINE_COUNT; i++) {
    const angle = (i / LINE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
    const bx = vpx + Math.cos(angle) * reach;
    const by = vpy + Math.sin(angle) * reach;

    const cIdx = Math.random() < 0.07 ? 4 : Math.floor(Math.random() * 4);
    const [r, g, b] = COLORS[cIdx];
    const thick = 0.4 + Math.random() * 1.0;

    const pulseCount = Math.random() < 0.38 ? 2 : 1;
    const pulses = Array.from({ length: pulseCount }, () => ({
      p:      Math.random(),
      spd:    0.0015 + Math.random() * 0.003,
      tail:   0.10 + Math.random() * 0.20,
      bright: 0.30 + Math.random() * 0.38,
    }));

    lines.push({ vpx, vpy, bx, by, r, g, b, thick, pulses });
  }
}

function buildStars() {
  stars = Array.from({ length: STAR_COUNT }, () => ({
    x:     Math.random() * W,
    y:     Math.random() * H,
    r:     Math.random() * 1.2 + 0.2,
    a:     Math.random() * 0.45 + 0.10,
    phase: Math.random() * Math.PI * 2,
    rate:  0.2 + Math.random() * 0.5,
  }));
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ── Draw ───────────────────────────────────────────────────────────────────
function draw() {
  t += 0.008;

  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,    '#020812');
  bg.addColorStop(0.36, '#03091c');
  bg.addColorStop(1,    '#040c1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';

  // star dots — fixed in space, unaffected by head movement
  for (const s of stars) {
    const a = s.a * (0.55 + 0.45 * Math.sin(t * s.rate + s.phase));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(170,205,255,${a})`;
    ctx.fill();
  }

  // mocap-driven offset: glow + trails shift with recorded head rotation
  const { dx, dy } = getMocapOffset();
  ctx.save();
  ctx.translate(dx, dy);

  // center glow
  const vpx = W / 2, vpy = H / 2;
  const hgr = ctx.createRadialGradient(vpx, vpy, 0, vpx, vpy, Math.min(W, H) * 0.55);
  hgr.addColorStop(0,   'rgba(0,100,230,0.07)');
  hgr.addColorStop(0.5, 'rgba(0,50,160,0.03)');
  hgr.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = hgr;
  ctx.fillRect(-dx, -dy, W, H);   // fill full canvas despite translation

  // light trails
  const SEGS = 14;
  for (const ln of lines) {
    for (const pulse of ln.pulses) {
      pulse.p += pulse.spd * (speed / 0.6);
      if (pulse.p > 1.1) pulse.p = -0.04;

      for (let s = 0; s < SEGS; s++) {
        const p1 = pulse.p - pulse.tail * (s / SEGS);
        const p0 = pulse.p - pulse.tail * ((s + 1) / SEGS);
        if (p1 <= 0 || p0 < 0) continue;

        const x0 = lerp(ln.vpx, ln.bx, p0), y0 = lerp(ln.vpy, ln.by, p0);
        const x1 = lerp(ln.vpx, ln.bx, p1), y1 = lerp(ln.vpy, ln.by, p1);

        const tailFade = 1 - s / SEGS;
        const depth    = Math.pow(Math.max(0, p1), 0.55);
        const alpha    = tailFade * depth * pulse.bright;
        const w        = lerp(0.2, ln.thick * 2.8, Math.max(0, p1));

        ctx.lineWidth   = w * 7;
        ctx.strokeStyle = `rgba(${ln.r},${ln.g},${ln.b},${alpha * 0.09})`;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

        ctx.lineWidth   = Math.max(0.4, w * 0.65);
        ctx.strokeStyle = `rgba(${ln.r},${ln.g},${ln.b},${alpha * 1.0})`;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }

      if (pulse.p > 0.01 && pulse.p < 1.02) {
        const hx = lerp(ln.vpx, ln.bx, pulse.p);
        const hy = lerp(ln.vpy, ln.by, pulse.p);
        const dr = lerp(1, ln.thick * 6.5, Math.min(1, pulse.p)) * pulse.bright;
        const rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, dr * 6);
        rg.addColorStop(0, `rgba(${ln.r},${ln.g},${ln.b},${0.75 * pulse.bright})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(hx, hy, dr * 5, 0, Math.PI * 2);
        ctx.fillStyle = rg;
        ctx.fill();
      }
    }
  }

  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
window.setWarpSpeed   = v  => { speed = v; };
window.resetWarpSpeed = () => { speed = 0.12; };

resize();
draw();
