const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');

let W, H, t = 0;
let speed = 0.35;

const LINE_COUNT = 28;
const STAR_COUNT = 160;

// deep blue, site cyan, electric blue, mid blue, warm accent (rare)
const COLORS = [
  [0, 140, 255],
  [0, 255, 231],
  [0, 75, 210],
  [55, 165, 255],
  [255, 95, 25],
];

let lines = [], stars = [];

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  buildLines();
  buildStars();
}

function buildLines() {
  lines = [];
  const vpx = W / 2;
  const vpy = H / 2;
  const reach = Math.hypot(W, H) * 0.62;

  for (let i = 0; i < LINE_COUNT; i++) {
    // evenly spaced angles around 360°, small per-line jitter
    const angle = (i / LINE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
    const bx = vpx + Math.cos(angle) * reach;
    const by = vpy + Math.sin(angle) * reach;

    const cIdx = Math.random() < 0.07 ? 4 : Math.floor(Math.random() * 4);
    const [r, g, b] = COLORS[cIdx];
    const thick = 0.5 + Math.random() * 1.3;

    const pulseCount = Math.random() < 0.38 ? 2 : 1;
    const pulses = Array.from({ length: pulseCount }, () => ({
      p: Math.random(),
      spd: 0.004 + Math.random() * 0.007,
      tail: 0.10 + Math.random() * 0.20,
      bright: 0.45 + Math.random() * 0.55,
    }));

    lines.push({ vpx, vpy, bx, by, r, g, b, thick, pulses });
  }
}

function buildStars() {
  stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.2 + 0.2,
    a: Math.random() * 0.55 + 0.12,
    phase: Math.random() * Math.PI * 2,
    rate: 0.4 + Math.random() * 0.8,
  }));
}

function lerp(a, b, t) { return a + (b - a) * t; }

function draw() {
  t += 0.016;

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

  // center glow
  const vpx = W / 2, vpy = H / 2;
  const hgr = ctx.createRadialGradient(vpx, vpy, 0, vpx, vpy, Math.min(W, H) * 0.55);
  hgr.addColorStop(0,   'rgba(0,100,230,0.09)');
  hgr.addColorStop(0.5, 'rgba(0,50,160,0.04)');
  hgr.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = hgr;
  ctx.fillRect(0, 0, W, H);

  // stars
  for (const s of stars) {
    const a = s.a * (0.55 + 0.45 * Math.sin(t * s.rate + s.phase));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(170,205,255,${a})`;
    ctx.fill();
  }

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

        const x0 = lerp(ln.vpx, ln.bx, p0);
        const y0 = lerp(ln.vpy, ln.by, p0);
        const x1 = lerp(ln.vpx, ln.bx, p1);
        const y1 = lerp(ln.vpy, ln.by, p1);

        const tailFade = 1 - s / SEGS;
        const depth    = Math.pow(Math.max(0, p1), 0.55);
        const alpha    = tailFade * depth * pulse.bright;
        const w        = lerp(0.2, ln.thick * 2.8, Math.max(0, p1));

        // outer haze
        ctx.lineWidth   = w * 7;
        ctx.strokeStyle = `rgba(${ln.r},${ln.g},${ln.b},${alpha * 0.09})`;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

        // bright core
        ctx.lineWidth   = Math.max(0.4, w * 0.65);
        ctx.strokeStyle = `rgba(${ln.r},${ln.g},${ln.b},${alpha * 1.0})`;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }

      // head dot
      if (pulse.p > 0.01 && pulse.p < 1.02) {
        const hx = lerp(ln.vpx, ln.bx, pulse.p);
        const hy = lerp(ln.vpy, ln.by, pulse.p);
        const dr = lerp(1, ln.thick * 6.5, Math.min(1, pulse.p)) * pulse.bright;
        const rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, dr * 6);
        rg.addColorStop(0, `rgba(${ln.r},${ln.g},${ln.b},${0.85 * pulse.bright})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(hx, hy, dr * 5, 0, Math.PI * 2);
        ctx.fillStyle = rg;
        ctx.fill();
      }
    }
  }

  ctx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(draw);
}

let _starsHideTimer = null;

window.addEventListener('resize', resize);
window.setWarpSpeed   = v => { speed = v; };
window.resetWarpSpeed = () => { speed = 0.35; };
window.showStars      = () => {
  canvas.style.opacity = '1';
  clearTimeout(_starsHideTimer);
  _starsHideTimer = setTimeout(() => { canvas.style.opacity = '0'; }, 2000);
};

resize();
draw();
