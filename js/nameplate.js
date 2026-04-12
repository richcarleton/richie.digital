const nameEl = document.getElementById('name-text');
const nameplate = document.getElementById('nameplate');
const ORIG = 'RICHIE.DIGITAL';
const GLITCH_CHARS = '!@#$%^&*<>?/\\|[]{}~';

// -- text styles --
// add/remove/reorder freely. last one always triggers the collapse.
const styles = [
  () => {
    nameEl.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: clamp(32px, 6vw, 64px);
      font-weight: 700;
      letter-spacing: 0.18em;
      color: #00ffe7;
      text-shadow: 0 0 8px #00ffe7, 0 0 30px #00ffe799, 0 0 60px #00ffe744;
      transition: all 0.8s ease;
      display: inline-block;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: Impact, 'Arial Narrow', sans-serif;
      font-size: clamp(36px, 7vw, 72px);
      font-weight: 900;
      letter-spacing: 0.22em;
      color: transparent;
      -webkit-text-stroke: 1.5px rgba(255,255,255,0.85);
      text-shadow: none;
      transition: all 0.8s ease;
      display: inline-block;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: clamp(30px, 5.5vw, 58px);
      font-weight: 400;
      letter-spacing: 0.08em;
      color: #ff2d78;
      text-shadow: 3px 0 0 #00ffe7, -3px 0 0 #ff2d78;
      transition: all 0.8s ease;
      display: inline-block;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: 'Arial', sans-serif;
      font-size: clamp(34px, 6.5vw, 68px);
      font-weight: 100;
      letter-spacing: 0.35em;
      color: rgba(255,255,255,0.12);
      -webkit-text-stroke: 0.5px rgba(255,255,255,0.5);
      text-shadow: none;
      transition: all 0.8s ease;
      display: inline-block;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: clamp(28px, 5vw, 54px);
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #ffb800;
      text-shadow: 0 0 6px #ffb800aa, 0 0 20px #ffb80055;
      transition: all 0.8s ease;
      display: inline-block;
    `;
  },
  // last style - ice outline - triggers collapse
  () => {
    nameEl.style.cssText = `
      font-family: 'Georgia', serif;
      font-size: clamp(32px, 6vw, 62px);
      font-weight: 700;
      letter-spacing: 0.2em;
      font-style: italic;
      color: transparent;
      -webkit-text-stroke: 1px rgba(160, 220, 255, 0.9);
      text-shadow: 0 0 20px rgba(160,220,255,0.3);
      transition: all 0.8s ease;
      display: inline-block;
    `;
  }
];

let currentStyle = 0;
let glitching = false;
let collapsed = false;
let collapsing = false;

function glitch(cb) {
  if (glitching) { if (cb) cb(); return; }
  glitching = true;
  let i = 0;
  const iv = setInterval(() => {
    nameEl.textContent = ORIG.split('').map(c =>
      Math.random() < 0.3 ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : c
    ).join('');
    if (++i >= 10) {
      clearInterval(iv);
      nameEl.textContent = ORIG;
      glitching = false;
      if (cb) cb();
    }
  }, 50);
}

function collapseToNav() {
  if (collapsing || collapsed) return;
  collapsing = true;

  glitch(() => {
    styles[styles.length - 1]();

    setTimeout(() => {
      const slot = document.getElementById('menu-brand').getBoundingClientRect();
      const plate = nameplate.getBoundingClientRect();

      const dx = (slot.left + slot.width / 2) - (plate.left + plate.width / 2);
      const dy = (slot.top + slot.height / 2) - (plate.top + plate.height / 2);

      nameplate.style.transition = `transform 0.7s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease`;
      nameplate.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      nameEl.style.fontSize = '13px';
      nameEl.style.letterSpacing = '0.15em';
      nameEl.style.fontStyle = 'normal';
      nameEl.style.fontFamily = "'Courier New', monospace";
      nameEl.style.color = 'rgba(255,255,255,0.35)';
      nameEl.style.webkitTextStroke = '0';
      nameEl.style.textShadow = 'none';
      nameEl.style.fontWeight = '400';
      nameEl.textContent = 'richie.digital';

      setTimeout(() => {
        nameplate.style.opacity = '0';
        setTimeout(() => {
          nameplate.style.display = 'none';
          const brand = document.getElementById('menu-brand');
          brand.textContent = 'richie.digital';
          collapsing = false;
          collapsed = true;
        }, 400);
      }, 600);
    }, 400);
  });
}

function cycle() {
  if (collapsed || collapsing) return;
  const isLast = currentStyle === styles.length - 1;
  if (isLast) {
    glitch(() => { styles[currentStyle](); setTimeout(collapseToNav, 1200); });
    return;
  }
  currentStyle++;
  glitch(() => styles[currentStyle]());
}

// init
styles[0]();
setInterval(cycle, 2800);
setInterval(() => {
  if (!collapsed && !collapsing && Math.random() < 0.4) glitch();
}, 1800);

// expose for external use if needed
window.nameplate = { glitch, collapseToNav };
