// ── terminal.js — appears on keypress, fades on idle ─────────────────────────
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

// any key reveals it; printable chars land in the input naturally via focus
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { hide(); return; }
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
  // commands wired up here later
  console.log('cmd:', cmd);
});

})();
