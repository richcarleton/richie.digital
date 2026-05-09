// ── nameplate.js — glows in on load, hides when terminal is active ────────────
(function () {

const el = document.createElement('div');
el.id = 'nameplate';
el.textContent = 'richie.digital';
document.body.appendChild(el);

let showTimer = null;

function show(ms) {
  clearTimeout(showTimer);
  showTimer = setTimeout(() => el.classList.add('visible'), ms);
}

function hide() {
  clearTimeout(showTimer);
  el.classList.remove('visible');
}

show(1000);

const terminal = document.getElementById('terminal');
if (terminal) {
  new MutationObserver(() => {
    if (terminal.classList.contains('visible')) {
      hide();
    } else {
      show(700);
    }
  }).observe(terminal, { attributes: true, attributeFilter: ['class'] });
}

})();
