// ── viewer.js — zoom-through reveal for SVGs and images ──────────────────────
(function () {

const overlay = document.createElement('div');
overlay.id = 'viewer';
overlay.innerHTML = `
  <div id="viewer-stage">
    <div id="viewer-media"></div>
    <div id="viewer-caption">
      <span id="viewer-label"></span>
      <span id="viewer-sub"></span>
    </div>
  </div>
`;
document.body.appendChild(overlay);

const stage   = document.getElementById('viewer-stage');
const media   = document.getElementById('viewer-media');
const capLabel = document.getElementById('viewer-label');
const capSub   = document.getElementById('viewer-sub');

function show(entry) {
  media.innerHTML = '';
  capLabel.textContent = entry.label || '';
  capSub.textContent   = entry.sub   || '';

  if (entry.type === 'svg') {
    const img = document.createElement('img');
    img.src = entry.src;
    img.className = 'viewer-svg';
    media.appendChild(img);
  } else {
    const img = document.createElement('img');
    img.src = entry.src;
    img.className = 'viewer-img';
    media.appendChild(img);
  }

  overlay.classList.remove('visible');
  stage.classList.remove('zoomed');

  // force reflow so animation restarts cleanly
  void stage.offsetWidth;

  overlay.classList.add('visible');
  stage.classList.add('zoomed');
}

function hide() {
  overlay.classList.remove('visible');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') hide();
});

overlay.addEventListener('click', hide);

window.showViewer = show;
window.hideViewer = hide;

})();
