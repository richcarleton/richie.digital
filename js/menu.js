// ── menu.js — command reference slideout ──────────────────────────────────────
(function () {

const panel = document.createElement('div');
panel.id = 'menu-panel';
document.body.appendChild(panel);

const mediaLabels = { svg: 'svg viewer', image: 'image', zod: 'zod mode', planet: '3d planet' };

function row(cmdClass, key, desc) {
  return `<div class="menu-row"><span class="${cmdClass}">${key}</span><span class="menu-desc">${desc}</span></div>`;
}

function build() {
  const content = window.SITE_CONTENT || {};
  const media   = window.SITE_MEDIA   || {};

  const contentRows = Object.keys(content)
    .map(k => row('menu-cmd', k, content[k].title || k))
    .join('');

  const mediaRows = Object.keys(media)
    .map(k => row('menu-cmd', k, mediaLabels[media[k].type] || media[k].type || ''))
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
      ${row('menu-cmd', 'motobang', 'motorcycle circuit')}
    </div>
    <div class="menu-section">
      ${row('menu-cmd-dim', '&lt;anything&gt;', 'text flythrough')}
    </div>
    <div class="menu-hint">esc &nbsp;·&nbsp; click outside</div>
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

document.addEventListener('click', e => {
  if (panel.classList.contains('open') && !panel.contains(e.target)) close();
});

window.showMenu = open;
window.hideMenu = close;

})();
