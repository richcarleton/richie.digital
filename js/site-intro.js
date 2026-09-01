// ── site-intro.js — front-page cold open ────────────────────────────────────
// Sequence: DOS boot/meltdown (ported from the prfalcon prototype) → the
// wireframe mesh face fades in, grows larger and larger, then dissolves →
// a brief first-person starfield flourish → the catalogue page underneath
// is revealed. Everything here lives inside #intro-overlay so the real page
// (#site-content) can sit fully built but invisible until the reveal.
(function () {
  "use strict";

  const overlay = document.getElementById('intro-overlay');
  const dosScreen = document.getElementById('dos-screen');
  const siteContent = document.getElementById('site-content');
  const starsCanvas = document.getElementById('stars');
  if (!overlay || !dosScreen || !siteContent) return;

  function reveal() {
    overlay.style.transition = 'opacity 0.8s ease';
    overlay.style.opacity = '0';
    siteContent.classList.add('revealed');
    setTimeout(() => { overlay.remove(); }, 850);
  }

  // reduced-motion: skip the whole cinematic, go straight to the page
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.remove();
    siteContent.classList.add('revealed');
    return;
  }

  // ═══ Phase 1 — DOS boot / meltdown (ported from prfalcon.html) ═══════════
  (function dosPhase() {
    let state = "boot"; // boot -> idle -> erroring -> flood -> paused -> flood2 -> dead
    let floodTimer = null;
    let speedTick = 40, linesPerTick = 5;

    function getGreeting() {
      const h = new Date().getHours();
      if (h < 12) return "Good morning.";
      if (h < 18) return "Good afternoon.";
      return "Good evening.";
    }

    function typeText(text) {
      let i = 0;
      const line = document.createElement("span");
      dosScreen.appendChild(line);
      const cursor = document.createElement("span");
      cursor.className = "dos-cursor";
      cursor.innerHTML = "&nbsp;";
      dosScreen.appendChild(cursor);

      const t = setInterval(() => {
        line.textContent += text.charAt(i);
        i++;
        if (i >= text.length) {
          clearInterval(t);
          state = "idle";
        }
      }, 45);
    }

    typeText(
      "Starting MS-DOS...\r\n\r\n" +
      "HIMEM is testing extended memory... done.\r\n\r\n" +
      "C:\\>" + getGreeting() + "\r\n\r\nC:\\>"
    );

    function randomChunk() {
      let s = "";
      const len = 60 + Math.floor(Math.random() * 40);
      for (let i = 0; i < len; i++) s += Math.random() < 0.1 ? " " : Math.floor(Math.random() * 10);
      return s + "\n";
    }

    function trimScreen() {
      const lines = dosScreen.textContent.split("\n");
      if (lines.length > 250) dosScreen.textContent = lines.slice(lines.length - 250).join("\n");
    }

    function floodStep() {
      if (state !== "flood" && state !== "flood2") return;
      let burst = linesPerTick, delay = speedTick;
      const r = Math.random();
      if (r < 0.12) { delay = 180 + Math.random() * 350; burst = linesPerTick * (3 + Math.floor(Math.random() * 4)); }
      else if (r < 0.30) { delay = speedTick * (2 + Math.random() * 2); }

      let buffer = "";
      for (let i = 0; i < burst; i++) buffer += randomChunk();
      dosScreen.textContent += buffer;
      trimScreen();
      floodTimer = setTimeout(floodStep, delay);
    }

    function startFlood() { state = "flood"; floodStep(); }

    function startFlood2() {
      state = "flood2";
      speedTick = 12; linesPerTick = 14;
      floodStep();
      setTimeout(() => {
        if (state !== "flood2") return;
        dosScreen.classList.add("dos-blinking");
        setTimeout(() => {
          state = "dead";
          clearTimeout(floodTimer);
          dosScreen.classList.remove("dos-blinking");
          dosScreen.textContent = "";
          onDosDead();
        }, 2000);
      }, 4000);
    }

    function onInput() {
      if (state === "idle") {
        state = "erroring";
        dosScreen.textContent +=
          "\r\n\r\nGeneral failure reading drive C\r\n" +
          "Abort, Retry, Fail? _\r\n\r\n" +
          "MEMORY ALLOCATION ERROR AT 0x0F2A:00B4\r\n\r\n";
        setTimeout(startFlood, 700);
      } else if (state === "flood") {
        state = "paused";
        clearTimeout(floodTimer);
        setTimeout(startFlood2, 3000);
      }
    }

    window.addEventListener("keydown", onInput);
    window.addEventListener("mousedown", onInput);
    window.addEventListener("touchstart", onInput);

    function onDosDead() {
      window.removeEventListener("keydown", onInput);
      window.removeEventListener("mousedown", onInput);
      window.removeEventListener("touchstart", onInput);
      facePhase();
    }
  })();

  // ═══ Phase 2 — mesh face: fade in, grow bigger and bigger, then fade ═════
  function facePhase() {
    const FACE_RGB = '224,224,224'; // greyscale, matches classic.html
    const canvas = document.createElement('canvas');
    canvas.id = 'intro-face-canvas';
    overlay.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);

    const DEG = Math.PI / 180;
    const T_FADE_IN  = 900;   // ms
    const T_HOLD     = 2400;  // still growing, fully opaque
    const T_FADE_OUT = 1400;  // still growing, fading out
    const T_TOTAL = T_FADE_IN + T_HOLD + T_FADE_OUT;
    const SCALE_START = 0.9, SCALE_END = 3.4;

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
      let d = b - a;
      if (d >  Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    }
    function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2; }

    function finish() {
      window.removeEventListener('resize', resize);
      canvas.remove();
      starPhase();
    }

    Promise.all([
      fetch('mocap/2026-05-11_19-23-11_face_mesh.json').then(r => r.json()),
      fetch('mocap/2026-05-11_19-23-11_f-pose.json').then(r => r.json()),
    ]).then(([mesh, poseData]) => {
      const { pos: rawPos, indices } = mesh.meshGeometry[0];
      const poses = poseData.facePoseList;

      let sx = 0, sy = 0, sz = 0;
      for (const v of rawPos) { sx += v.x; sy += v.y; sz += v.z; }
      const n = rawPos.length;
      const verts = rawPos.map(v => [v.x - sx/n, v.y - sy/n, v.z - sz/n]);

      const seen = new Set(), edges = [];
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i], b = indices[i+1], c = indices[i+2];
        for (const [p, q] of [[a,b],[b,c],[a,c]]) {
          const k = p < q ? p*1000+q : q*1000+p;
          if (!seen.has(k)) { seen.add(k); edges.push([p, q]); }
        }
      }

      let fiFrac = 0, lastTs = null;
      const t0 = performance.now();

      function draw(ts) {
        const elapsed = ts - t0;
        if (elapsed >= T_TOTAL) { finish(); return; }
        requestAnimationFrame(draw);

        if (lastTs === null) lastTs = ts;
        const dt = Math.min(ts - lastTs, 64);
        lastTs = ts;

        fiFrac = (fiFrac + (dt / 33.333) * 0.16) % poses.length;
        const fi0 = Math.floor(fiFrac) % poses.length;
        const fi1 = (fi0 + 1) % poses.length;
        const t = fiFrac - Math.floor(fiFrac);
        const r0 = poses[fi0].rot, r1 = poses[fi1].rot;
        const rx = lerpAngle(r0.x * DEG, r1.x * DEG, t);
        const ry = lerpAngle(r0.y * DEG, r1.y * DEG, t);
        const rz = lerpAngle(r0.z * DEG, r1.z * DEG, t);

        // alpha: fade in, hold, fade out
        let alpha;
        if (elapsed < T_FADE_IN) alpha = easeInOut(elapsed / T_FADE_IN);
        else if (elapsed < T_FADE_IN + T_HOLD) alpha = 1;
        else alpha = 1 - easeInOut((elapsed - T_FADE_IN - T_HOLD) / T_FADE_OUT);

        // scale: grows continuously across the whole sequence
        const growT = easeInOut(Math.min(1, elapsed / T_TOTAL));
        const scaleMul = SCALE_START + (SCALE_END - SCALE_START) * growT;

        const W = canvas.width, H = canvas.height;
        const scale = Math.min(W, H) * 4.0 * scaleMul;
        const ox = W / 2, oy = H / 2;

        ctx.clearRect(0, 0, W, H);

        const proj = verts.map(([x, y, z]) => {
          const [px, py, pz] = rotXYZ(x, y, z, rx, ry, rz);
          return [ox + px * scale, oy - py * scale, pz];
        });

        let minZ = proj[0][2], maxZ = proj[0][2];
        for (const p of proj) { if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2]; }
        const zRange = maxZ - minZ || 1;

        const tiers = [[], [], []];
        for (const [a, b] of edges) {
          const d = ((proj[a][2] + proj[b][2]) * 0.5 - minZ) / zRange;
          tiers[d > 0.66 ? 2 : d > 0.33 ? 1 : 0].push([a, b]);
        }

        const opacities = [0.06, 0.16, 0.32];
        const widths    = [0.5, 0.65, 0.85];

        for (let t2 = 0; t2 < 3; t2++) {
          ctx.strokeStyle = `rgba(${FACE_RGB},${(alpha * opacities[t2]).toFixed(3)})`;
          ctx.lineWidth   = widths[t2];
          ctx.beginPath();
          for (const [a, b] of tiers[t2]) {
            ctx.moveTo(proj[a][0], proj[a][1]);
            ctx.lineTo(proj[b][0], proj[b][1]);
          }
          ctx.stroke();
        }
      }

      requestAnimationFrame(draw);
    }).catch(() => { finish(); }); // mocap failed to load — skip straight to reveal
  }

  // ═══ Phase 3 — brief first-person starfield flourish, then reveal ═══════
  function starPhase() {
    if (!starsCanvas) { reveal(); return; }
    starsCanvas.style.transition = 'opacity 0.5s ease';
    starsCanvas.style.opacity = '1';
    setTimeout(reveal, 900);
    setTimeout(() => { starsCanvas.style.opacity = '0'; }, 1900);
  }

})();
