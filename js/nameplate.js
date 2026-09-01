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

// ── typeface styles — scrappy 80s screen/bitmap fonts, last one triggers settle ─
const styles = [
  () => apply(`
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: clamp(18px, 4vw, 34px);
    font-weight: 400;
    letter-spacing: 0.1em;
    color: #e0e0e0;
    text-shadow: 0 0 8px rgba(224,224,224,0.6), 0 0 30px rgba(224,224,224,0.25);
  `),
  () => apply(`
    font-family: 'VT323', 'Courier New', monospace;
    font-size: clamp(44px, 9vw, 88px);
    font-weight: 400;
    letter-spacing: 0.16em;
    color: transparent;
    -webkit-text-stroke: 1.5px rgba(255,255,255,0.85);
    text-shadow: none;
  `),
  () => apply(`
    font-family: 'Silkscreen', 'Courier New', monospace;
    font-size: clamp(22px, 5vw, 42px);
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #d8d8d8;
    text-shadow: 2px 0 0 #888, -2px 0 0 #f0f0f0;
  `),
  () => apply(`
    font-family: 'Jersey 10', 'Courier New', monospace;
    font-size: clamp(38px, 8vw, 78px);
    font-weight: 400;
    letter-spacing: 0.2em;
    color: rgba(255,255,255,0.14);
    -webkit-text-stroke: 0.5px rgba(255,255,255,0.5);
    text-shadow: none;
  `),
  () => apply(`
    font-family: 'VT323', 'Courier New', monospace;
    font-size: clamp(34px, 6.5vw, 64px);
    font-weight: 400;
    letter-spacing: 0.1em;
    color: #ececec;
    text-shadow: 0 0 6px rgba(236,236,236,0.6), 0 0 20px rgba(236,236,236,0.3);
  `),
  // last — triggers settle (matches the Claude Orange plate it hands off to)
  () => apply(`
    font-family: 'Press Start 2P', 'Courier New', monospace;
    font-size: clamp(16px, 3.2vw, 30px);
    font-weight: 400;
    letter-spacing: 0.12em;
    color: #D97757;
    text-shadow: 0 0 12px rgba(217,119,87,0.5), 0 0 32px rgba(217,119,87,0.2);
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
        if (window.revealStars) window.revealStars();
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
