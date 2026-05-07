// ── terminal.js — retro command input ────────────────────────────────────────
(function () {

const input = document.getElementById('terminal-input');

// click anywhere to focus
document.addEventListener('click', () => input.focus());

input.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const cmd = input.value.trim().toLowerCase();
  input.value = '';
  if (!cmd) return;
  // commands wired up here later
  console.log('cmd:', cmd);
});

input.focus();

})();
