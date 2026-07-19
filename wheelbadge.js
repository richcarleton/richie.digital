// ── wheelbadge.js — spinning EUC wheel, bottom-left, links to suit/ ───────────
// Tunables: WHEEL_ENABLED (toggle), WHEEL_SPIN (idle deg/s; hover multiplies)
(function () {

  window.WHEEL_ENABLED = window.WHEEL_ENABLED !== undefined ? window.WHEEL_ENABLED : true;
  window.WHEEL_SPIN    = window.WHEEL_SPIN    !== undefined ? window.WHEEL_SPIN    : 24;

  const link = document.createElement('a');
  link.id = 'wheel-badge';
  link.href = 'suit/';
  link.title = 'suit — motorcycle circuit';
  link.style.cssText = [
    'position:fixed', 'left:18px', 'bottom:18px', 'width:44px', 'height:44px',
    'z-index:12', 'display:block', 'opacity:0', 'transition:opacity 1s ease, filter .25s ease',
    'filter:drop-shadow(0 0 0 rgba(0,255,231,0))',
  ].join(';');

  // EUC wheel: tire, yellow hub, spokes, pedal shell hint
  link.innerHTML =
    '<svg viewBox="0 0 44 44" width="44" height="44">' +
      '<g id="wheel-spin" transform-origin="22 22">' +
        '<circle cx="22" cy="22" r="19" fill="none" stroke="rgba(232,230,242,0.85)" stroke-width="3.4"/>' +
        '<circle cx="22" cy="22" r="8"  fill="none" stroke="#f5c518" stroke-width="2.6"/>' +
        '<line x1="22" y1="14.5" x2="22" y2="5"  stroke="rgba(232,230,242,0.6)" stroke-width="2"/>' +
        '<line x1="22" y1="29.5" x2="22" y2="39" stroke="rgba(232,230,242,0.6)" stroke-width="2"/>' +
        '<line x1="14.5" y1="22" x2="5"  y2="22" stroke="rgba(232,230,242,0.6)" stroke-width="2"/>' +
        '<line x1="29.5" y1="22" x2="39" y2="22" stroke="rgba(232,230,242,0.6)" stroke-width="2"/>' +
      '</g>' +
      '<rect x="19" y="1" width="6" height="7" rx="1.5" fill="none" stroke="#00ffe7" stroke-width="1.4" opacity="0.55"/>' +
    '</svg>';
  document.body.appendChild(link);

  // fade in after the nameplate has had its moment
  setTimeout(() => { link.style.opacity = '0.75'; }, 2600);

  let hover = false;
  link.addEventListener('mouseenter', () => {
    hover = true;
    link.style.opacity = '1';
    link.style.filter = 'drop-shadow(0 0 7px rgba(0,255,231,0.7))';
  });
  link.addEventListener('mouseleave', () => {
    hover = false;
    link.style.opacity = '0.75';
    link.style.filter = 'drop-shadow(0 0 0 rgba(0,255,231,0))';
  });

  const g = link.querySelector('#wheel-spin');
  let angle = 0, last = performance.now();
  (function spin(now) {
    requestAnimationFrame(spin);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    link.style.display = window.WHEEL_ENABLED ? 'block' : 'none';
    if (!window.WHEEL_ENABLED) return;
    angle = (angle + window.WHEEL_SPIN * (hover ? 8 : 1) * dt) % 360;
    g.setAttribute('transform', 'rotate(' + angle + ' 22 22)');
  })(last);

})();
