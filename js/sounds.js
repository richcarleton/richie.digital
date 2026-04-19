// ── sounds.js — random smurf sounds on cat click ─────────────────────────────
// Drop any audio files into smurf/ and list them here.

(function () {

const SAMPLES = [
  'snd/00loop.wav',
  'snd/Big Pot 1.wav',
  'snd/Simple Hat 3.wav',
];

// Preload all, silently drop any that fail to load
const pool = [];
SAMPLES.forEach(src => {
  const a = new Audio(src);
  a.preload = 'auto';
  a.addEventListener('canplaythrough', () => { if (!pool.includes(a)) pool.push(a); }, { once: true });
  a.addEventListener('error', () => {/* missing file — skip */});
  a.load();
});

function playRandom() {
  if (!pool.length) return;
  const a = pool[(Math.random() * pool.length) | 0];
  a.currentTime = 0;
  a.play().catch(() => {});   // swallow autoplay-policy rejections
}

window.playCatSound = playRandom;

})();
