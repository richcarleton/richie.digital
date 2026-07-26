// ── devpanel.js — CRT amber phosphor dev panel ───────────────────────────────
// Trigger: tap bottom-right corner (80×80 px) 4× within 2 s

(function () {

  // ── palette swatches ────────────────────────────────────────────────────────
  const SWATCHES = [
    { color: '#e8900a', label: 'amber'  },
    { color: '#0ae87a', label: 'green'  },
    { color: '#0ac8e8', label: 'cyan'   },
    { color: '#e80a78', label: 'pink'   },
    { color: '#8a0ae8', label: 'purple' },
  ];
  let activeColor = 0;

  // ── build DOM ───────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'dev-overlay';

  overlay.innerHTML = `
    <div id="dev-panel">
      <div class="dp-scanline"></div>

      <div class="dp-header">
        <div class="dp-title">RICHIE.DIGITAL <span class="dp-blink">_</span></div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="dp-subtitle">DEV MODE V2.4.1</div>
          <button class="dp-close" id="dp-close">✕</button>
        </div>
      </div>

      <div class="dp-section-label">// Environment</div>
      <div class="dp-row"><span class="dp-key">NODE_ENV</span>      <span class="dp-val" id="dp-env">"development"</span></div>
      <div class="dp-row"><span class="dp-key">BUILD_ID</span>      <span class="dp-val dp-dim">"r2.4.1-alpha"</span></div>
      <div class="dp-row"><span class="dp-key">DEBUG</span>         <span class="dp-val">TRUE</span></div>
      <div class="dp-row"><span class="dp-key">BETA_FEATURES</span> <span class="dp-val dp-dim">FALSE</span></div>

      <div class="dp-section-label">// Viewport</div>
      <div class="dp-row"><span class="dp-key">WINDOW.VW</span>  <span class="dp-val" id="dp-vw">—</span></div>
      <div class="dp-row"><span class="dp-key">WINDOW.VH</span>  <span class="dp-val" id="dp-vh">—</span></div>
      <div class="dp-row"><span class="dp-key">DEVICE.DPR</span> <span class="dp-val" id="dp-dpr">—</span></div>

      <div class="dp-section-label">// Performance</div>
      <div class="dp-row"><span class="dp-key">FPS</span>       <span class="dp-val dp-live" id="dp-fps">—</span></div>
      <div class="dp-row"><span class="dp-key">MEM_HEAP</span>  <span class="dp-val dp-live" id="dp-mem">—</span></div>
      <div class="dp-row"><span class="dp-key">LOAD_TIME</span> <span class="dp-val" id="dp-load">—</span></div>

      <div class="dp-section-label">// Controls</div>

      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">COLOUR</span>
        <div class="dp-swatches" id="dp-swatches"></div>
      </div>

      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SLIDE</span>
        <input type="range" id="dp-slide" min="0.1" max="2"   step="0.05" value="0.45" />
        <span class="dp-ctrl-val" id="dp-slide-val">0.45s</span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SCAN</span>
        <input type="range" id="dp-scan"  min="1"   max="12"  step="0.5"  value="4"    />
        <span class="dp-ctrl-val" id="dp-scan-val">4.0s</span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">PULSE</span>
        <input type="range" id="dp-pulse" min="0.5" max="6"   step="0.25" value="2"    />
        <span class="dp-ctrl-val" id="dp-pulse-val">2.0s</span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">FLICKER</span>
        <input type="range" id="dp-flicker" min="2" max="12"  step="0.5"  value="5"    />
        <span class="dp-ctrl-val" id="dp-flicker-val">5.0s</span>
      </div>

      <div class="dp-section-label">// Face Mesh</div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">ENABLED</span>
        <label class="dp-toggle"><input type="checkbox" id="dp-face-on" checked /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SPEED</span>
        <input type="range" id="dp-face-speed" min="0.02" max="2.0" step="0.02" value="0.18" />
        <span class="dp-ctrl-val" id="dp-face-speed-val">0.18×</span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">TRAIL</span>
        <input type="range" id="dp-face-trail" min="0" max="0.30" step="0.01" value="0.04" />
        <span class="dp-ctrl-val" id="dp-face-trail-val">0.04</span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">WOBBLE</span>
        <input type="range" id="dp-face-wobble" min="0" max="0.50" step="0.01" value="0.15" />
        <span class="dp-ctrl-val" id="dp-face-wobble-val">0.15</span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SPD VAR</span>
        <input type="range" id="dp-face-spdvar" min="0" max="1.0" step="0.05" value="0.35" />
        <span class="dp-ctrl-val" id="dp-face-spdvar-val">0.35</span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">PULSE</span>
        <label class="dp-toggle"><input type="checkbox" id="dp-face-pulse" checked /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SCANLINE</span>
        <label class="dp-toggle"><input type="checkbox" id="dp-face-scan" /><span></span></label>
      </div>

      <div class="dp-section-label">// Wheel Badge</div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">ENABLED</span>
        <label class="dp-toggle"><input type="checkbox" id="dp-wheel-on" checked /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SPIN</span>
        <input type="range" id="dp-wheel-spin" min="0" max="180" step="2" value="24" />
        <span class="dp-ctrl-val" id="dp-wheel-spin-val">24&deg;/s</span>
      </div>

      <div class="dp-section-label">// Starfield</div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">VISIBLE</span>
        <label class="dp-toggle"><input type="checkbox" id="dp-stars-on" /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">WARP</span>
        <input type="range" id="dp-stars-speed" min="0" max="3" step="0.05" value="0.35" />
        <span class="dp-ctrl-val" id="dp-stars-speed-val">0.35&times;</span>
      </div>

      <div class="dp-section-label">// Hercules</div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">AMBER</span>
        <label class="dp-toggle"><input type="checkbox" id="dp-herc-on" checked /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">WASH</span>
        <input type="range" id="dp-herc-wash" min="0" max="1.0" step="0.05" value="0.55" />
        <span class="dp-ctrl-val" id="dp-herc-wash-val">0.55</span>
      </div>

      <hr class="dp-divider" />

      <div class="dp-footer">
        <div class="dp-status-row">
          <div class="dp-status-dot"></div>
          <span class="dp-footer-txt">SIGNAL ACTIVE</span>
        </div>
        <span class="dp-footer-txt" id="dp-clock">—</span>
      </div>

      <hr class="dp-divider" />

      <div class="dp-section-label" style="text-align:center;margin-bottom:8px">TAP ZONE DEMO</div>
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:10px" id="dp-dots"></div>
      <div class="dp-ctrl-row">
        <button class="dp-btn" id="dp-tap-btn">TAP&nbsp;[4X]</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const panel = document.getElementById('dev-panel');

  // ── swatches ────────────────────────────────────────────────────────────────
  const swatchContainer = document.getElementById('dp-swatches');
  SWATCHES.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'dp-sw' + (i === 0 ? ' dp-sw-on' : '');
    el.style.background = s.color;
    el.title = s.label;
    el.addEventListener('click', () => {
      swatchContainer.querySelectorAll('.dp-sw').forEach(sw => sw.classList.remove('dp-sw-on'));
      el.classList.add('dp-sw-on');
      activeColor = i;
      const c = s.color;
      // derive dark/darker variants
      panel.style.setProperty('--dp-p',  c);
      panel.style.setProperty('--dp-pd', dimColor(c, 0.45));
      panel.style.setProperty('--dp-pl', dimColor(c, 0.14));
    });
    swatchContainer.appendChild(el);
  });

  function dimColor(hex, factor) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgb(${(r*factor)|0},${(g*factor)|0},${(b*factor)|0})`;
  }

  // ── animation sliders ───────────────────────────────────────────────────────
  function wireSlider(id, valId, prop, unit) {
    const sl = document.getElementById(id);
    const vl = document.getElementById(valId);
    sl.addEventListener('input', () => {
      const v = parseFloat(sl.value);
      vl.textContent = v.toFixed(v < 1 ? 2 : 1) + unit;
      panel.style.setProperty(prop, v + unit);
    });
  }
  wireSlider('dp-slide',   'dp-slide-val',   '--dp-slide', 's');
  wireSlider('dp-scan',    'dp-scan-val',    '--dp-scn',   's');
  wireSlider('dp-pulse',   'dp-pulse-val',   '--dp-pls',   's');
  wireSlider('dp-flicker', 'dp-flicker-val', '--dp-flk',   's');

  // ── face mesh controls ──────────────────────────────────────────────────────
  function wireToggle(id, globalKey) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = window[globalKey];
    el.addEventListener('change', () => { window[globalKey] = el.checked; });
  }
  function wireFaceSlider(id, valId, globalKey, fmt) {
    const sl = document.getElementById(id);
    const vl = document.getElementById(valId);
    if (!sl) return;
    sl.addEventListener('input', () => {
      const v = parseFloat(sl.value);
      vl.textContent = fmt(v);
      window[globalKey] = v;
    });
  }

  wireToggle('dp-face-on',    'FACE_ENABLED');
  wireToggle('dp-face-pulse', 'FACE_PULSE');
  wireToggle('dp-face-scan',  'FACE_SCAN');
  wireFaceSlider('dp-face-speed',  'dp-face-speed-val',  'FACE_SPEED',    v => v.toFixed(2) + '×');
  wireFaceSlider('dp-face-trail',  'dp-face-trail-val',  'FACE_TRAIL',    v => v.toFixed(2));
  wireFaceSlider('dp-face-wobble', 'dp-face-wobble-val', 'FACE_WOBBLE',   v => v.toFixed(2));
  wireFaceSlider('dp-face-spdvar', 'dp-face-spdvar-val', 'FACE_SPEEDVAR', v => v.toFixed(2));

  wireToggle('dp-wheel-on', 'WHEEL_ENABLED');
  wireFaceSlider('dp-wheel-spin', 'dp-wheel-spin-val', 'WHEEL_SPIN', v => v.toFixed(0) + '\u00b0/s');

  // ── starfield controls (drive the canvas directly) ──────────────────────────
  const starsEl = document.getElementById('stars');
  const starsOn = document.getElementById('dp-stars-on');
  if (starsEl && starsOn) {
    starsOn.checked = parseFloat(getComputedStyle(starsEl).opacity) > 0;
    starsOn.addEventListener('change', () => {
      starsEl.style.opacity = starsOn.checked ? '1' : '0';
    });
    const ss  = document.getElementById('dp-stars-speed');
    const ssv = document.getElementById('dp-stars-speed-val');
    ss.addEventListener('input', () => {
      const v = parseFloat(ss.value);
      ssv.textContent = v.toFixed(2) + '×';
      if (window.setWarpSpeed) window.setWarpSpeed(v);
    });
  }

  // ── hercules wash controls (drive the overlay div directly) ─────────────────
  const hercEl = document.getElementById('herc-wash');
  const hercOn = document.getElementById('dp-herc-on');
  if (hercEl && hercOn) {
    hercOn.addEventListener('change', () => {
      hercEl.style.display = hercOn.checked ? 'block' : 'none';
    });
    const hs = document.getElementById('dp-herc-wash');
    const hv = document.getElementById('dp-herc-wash-val');
    hs.addEventListener('input', () => {
      const v = parseFloat(hs.value);
      hv.textContent = v.toFixed(2);
      hercEl.style.opacity = v;
    });
  }

  // ── tap zone demo dots ──────────────────────────────────────────────────────
  const dotsEl  = document.getElementById('dp-dots');
  let demotaps  = 0;
  let demoTimer = null;

  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.style.cssText = 'width:8px;height:8px;border-radius:50%;border:1px solid var(--dp-pd);background:transparent;transition:background 0.15s';
    dotsEl.appendChild(d);
  }

  function setDots(n) {
    [...dotsEl.children].forEach((d, i) => {
      d.style.background = i < n ? 'var(--dp-p)' : 'transparent';
      d.style.boxShadow  = i < n ? '0 0 5px var(--dp-p)' : 'none';
    });
  }

  document.getElementById('dp-tap-btn').addEventListener('click', () => {
    demotaps++;
    clearTimeout(demoTimer);
    setDots(demotaps);
    if (demotaps >= 4) {
      setTimeout(() => { demotaps = 0; setDots(0); }, 600);
    } else {
      demoTimer = setTimeout(() => { demotaps = 0; setDots(0); }, 2000);
    }
  });

  // ── open / close ────────────────────────────────────────────────────────────
  function openPanel()  { overlay.classList.add('dp-open');    refreshOnce(); schedulePoll(); }
  function closePanel() { overlay.classList.remove('dp-open'); clearTimeout(pollTimer); }

  document.getElementById('dp-close').addEventListener('click', closePanel);

  // ── 4-tap corner trigger ────────────────────────────────────────────────────
  let taps = 0, tapTimer = null;
  const ZONE = 80, WIN = 2000;

  document.addEventListener('pointerdown', e => {
    const inZone = e.clientX > window.innerWidth  - ZONE &&
                   e.clientY > window.innerHeight - ZONE;
    if (!inZone) { taps = 0; clearTimeout(tapTimer); return; }
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, WIN);
    if (taps >= 4) { taps = 0; clearTimeout(tapTimer); openPanel(); }
  });

  // ── FPS counter ─────────────────────────────────────────────────────────────
  let fps = 0, frames = 0, fpsLast = performance.now();
  (function fpsLoop(ts) {
    frames++;
    if (ts - fpsLast >= 1000) { fps = frames; frames = 0; fpsLast = ts; }
    requestAnimationFrame(fpsLoop);
  })(performance.now());

  // load time (once)
  const loadTime = (() => {
    try {
      const t = performance.timing;
      return ((t.loadEventEnd - t.navigationStart) / 1000).toFixed(2) + 's';
    } catch { return '—'; }
  })();

  // ── poll ────────────────────────────────────────────────────────────────────
  let pollTimer = null;

  function refreshOnce() {
    document.getElementById('dp-vw').textContent  = window.innerWidth  + 'px';
    document.getElementById('dp-vh').textContent  = window.innerHeight + 'px';
    document.getElementById('dp-dpr').textContent = (window.devicePixelRatio || 1).toFixed(1);
    document.getElementById('dp-load').textContent = loadTime;
  }

  function poll() {
    if (!overlay.classList.contains('dp-open')) return;

    document.getElementById('dp-fps').textContent = fps;

    const mem = performance.memory;
    document.getElementById('dp-mem').textContent = mem
      ? (mem.usedJSHeapSize / 1048576).toFixed(1) + ' MB'
      : '—';

    document.getElementById('dp-clock').textContent = new Date().toTimeString().slice(0, 8);

    pollTimer = setTimeout(poll, 500);
  }

  function schedulePoll() { clearTimeout(pollTimer); poll(); }

  window.addEventListener('resize', () => {
    if (overlay.classList.contains('dp-open')) refreshOnce();
  });

})();
