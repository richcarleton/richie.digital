// ── ricardo/js/touch.js — on-screen controls (Pixel-first) ───────────────────
// Shown when the primary pointer is coarse. Talks to game via RICARDO_INPUT.
(function () {
  'use strict';
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!coarse && !('ontouchstart' in window)) return;

  const wrap = document.createElement('div');
  wrap.id = 'touch-controls';
  wrap.innerHTML = `
    <div class="tc-pad">
      <button class="tc-btn" data-k="up">▲</button>
      <div class="tc-mid">
        <button class="tc-btn" data-k="left">◀</button>
        <button class="tc-btn" data-k="right">▶</button>
      </div>
      <button class="tc-btn" data-k="down">▼</button>
    </div>
    <button class="tc-btn tc-jump" data-k="jump">⦿</button>
  `;
  document.body.appendChild(wrap);

  // Per-button pointer tracking: multi-touch safe (hold ▶ while tapping ⦿).
  wrap.querySelectorAll('.tc-btn').forEach(btn => {
    const k = btn.dataset.k;
    const down = e => { e.preventDefault(); btn.classList.add('tc-on'); window.RICARDO_INPUT(k, true); };
    const up   = e => { e.preventDefault(); btn.classList.remove('tc-on'); window.RICARDO_INPUT(k, false); };
    btn.addEventListener('pointerdown',  e => { btn.setPointerCapture(e.pointerId); down(e); });
    btn.addEventListener('pointerup',     up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
})();
