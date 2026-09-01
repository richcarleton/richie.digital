const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');

let W, H, t = 0;
let speed = 0.35;

// stars are simulated in 3D: x,y in [-1,1] (direction off dead-center),
// z = distance from the viewer (large = far away, shrinking = approaching).
// each frame z decreases by `speed`; once it passes the viewer it's
// respawned far away on a fresh random heading — classic cockpit warp.
const STAR_COUNT = 700;
const Z_FAR = 24;
const Z_NEAR = 0.06;
const FOCAL = 1.4;

let stars = [];

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function spawnStar(s) {
  // uniform-ish disc so stars don't clump near the vanishing point
  const ang = Math.random() * Math.PI * 2;
  const rad = Math.sqrt(Math.random());
  s.x = Math.cos(ang) * rad;
  s.y = Math.sin(ang) * rad;
  s.z = Z_FAR * (0.6 + Math.random() * 0.4);
  s.pz = s.z; // previous z, for the motion-streak
  s.warm = Math.random() < 0.12; // faint warm outliers among the white field
}

function buildStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = {};
    spawnStar(s);
    s.z = Z_NEAR + Math.random() * (Z_FAR - Z_NEAR); // scatter depth on first build
    s.pz = s.z;
    stars.push(s);
  }
}

function project(x, y, z) {
  const scale = FOCAL / z;
  return [W / 2 + x * scale * (W * 0.5), H / 2 + y * scale * (H * 0.5), scale];
}

function draw() {
  t += 0.016;

  // background: near-black with a faint depth gradient, no color cast
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  bg.addColorStop(0, '#0a0a0d');
  bg.addColorStop(1, '#020203');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';

  const dz = speed * 0.24;

  for (const s of stars) {
    s.pz = s.z;
    s.z -= dz;
    if (s.z <= Z_NEAR) spawnStar(s);

    const [x0, y0, sc0] = project(s.x, s.y, s.pz);
    const [x1, y1, sc1] = project(s.x, s.y, s.z);

    // offscreen (well past the frame edge) — skip, will respawn soon anyway
    if (x1 < -200 || x1 > W + 200 || y1 < -200 || y1 > H + 200) continue;

    const depth = Math.min(1, Math.max(0, 1 - s.z / Z_FAR)); // 0 far, 1 near
    const brightness = 0.15 + depth * 0.85;
    const r = 0.4 + sc1 * 1.1;

    const [cr, cg, cb] = s.warm ? [255, 214, 170] : [230, 236, 245];

    // motion streak — length grows with speed, so faster warp = longer trails
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(brightness * Math.min(1, speed * 1.3)).toFixed(3)})`;
    ctx.lineWidth = r;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // the star itself — a bright point at the leading edge
    ctx.beginPath();
    ctx.arc(x1, y1, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${brightness.toFixed(3)})`;
    ctx.fill();
  }

  // subtle vignette to sell the cockpit-window framing
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
window.setWarpSpeed   = v => { speed = v; };
window.resetWarpSpeed = () => { speed = 0.35; };

// one-shot temporary flash (kept for any future trigger that wants a blip
// rather than the permanent reveal below)
let _starsHideTimer = null;
window.showStars = () => {
  canvas.style.opacity = '1';
  clearTimeout(_starsHideTimer);
  _starsHideTimer = setTimeout(() => { canvas.style.opacity = '0'; }, 2000);
};

// permanent reveal — called once the intro (mesh face + logo) has settled,
// bringing up the first-person starfield as the site's resting background
window.revealStars = () => {
  clearTimeout(_starsHideTimer);
  canvas.style.transition = 'opacity 1.6s ease';
  canvas.style.opacity = '1';
};

resize();
buildStars();
draw();
