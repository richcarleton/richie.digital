// ── devpanel.js — CRT amber phosphor dev panel ───────────────────────────────
// Trigger: tap bottom-right corner (80×80 px) 4× within 2 s

(function () {

  // ── build DOM ───────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'dev-overlay';
  overlay.innerHTML = `
    <div id="dev-panel">
      <div class="dp-scanline"></div>

      <div class="dp-header">
        <div>
          <div class="dp-title">DEV <span class="dp-blink">_</span></div>
          <div class="dp-subtitle">richie.digital / v0.1</div>
        </div>
        <button class="dp-close" id="dp-close">✕</button>
      </div>

      <div class="dp-section-label">Scene</div>
      <div class="dp-row"><span class="dp-key">fps</span>        <span class="dp-val dp-live" id="dp-fps">—</span></div>
      <div class="dp-row"><span class="dp-key">time tint</span>  <span class="dp-val" id="dp-tint">—</span></div>
      <div class="dp-row"><span class="dp-key">planet</span>     <span class="dp-val dp-live" id="dp-phase">—</span></div>
      <div class="dp-row"><span class="dp-key">comet</span>      <span class="dp-val dp-dim" id="dp-comet">idle</span></div>
      <div class="dp-row"><span class="dp-key">midi</span>       <span class="dp-val dp-dim" id="dp-midi">—</span></div>

      <hr class="dp-divider" />

      <div class="dp-section-label">Controls</div>

      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">dither</span>
        <input type="range" id="dp-dither" min="2" max="16" step="0.5" value="7" />
        <span class="dp-ctrl-val" id="dp-dither-val">7.0</span>
      </div>

      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">warp</span>
        <input type="range" id="dp-warp" min="0.1" max="5" step="0.05" value="0.6" />
        <span class="dp-ctrl-val" id="dp-warp-val">0.60</span>
      </div>

      <div class="dp-ctrl-row">
        <span class="dp-ctrl-lbl">comet</span>
        <button class="dp-btn" id="dp-fire">fire</button>
      </div>

      <hr class="dp-divider" />

      <div class="dp-footer">
        <div class="dp-status-row">
          <div class="dp-status-dot"></div>
          <span class="dp-footer-txt">system live</span>
        </div>
        <span class="dp-footer-txt" id="dp-clock">—</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── open / close ────────────────────────────────────────────────────────────
  function openPanel()  { overlay.classList.add('dp-open');    schedulePoll(); }
  function closePanel() { overlay.classList.remove('dp-open'); }

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

    if (taps >= 4) {
      taps = 0;
      clearTimeout(tapTimer);
      openPanel();
    }
  });

  // ── FPS counter ─────────────────────────────────────────────────────────────
  let fps = 0, frames = 0, fpsLast = performance.now();
  (function fpsLoop(ts) {
    frames++;
    if (ts - fpsLast >= 1000) { fps = frames; frames = 0; fpsLast = ts; }
    requestAnimationFrame(fpsLoop);
  })(performance.now());

  // ── tint label ──────────────────────────────────────────────────────────────
  function tintLabel() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const peak = (x, c, w) => Math.max(0, 1 - Math.abs(x - c) / w);
    const s = peak(h, 19, 3.5);
    const m = Math.max(peak(h, 0, 3.5), peak(h, 24, 3.5));
    if (s > m && s > 0.04) return `sunset +${(s * 100) | 0}%`;
    if (m > 0.04)          return `midnight +${(m * 100) | 0}%`;
    return 'neutral';
  }

  // ── poll stats ──────────────────────────────────────────────────────────────
  let pollTimer = null;

  function poll() {
    if (!overlay.classList.contains('dp-open')) return;

    document.getElementById('dp-fps').textContent  = fps + ' fps';
    document.getElementById('dp-tint').textContent = tintLabel();

    const phase = window._planetPhase;
    document.getElementById('dp-phase').textContent =
      (phase !== undefined) ? phase.toFixed(3) : '—';

    const cometEl = document.getElementById('dp-comet');
    const active  = !!window._cometActive;
    cometEl.textContent  = active ? 'flying' : 'idle';
    cometEl.className    = 'dp-val' + (active ? ' dp-live' : ' dp-dim');

    const midiEl = document.getElementById('dp-midi');
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: false }).then(a => {
        const n = a.inputs.size;
        midiEl.textContent = n ? n + ' device' + (n > 1 ? 's' : '') : 'none';
        midiEl.className   = 'dp-val' + (n ? '' : ' dp-dim');
      }).catch(() => {
        midiEl.textContent = 'denied';
        midiEl.className   = 'dp-val dp-dim';
      });
    } else {
      midiEl.textContent = 'n/a';
      midiEl.className   = 'dp-val dp-dim';
    }

    document.getElementById('dp-clock').textContent =
      new Date().toTimeString().slice(0, 8);

    pollTimer = setTimeout(poll, 500);
  }

  function schedulePoll() { clearTimeout(pollTimer); poll(); }

  // ── dither slider ───────────────────────────────────────────────────────────
  const ditherSlider = document.getElementById('dp-dither');
  const ditherVal    = document.getElementById('dp-dither-val');
  ditherSlider.addEventListener('input', () => {
    const v = parseFloat(ditherSlider.value);
    ditherVal.textContent = v.toFixed(1);
    if (window.planetUniforms) window.planetUniforms.setDitherDepth(v);
  });

  // ── warp slider ─────────────────────────────────────────────────────────────
  const warpSlider = document.getElementById('dp-warp');
  const warpVal    = document.getElementById('dp-warp-val');
  warpSlider.addEventListener('input', () => {
    const v = parseFloat(warpSlider.value);
    warpVal.textContent = v.toFixed(2);
    if (window.setWarpSpeed) window.setWarpSpeed(v);
  });
  // reset warp when panel closes
  document.getElementById('dp-close').addEventListener('click', () => {
    if (window.resetWarpSpeed) window.resetWarpSpeed();
    warpSlider.value = '0.6';
    warpVal.textContent = '0.60';
  });

  // ── fire comet ──────────────────────────────────────────────────────────────
  document.getElementById('dp-fire').addEventListener('click', () => {
    if (window.triggerComet) window.triggerComet();
  });

})();
