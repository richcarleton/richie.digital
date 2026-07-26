// ── terminal.js — appears on keypress, routes commands to panels ──────────────
(function () {

const terminal = document.getElementById('terminal');
const input    = document.getElementById('terminal-input');
let hideTimer  = null;

function show() {
  terminal.classList.add('visible');
  input.focus();
  resetHide();
}

function hide() {
  terminal.classList.remove('visible');
  input.blur();
  input.value = '';
}

function resetHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 5000);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hide();
    if (window.hidePanel) window.hidePanel();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  show();
});

input.addEventListener('input', resetHide);

input.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const cmd = input.value.trim().toLowerCase();
  input.value = '';
  resetHide();
  if (!cmd) return;

  if (cmd === 'menu' || cmd === 'help' || cmd === '?') {
    if (window.showMenu) window.showMenu();
  } else if (cmd === 'ricardo') {
    window.location.href = 'ricardo/';   // 🐈 the pyramid awaits
  } else if (cmd === 'suit' || cmd === 'circuit' || cmd === 'ride') {
    window.location.href = 'suit/';      // 🏍 knees are the suspension
  } else if (cmd === 'crash') {
    hide();
    if (window.DOSCrash) new window.DOSCrash().init();
  } else if (window.SITE_MEDIA && window.SITE_MEDIA[cmd]) {
    window.showViewer(window.SITE_MEDIA[cmd]);
  } else if (window.SITE_CONTENT && window.SITE_CONTENT[cmd]) {
    window.showPanel(cmd);
  } else if (cmd && window.showTextFlythrough) {
    window.showTextFlythrough(cmd);
  }
});

})();
