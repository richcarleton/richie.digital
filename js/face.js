// ── face.js — mocap wireframe face, interpolated + ghost trails ───────────────
(function () {

const canvas = document.createElement('canvas');
canvas.id = 'face-canvas';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

const DEG = Math.PI / 180;

// ── global speed knob (devpanel or console: window.FACE_SPEED = 0.1..3.0) ──
window.FACE_SPEED = window.FACE_SPEED || 1.0;

// ── trail persistence: 0=no trail, 1=freeze. sweet spot ~0.04–0.12 ──────────
window.FACE_TRAIL = window.FACE_TRAIL !== undefined ? window.FACE_TRAIL : 0.06;

function rotXYZ(x, y, z, rx, ry, rz) {
  const cxr = Math.cos(rx), sxr = Math.sin(rx);
  const cyr = Math.cos(ry), syr = Math.sin(ry);
  const czr = Math.cos(rz), szr = Math.sin(rz);
  let ty = y*cxr - z*sxr, tz = y*sxr + z*cxr; y = ty; z = tz;
  let tx = x*cyr + z*syr; tz = -x*syr + z*cyr; x = tx; z = tz;
  tx = x*czr - y*szr; ty = x*szr + y*czr;
  return [tx, ty, z];
}

function lerpAngle(a, b, t) {
  // shortest-path lerp through the rotation values
  let d = b - a;
  if (d >  Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

Promise.all([
  fetch('mocap/2026-05-11_19-23-11_face_mesh.json').then(r => r.json()),
  fetch('mocap/2026-05-11_19-23-11_f-pose.json').then(r => r.json()),
]).then(([mesh, poseData]) => {
  const { pos: rawPos, indices } = mesh.meshGeometry[0];
  const poses = poseData.facePoseList;

  // center on centroid
  let sx = 0, sy = 0, sz = 0;
  for (const v of rawPos) { sx += v.x; sy += v.y; sz += v.z; }
  const n = rawPos.length;
  const verts = rawPos.map(v => [v.x - sx/n, v.y - sy/n, v.z - sz/n]);

  // deduplicate edges
  const seen = new Set(), edges = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i+1], c = indices[i+2];
    for (const [p, q] of [[a,b],[b,c],[a,c]]) {
      const k = p < q ? p*1000+q : q*1000+p;
      if (!seen.has(k)) { seen.add(k); edges.push([p, q]); }
    }
  }

  // ── fractional frame position for smooth interpolation ──────────────────
  let fiFrac = 0;        // 0.0 → poses.length, fractional
  let lastTs  = null;

  // ── scanline shimmer state ───────────────────────────────────────────────
  let scanY = 0;

  const t0 = performance.now();

  function draw(ts) {
    requestAnimationFrame(draw);

    if (lastTs === null) lastTs = ts;
    const dt = Math.min(ts - lastTs, 64); // cap at 64ms so tab-blur doesn't warp
    lastTs = ts;

    // advance fractional frame at speed-scaled rate (30fps baseline)
    fiFrac = (fiFrac + (dt / 33.333) * window.FACE_SPEED) % poses.length;

    const fi0 = Math.floor(fiFrac) % poses.length;
    const fi1 = (fi0 + 1) % poses.length;
    const t   = fiFrac - Math.floor(fiFrac);

    const r0 = poses[fi0].rot, r1 = poses[fi1].rot;
    const rx = lerpAngle(r0.x * DEG, r1.x * DEG, t);
    const ry = lerpAngle(r0.y * DEG, r1.y * DEG, t);
    const rz = lerpAngle(r0.z * DEG, r1.z * DEG, t);

    const alpha = Math.min(1, (ts - t0) * 0.00125); // ~0.8s fade-in

    const W = canvas.width, H = canvas.height;
    const scale = Math.min(W, H) * 4.0;
    const ox = W / 2, oy = H / 2;

    // ── ghost trail: paint semi-transparent black over previous frame ────
    const trail = Math.max(0, Math.min(0.35, window.FACE_TRAIL));
    if (trail > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${trail})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    const proj = verts.map(([x, y, z]) => {
      const [px, py, pz] = rotXYZ(x, y, z, rx, ry, rz);
      return [ox + px * scale, oy - py * scale, pz];
    });

    // depth-sort into 3 tiers
    let minZ = proj[0][2], maxZ = proj[0][2];
    for (const p of proj) { if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2]; }
    const zRange = maxZ - minZ || 1;

    const tiers = [[], [], []];
    for (const [a, b] of edges) {
      const d = ((proj[a][2] + proj[b][2]) * 0.5 - minZ) / zRange;
      tiers[d > 0.66 ? 2 : d > 0.33 ? 1 : 0].push([a, b]);
    }

    // ── subtle depth-pulse on front tier ────────────────────────────────
    const pulse = 0.85 + 0.15 * Math.sin(ts * 0.0008);

    const opacities = [0.05, 0.13, 0.28 * pulse];
    const widths    = [0.45, 0.55, 0.7];
    for (let t2 = 0; t2 < 3; t2++) {
      ctx.strokeStyle = `rgba(0,255,231,${(alpha * opacities[t2]).toFixed(3)})`;
      ctx.lineWidth   = widths[t2];
      ctx.beginPath();
      for (const [a, b] of tiers[t2]) {
        ctx.moveTo(proj[a][0], proj[a][1]);
        ctx.lineTo(proj[b][0], proj[b][1]);
      }
      ctx.stroke();
    }

    // ── scanline shimmer (CRT horizontal band) ───────────────────────────
    const scanSpeed = 0.04 * (window.FACE_SPEED > 0 ? 1 : 0);
    scanY = (scanY + scanSpeed) % 1.0;
    const sy2 = scanY * H;
    const grad = ctx.createLinearGradient(0, sy2 - 40, 0, sy2 + 40);
    grad.addColorStop(0,   'rgba(0,255,231,0)');
    grad.addColorStop(0.5, `rgba(0,255,231,${(alpha * 0.04).toFixed(3)})`);
    grad.addColorStop(1,   'rgba(0,255,231,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, sy2 - 40, W, 80);
  }

  requestAnimationFrame(draw);
});

})();
