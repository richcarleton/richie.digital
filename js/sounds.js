// ── sounds.js — random cat-click sounds ──────────────────────────────────────
// Priority order: numbered files (00.wav, 01.wav, …) then any extras below.
// All samples are capped at 1 second of playback.
// To add sounds: drop files in snd/ and extend the lists below.

(function () {

const MAX_MS = 1000;   // hard playback cap

// ── numbered bank — highest priority, add 01.wav, 02.wav … as needed ─────────
const NUMBERED = [
  'snd/00.wav',
  // 'snd/01.wav',
  // 'snd/02.wav',
];

// ── named extras ──────────────────────────────────────────────────────────────
const EXTRAS = [
  'snd/00loop.wav',
  'snd/Big Pot 1.wav',
  'snd/Simple Hat 3.wav',
];

// Build pool — numbered first, then extras; silently skip missing files
const pool = [];
[...NUMBERED, ...EXTRAS].forEach(src => {
  const a = new Audio(src);
  a.preload = 'auto';
  a.addEventListener('canplaythrough', () => { if (!pool.includes(a)) pool.push(a); }, { once: true });
  a.load();
});

function playRandom() {
  if (!pool.length) return;
  const a = pool[(Math.random() * pool.length) | 0];
  a.currentTime = 0;
  a.play().catch(() => {});
  setTimeout(() => { a.pause(); a.currentTime = 0; }, MAX_MS);
}

window.playCatSound = playRandom;

})();
