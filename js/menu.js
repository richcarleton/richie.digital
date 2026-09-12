// ── menu.js — command reference slideout ──────────────────────────────────────
(function () {

const panel = document.createElement('div');
panel.id = 'menu-panel';
document.body.appendChild(panel);

const mediaLabels = { svg: 'svg viewer', image: 'image', zod: 'zod mode', planet: '3d planet' };

/* `runnable` commands get a real tap target (data-cmd + role=button) that
   the delegated handler below fires through window.runCommand — same
   dispatch the typed terminal uses. The "<anything>" hint row is just
   illustrative, so it stays inert. */
function row(cmdClass, key, desc, runnable) {
  const cmdEl = runnable
    ? `<span class="${cmdClass} menu-cmd-run" data-cmd="${key}" role="button" tabindex="0">${key}</span>`
    : `<span class="${cmdClass}">${key}</span>`;
  return `<div class="menu-row">${cmdEl}<span class="menu-desc">${desc}</span></div>`;
}

function build() {
  const content = window.SITE_CONTENT || {};
  const media   = window.SITE_MEDIA   || {};

  const contentRows = Object.keys(content)
    .map(k => row('menu-cmd', k, content[k].title || k, true))
    .join('');

  const mediaRows = Object.keys(media)
    .map(k => row('menu-cmd', k, mediaLabels[media[k].type] || media[k].type || '', true))
    .join('');

  panel.innerHTML = `
    <div class="menu-heading">commands</div>
    <div class="menu-section">
      <div class="menu-section-label">content</div>
      ${contentRows}
    </div>
    <div class="menu-section">
      <div class="menu-section-label">media</div>
      ${mediaRows}
    </div>
    <div class="menu-section">
      <div class="menu-section-label">garage</div>
      ${row('menu-cmd', 'catalog', '90s-catalogue grid — every unit', true)}
      ${row('menu-cmd', 'tesseract', '4D hypercube, mouse-reactive', true)}
      ${row('menu-cmd', 'motobang', 'motorcycle circuit', true)}
      ${row('menu-cmd', 'ricardo', 'the pyramid awaits', true)}
      ${row('menu-cmd', 'train', 'transit departures chyron', true)}
      ${row('menu-cmd', 'beatrig', 'stick-figure beat-grid poser', true)}
      ${row('menu-cmd', 'vert', 'glass tower corridor', true)}
      ${row('menu-cmd', 'atelier', 'tile-safe texture studio', true)}
      ${row('menu-cmd', 'catstan', '???', true)}
    </div>
    <div class="menu-section">
      ${row('menu-cmd-dim', '&lt;anything&gt;', 'text flythrough')}
    </div>
    <div class="menu-hint">tap a command · esc / tap outside to close</div>
  `;
}

function open() {
  build();
  panel.classList.add('open');
}

function close() {
  panel.classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { close(); return; }
  if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey &&
      document.activeElement !== document.getElementById('terminal-input')) {
    open();
  }
});

/* run the tapped/clicked command, then close — same dispatch the typed
   terminal uses, so a menu item does exactly what typing it would.      */
panel.addEventListener('click', e => {
  const el = e.target.closest('[data-cmd]');
  if (!el) return;
  close();
  if (window.runCommand) window.runCommand(el.dataset.cmd);
});
panel.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-cmd]');
  if (!el) return;
  e.preventDefault();
  close();
  if (window.runCommand) window.runCommand(el.dataset.cmd);
});

/* pointerdown, not click: fires immediately on touch (no synthetic-click
   delay/quirks) so tapping outside the panel reliably dismisses it.     */
document.addEventListener('pointerdown', e => {
  if (panel.classList.contains('open') && !panel.contains(e.target)) close();
});

window.showMenu = open;
window.hideMenu = close;

})();
