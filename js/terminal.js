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

/* ── mobile: no hardware key ever fires the listener above, so a screen
   tap has to do the same job. show() already calls input.focus() — on
   browsers that allow focusing an input from a delegated handler, that
   one tap both reveals the bar and raises the keyboard; on the stricter
   ones (notably iOS Safari), it just reveals it and a second tap on the
   now-visible input raises the keyboard, same as tapping any text field. */
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') show();
});

input.addEventListener('input', resetHide);

/* ── keep the bar above the on-screen keyboard instead of behind it ──────
   position:fixed measures against the full layout viewport, which iOS
   Safari never shrinks for the keyboard (Android usually does, but not
   always) — so a plain `bottom: 36px` can end up hidden behind it. Track
   window.visualViewport instead, which always reports the space the
   keyboard leaves visible, and lift the bar to sit just above it.        */
if (window.visualViewport) {
  const baseBottom = 36; // matches #terminal{bottom:36px} in css/style.css
  const avoidKeyboard = () => {
    const vv = window.visualViewport;
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    terminal.style.bottom = (baseBottom + covered) + 'px';
  };
  window.visualViewport.addEventListener('resize', avoidKeyboard);
  window.visualViewport.addEventListener('scroll', avoidKeyboard);
}

/* ── command dispatch — shared by the typed terminal AND the "?" menu, so
   tapping a listed command (menu.js) does the exact same thing as typing
   it. Keep this the single place new commands get wired up.             */
function runCommand(raw) {
  const cmd = (raw || '').trim().toLowerCase();
  if (!cmd) return;

  if (cmd === 'menu' || cmd === 'help' || cmd === '?') {
    if (window.showMenu) window.showMenu();
  } else if (cmd === 'ricardo') {
    window.location.href = '/ricardo/';   // 🐈 the pyramid awaits
  } else if (cmd === 'motobang' || cmd === 'suit' || cmd === 'circuit' || cmd === 'ride') {
    window.location.href = '/motobang/';  // 🏍 knees are the suspension
  } else if (cmd === 'train') {
    window.location.href = '/transit-ticker/';  // 🚆 REM departures chyron
  } else if (cmd === 'beatrig' || cmd === 'stickman' || cmd === 'beatstickman') {
    window.location.href = '/triganim.html';  // 🕺 poses on a beat grid
  } else if (cmd === 'vert') {
    window.location.href = '/vert/';  // 🏙 glass tower corridor
  } else if (cmd === 'atelier') {
    window.location.href = '/atelier.html';  // 🧵 tile-safe texture studio
  } else if (cmd === 'catstan') {
    window.location.href = '/CATSTAN/';  // 🐈
  } else if (cmd === 'catalog' || cmd === 'catalogue' || cmd === 'grid' || cmd === 'units') {
    window.location.href = '/catalog.html';  // 📦 the 90s-catalogue grid
  } else if (cmd === 'tesseract' || cmd === 'hypercube') {
    window.location.href = '/tesseract.html';  // 🧊 4D wireframe, mouse-reactive
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
}
window.runCommand = runCommand;

input.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const cmd = input.value;
  input.value = '';
  resetHide();
  runCommand(cmd);
});

})();
