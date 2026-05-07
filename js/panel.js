// ── panel.js — content overlay shown by terminal commands ────────────────────
(function () {

const panel = document.createElement('div');
panel.id = 'panel';
document.body.appendChild(panel);

let hideTimer = null;

window.showPanel = function (key) {
  const data = window.SITE_CONTENT && window.SITE_CONTENT[key];
  if (!data) return;

  panel.innerHTML = `
    <div class="panel-title">${data.title}</div>
    <ul class="panel-list">
      ${data.items.map(it => `
        <li>
          <span class="panel-label">${it.label}</span>
          <span class="panel-sub">${it.sub}</span>
        </li>`).join('')}
    </ul>
    <div class="panel-hint">esc to close</div>
  `;

  panel.classList.add('visible');
  clearTimeout(hideTimer);
};

window.hidePanel = function () {
  panel.classList.remove('visible');
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.hidePanel();
});

})();
