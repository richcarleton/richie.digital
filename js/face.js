// ── face.js — mocap wireframe face, visible on page load ─────────────────────
(function () {

const canvas = document.createElement('canvas');
canvas.id = 'face-canvas';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

const DEG = Math.PI / 180;

function rotXYZ(x, y, z, rx, ry, rz) {
  const cxr = Math.cos(rx), sxr = Math.sin(rx);
  const cyr = Math.cos(ry), syr = Math.sin(ry);
  const czr = Math.cos(rz), szr = Math.sin(rz);
  let ty = y*cxr - z*sxr, tz = y*sxr + z*cxr; y = ty; z = tz;
  let tx = x*cyr + z*syr; tz = -x*syr + z*cyr; x = tx; z = tz;
  tx = x*czr - y*szr; ty = x*szr + y*czr;
  return [tx, ty, z];
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

  // deduplicate edges from triangle index list (max index 467, so a*1000+b is unambiguous)
  const seen = new Set(), edges = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i+1], c = indices[i+2];
    for (const [p, q] of [[a,b],[b,c],[a,c]]) {
      const k = p < q ? p*1000+q : q*1000+p;
      if (!seen.has(k)) { seen.add(k); edges.push([p, q]); }
    }
  }

  let fi = 0, lastAdv = 0;
  const t0 = performance.now();

  function draw(ts) {
    requestAnimationFrame(draw);

    if (ts - lastAdv > 33) { fi = (fi + 1) % poses.length; lastAdv = ts; }

    const { rot } = poses[fi];
    const rx = rot.x * DEG, ry = rot.y * DEG, rz = rot.z * DEG;
    const alpha = Math.min(1, (ts - t0) * 0.00125);  // ~0.8s fade-in

    const W = canvas.width, H = canvas.height;
    const scale = Math.min(W, H) * 4.0;
    const ox = W / 2, oy = H / 2;

    ctx.clearRect(0, 0, W, H);

    const proj = verts.map(([x, y, z]) => {
      const [px, py, pz] = rotXYZ(x, y, z, rx, ry, rz);
      return [ox + px * scale, oy - py * scale, pz];
    });

    // depth-sort edges into 3 tiers (higher projected z = closer to viewer = more opaque)
    let minZ = proj[0][2], maxZ = proj[0][2];
    for (const p of proj) { if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2]; }
    const zRange = maxZ - minZ || 1;

    const tiers = [[], [], []];
    for (const [a, b] of edges) {
      const d = ((proj[a][2] + proj[b][2]) * 0.5 - minZ) / zRange;
      tiers[d > 0.66 ? 2 : d > 0.33 ? 1 : 0].push([a, b]);
    }

    const opacities = [0.05, 0.13, 0.28];
    const widths    = [0.45, 0.55, 0.7];
    for (let t = 0; t < 3; t++) {
      ctx.strokeStyle = `rgba(0,255,231,${(alpha * opacities[t]).toFixed(3)})`;
      ctx.lineWidth   = widths[t];
      ctx.beginPath();
      for (const [a, b] of tiers[t]) {
        ctx.moveTo(proj[a][0], proj[a][1]);
        ctx.lineTo(proj[b][0], proj[b][1]);
      }
      ctx.stroke();
    }
  }

  requestAnimationFrame(draw);
});

})();
