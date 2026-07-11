// ── nameplate.js — typeface-cycling RICHIE.DIGITAL, settles to top-left ──────
(function () {

const ORIG        = 'RICHIE.DIGITAL';
const GLITCH_CHARS = '!@#$%^&*<>?/\\|[]{}~';

// ── center stage (typeface cycling) ──────────────────────────────────────────
const stage = document.createElement('div');
stage.id = 'name-stage';
document.body.appendChild(stage);

const nameEl = document.createElement('span');
nameEl.id = 'name-text';
nameEl.textContent = ORIG;
stage.appendChild(nameEl);

// ── small top-left plate (shown after cycling completes) ──────────────────────
const plate = document.createElement('div');
plate.id = 'nameplate';
plate.textContent = 'richie.digital';
document.body.appendChild(plate);

// ── typeface styles — last one triggers settle ────────────────────────────────
const styles = [
  () => apply(`
    font-family: 'Courier New', monospace;
    font-size: clamp(32px, 6vw, 64px);
    font-weight: 700;
    letter-spacing: 0.18em;
    color: #00ffe7;
    text-shadow: 0 0 8px #00ffe7, 0 0 30px #00ffe799, 0 0 60px #00ffe744;
  `),
  () => apply(`
    font-family: Impact, 'Arial Narrow', sans-serif;
    font-size: clamp(36px, 7vw, 72px);
    font-weight: 900;
    letter-spacing: 0.22em;
    color: transparent;
    -webkit-text-stroke: 1.5px rgba(255,255,255,0.85);
    text-shadow: none;
  `),
  () => apply(`
    font-family: 'Courier New', monospace;
    font-size: clamp(30px, 5.5vw, 58px);
    font-weight: 400;
    letter-spacing: 0.08em;
    color: #ff2d78;
    text-shadow: 3px 0 0 #00ffe7, -3px 0 0 #ff2d78;
  `),
  () => apply(`
    font-family: Arial, sans-serif;
    font-size: clamp(34px, 6.5vw, 68px);
    font-weight: 100;
    letter-spacing: 0.35em;
    color: rgba(255,255,255,0.12);
    -webkit-text-stroke: 0.5px rgba(255,255,255,0.5);
    text-shadow: none;
  `),
  () => apply(`
    font-family: 'Courier New', monospace;
    font-size: clamp(28px, 5vw, 54px);
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #ffb800;
    text-shadow: 0 0 6px #ffb800aa, 0 0 20px #ffb80055;
  `),
  // last — triggers settle
  () => apply(`
    font-family: Georgia, serif;
    font-size: clamp(32px, 6vw, 62px);
    font-weight: 700;
    letter-spacing: 0.2em;
    font-style: italic;
    color: transparent;
    -webkit-text-stroke: 1px rgba(160, 220, 255, 0.9);
    text-shadow: 0 0 20px rgba(160,220,255,0.3);
  `),
];

function apply(css) {
  nameEl.style.cssText = `display:inline-block;transition:all 0.8s ease;${css}`;
}

let currentStyle = 0;
let glitching    = false;
let done         = false;

function glitch(cb) {
  if (glitching) { if (cb) cb(); return; }
  glitching = true;
  let i = 0;
  const iv = setInterval(() => {
    nameEl.textContent = ORIG.split('').map(c =>
      Math.random() < 0.3
        ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        : c
    ).join('');
    if (++i >= 10) {
      clearInterval(iv);
      nameEl.textContent = ORIG;
      glitching = false;
      if (cb) cb();
    }
  }, 50);
}

function settle() {
  if (done) return;
  done = true;
  glitch(() => {
    styles[styles.length - 1]();
    setTimeout(() => {
      stage.style.transition = 'opacity 0.55s ease, transform 0.65s cubic-bezier(0.4,0,0.2,1)';
      stage.style.opacity   = '0';
      stage.style.transform = 'translate(-50%, -50%) scale(0.25)';
      setTimeout(() => {
        stage.style.display = 'none';
        plate.classList.add('visible');
      }, 700);
    }, 800);
  });
}

function cycle() {
  if (done) return;
  const isLast = currentStyle === styles.length - 1;
  if (isLast) {
    glitch(() => { styles[currentStyle](); setTimeout(settle, 1200); });
    return;
  }
  currentStyle++;
  glitch(() => styles[currentStyle]());
}

// delay start so the vector face has the stage first on page load
setTimeout(() => {
  styles[0]();
  setInterval(cycle, 2800);
  setInterval(() => { if (!done && Math.random() < 0.4) glitch(); }, 1800);
}, 1500);

// ── hide / restore small plate when terminal is active ────────────────────────
const terminal = document.getElementById('terminal');
if (terminal) {
  new MutationObserver(() => {
    if (!done) return;
    if (terminal.classList.contains('visible')) {
      plate.classList.remove('visible');
    } else {
      setTimeout(() => plate.classList.add('visible'), 700);
    }
  }).observe(terminal, { attributes: true, attributeFilter: ['class'] });
}

})();
