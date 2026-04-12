const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');

let W, H, stars = [];
let speed = 0.6;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  initStars();
}

function initStars() {
  stars = Array.from({ length: 280 }, () => ({
    x: Math.random() * W - W / 2,
    y: Math.random() * H - H / 2,
    z: Math.random() * W,
    pz: Math.random() * W
  }));
}

function draw() {
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;

  for (const s of stars) {
    s.pz = s.z;
    s.z -= speed;

    if (s.z <= 0) {
      s.x = Math.random() * W - W / 2;
      s.y = Math.random() * H - H / 2;
      s.z = W;
      s.pz = W;
    }

    const sx = (s.x / s.z) * W + cx;
    const sy = (s.y / s.z) * H + cy;
    const px = (s.x / s.pz) * W + cx;
    const py = (s.y / s.pz) * H + cy;
    const size = Math.max(0.3, (1 - s.z / W) * 2.2);
    const alpha = Math.min(1, (1 - s.z / W) * 1.4);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(200, 215, 255, ${alpha * 0.85})`;
    ctx.lineWidth = size;
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);

// expose speed setter for nav.js to hook into
window.setWarpSpeed = val => { speed = val; };
window.resetWarpSpeed = () => { speed = 0.6; };

resize();
draw();
