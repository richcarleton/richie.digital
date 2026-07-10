// ── ricardo/js/devpanel.js — game tuning panel ───────────────────────────────
// Same house pattern as the homepage panel's "// Face Mesh" section:
// window.EFFECT_RICARDO_* globals + sliders/toggles. Persisted to localStorage.
// Trigger: 4 taps in bottom-LEFT corner (bottom-right is the jump button on
// mobile) or Ctrl+~.
(function () {
  'use strict';
  const LS = 'ricardo.dev';

  const DEFAULTS = {
    EFFECT_RICARDO_GRAVITY: 38,
    EFFECT_RICARDO_SPEED:   6,
    EFFECT_RICARDO_JUMP:    13.5,
    EFFECT_RICARDO_SKULL:   2.5,
    EFFECT_RICARDO_FALL:    4.75,  // tiles survivable; carries across down exits
    EFFECT_RICARDO_VINE:    0.9,   // vine-grab magnet reach (tiles)
    EFFECT_RICARDO_SHAKE:   1,     // camera shake multiplier
    EFFECT_RICARDO_SOUND:   true,
    EFFECT_RICARDO_MUSIC:   true,  // FM techno loop
    EFFECT_RICARDO_FILL:    true,  // fill screen vs integer pixel-fit
    EFFECT_RICARDO_CRT:     true,
  };

  // restore before game.js defaults kick in (this file loads first)
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) {}
  for (const k in DEFAULTS) window[k] = (k in saved) ? saved[k] : DEFAULTS[k];

  function persist() {
    const out = {};
    for (const k in DEFAULTS) out[k] = window[k];
    try { localStorage.setItem(LS, JSON.stringify(out)); } catch (e) {}
  }

  // ── DOM ──────────────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'rdev-overlay';
  overlay.innerHTML = `
    <div id="rdev-panel">
      <div class="dp-header">
        <div class="dp-title">RICARDO.SYS <span class="dp-blink">_</span></div>
        <button class="dp-close" id="rdev-close">✕</button>
      </div>

      <div class="dp-section-label">// Ricardo</div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">GRAVITY</span>
        <input type="range" id="rd-grav" min="20" max="60" step="1" />
        <span class="dp-ctrl-val" id="rd-grav-val"></span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SPEED</span>
        <input type="range" id="rd-speed" min="3" max="10" step="0.25" />
        <span class="dp-ctrl-val" id="rd-speed-val"></span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">JUMP</span>
        <input type="range" id="rd-jump" min="8" max="20" step="0.25" />
        <span class="dp-ctrl-val" id="rd-jump-val"></span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SKULLS</span>
        <input type="range" id="rd-skull" min="1" max="6" step="0.25" />
        <span class="dp-ctrl-val" id="rd-skull-val"></span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">FALL TOL</span>
        <input type="range" id="rd-fall" min="3" max="8" step="0.25" />
        <span class="dp-ctrl-val" id="rd-fall-val"></span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">VINE GRAB</span>
        <input type="range" id="rd-vine" min="0" max="1.5" step="0.05" />
        <span class="dp-ctrl-val" id="rd-vine-val"></span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SHAKE</span>
        <input type="range" id="rd-shake" min="0" max="2" step="0.1" />
        <span class="dp-ctrl-val" id="rd-shake-val"></span>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">SOUND</span>
        <label class="dp-toggle"><input type="checkbox" id="rd-sound" /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">MUSIC</span>
        <label class="dp-toggle"><input type="checkbox" id="rd-music" /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">FILL SCREEN</span>
        <label class="dp-toggle"><input type="checkbox" id="rd-fill" /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">CRT</span>
        <label class="dp-toggle"><input type="checkbox" id="rd-crt" /><span></span></label>
      </div>
      <div class="dp-ctrl-row">
        <button class="dp-btn" id="rd-reset">RESET TUNING</button>
        <button class="dp-btn" id="rd-restart">RESTART RUN</button>
      </div>
      <div class="dp-footer-txt" style="margin-top:8px">4-tap bottom-left · ctrl+~</div>
    </div>
  `;
  document.body.appendChild(overlay);

  function wireSlider(id, key, fmt) {
    const sl = document.getElementById(id), vl = document.getElementById(id + '-val');
    sl.value = window[key]; vl.textContent = fmt(window[key]);
    sl.addEventListener('input', () => {
      window[key] = parseFloat(sl.value);
      vl.textContent = fmt(window[key]);
      persist();
    });
  }
  function wireToggle(id, key, onChange) {
    const el = document.getElementById(id);
    el.checked = !!window[key];
    el.addEventListener('change', () => { window[key] = el.checked; persist(); onChange && onChange(); });
  }

  wireSlider('rd-grav',  'EFFECT_RICARDO_GRAVITY', v => v.toFixed(0));
  wireSlider('rd-speed', 'EFFECT_RICARDO_SPEED',   v => v.toFixed(2) + 't/s');
  wireSlider('rd-jump',  'EFFECT_RICARDO_JUMP',    v => v.toFixed(2));
  wireSlider('rd-skull', 'EFFECT_RICARDO_SKULL',   v => v.toFixed(2) + 't/s');
  wireSlider('rd-fall',  'EFFECT_RICARDO_FALL',    v => v.toFixed(2) + 't');
  wireSlider('rd-vine',  'EFFECT_RICARDO_VINE',    v => v.toFixed(2) + 't');
  wireSlider('rd-shake', 'EFFECT_RICARDO_SHAKE',   v => v.toFixed(1) + '×');
  wireToggle('rd-sound', 'EFFECT_RICARDO_SOUND');
  wireToggle('rd-music', 'EFFECT_RICARDO_MUSIC');
  wireToggle('rd-fill',  'EFFECT_RICARDO_FILL');
  wireToggle('rd-crt',   'EFFECT_RICARDO_CRT', () =>
    document.body.classList.toggle('crt', !!window.EFFECT_RICARDO_CRT));

  document.getElementById('rd-reset').addEventListener('click', () => {
    for (const k in DEFAULTS) window[k] = DEFAULTS[k];
    persist();
    wireSlider('rd-grav',  'EFFECT_RICARDO_GRAVITY', v => v.toFixed(0));
    wireSlider('rd-speed', 'EFFECT_RICARDO_SPEED',   v => v.toFixed(2) + 't/s');
    wireSlider('rd-jump',  'EFFECT_RICARDO_JUMP',    v => v.toFixed(2));
    wireSlider('rd-skull', 'EFFECT_RICARDO_SKULL',   v => v.toFixed(2) + 't/s');
    wireSlider('rd-fall',  'EFFECT_RICARDO_FALL',    v => v.toFixed(2) + 't');
    wireSlider('rd-vine',  'EFFECT_RICARDO_VINE',    v => v.toFixed(2) + 't');
    wireSlider('rd-shake', 'EFFECT_RICARDO_SHAKE',   v => v.toFixed(1) + '×');
    document.getElementById('rd-music').checked = DEFAULTS.EFFECT_RICARDO_MUSIC;
    document.getElementById('rd-fill').checked  = DEFAULTS.EFFECT_RICARDO_FILL;
    document.getElementById('rd-sound').checked = DEFAULTS.EFFECT_RICARDO_SOUND;
    document.getElementById('rd-crt').checked   = DEFAULTS.EFFECT_RICARDO_CRT;
    document.body.classList.toggle('crt', DEFAULTS.EFFECT_RICARDO_CRT);
  });
  document.getElementById('rd-restart').addEventListener('click', () => {
    window.RICARDO_GAME && window.RICARDO_GAME.restart();
    close();
  });

  // ── open/close ───────────────────────────────────────────────────────────────
  function open()  { overlay.classList.add('dp-open'); }
  function close() { overlay.classList.remove('dp-open'); }
  document.getElementById('rdev-close').addEventListener('click', close);

  let taps = 0, timer = null;
  const ZONE = 80, WIN = 2000;
  document.addEventListener('pointerdown', e => {
    const inZone = e.clientX < ZONE && e.clientY > window.innerHeight - ZONE;
    if (!inZone) { taps = 0; clearTimeout(timer); return; }
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; }, WIN);
    if (taps >= 4) { taps = 0; open(); }
  });
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.code === 'Backquote') { e.preventDefault(); overlay.classList.contains('dp-open') ? close() : open(); }
  });
})();
