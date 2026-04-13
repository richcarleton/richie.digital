const nameEl = document.getElementById('name-text');
const nameplate = document.getElementById('nameplate');
const ORIG = 'RICHIE.DIGITAL';
const GLITCH_CHARS = '!@#$%^&*<>?/\\|[]{}~';

// -- text styles --
const styles = [
  () => {
    nameEl.style.cssText = `
      font-family: 'Roboto Condensed', sans-serif;
      font-size: clamp(18px, 8vw, 72px);
      font-weight: 900;
      letter-spacing: 0.18em;
      color: #00ffe7;
      text-shadow: 0 0 8px #00ffe7, 0 0 30px #00ffe799, 0 0 60px #00ffe744;
      transition: all 0.8s ease;
      display: inline-block;
      width: 100%;
      text-align: center;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: 'Roboto Condensed', sans-serif;
      font-size: clamp(18px, 8vw, 72px);
      font-weight: 900;
      letter-spacing: 0.22em;
      color: transparent;
      -webkit-text-stroke: 1.5px rgba(255,255,255,0.85);
      text-shadow: none;
      transition: all 0.8s ease;
      display: inline-block;
      width: 100%;
      text-align: center;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: 'Roboto Mono', monospace;
      font-size: clamp(18px, 7vw, 62px);
      font-weight: 400;
      letter-spacing: 0.08em;
      color: #ff2d78;
      text-shadow: 3px 0 0 #00ffe7, -3px 0 0 #ff2d78;
      transition: all 0.8s ease;
      display: inline-block;
      width: 100%;
      text-align: center;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: 'Roboto Condensed', sans-serif;
      font-size: clamp(18px, 8vw, 72px);
      font-weight: 100;
      letter-spacing: 0.35em;
      color: rgba(255,255,255,0.12);
      -webkit-text-stroke: 0.5px rgba(255,255,255,0.5);
      text-shadow: none;
      transition: all 0.8s ease;
      display: inline-block;
      width: 100%;
      text-align: center;
    `;
  },
  () => {
    nameEl.style.cssText = `
      font-family: 'Roboto Mono', monospace;
      font-size: clamp(18px, 7vw, 58px);
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #ffb800;
      text-shadow: 0 0 6px #ffb800aa, 0 0 20px #ffb80055;
      transition: all 0.8s ease;
      display: inline-block;
      width: 100%;
      text-align: center;
    `;
  },
  // last — ice outline — triggers collapse
  () => {
    nameEl.style.cssText = `
      font-family: 'Roboto Condensed', sans-serif;
      font-size: clamp(18px, 8vw, 72px);
      font-weight: 900;
      letter-spacing: 0.2em;
      font-style: italic;
      color: transparent;
      -webkit-text-stroke: 1px rgba(160, 220, 255, 0.9);
      text-shadow: 0 0 20px rgba(160,220,255,0.3);
      transition: all 0.8s ease;
      display: inline-block;
      width: 100%;
      text-align: center;
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
      nameEl.style.fontFamily = "'Roboto Mono', monospace";
      nameEl.style.color = 'rgba(255,255,255,0.35)';
      nameEl.style.webkitTextStroke = '0';
      nameEl.style.textShadow = 'none';
      nameEl.style.fontWeight = '400';
      nameEl.style.width = 'auto';
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

// breathing + hue sweep on nameplate
function startAtmosphere() {
  let t = 0;
  const el = nameplate;
  setInterval(() => {
    t += 0.02;
    // breath: opacity between 0.82 and 1.0
    const breath = 0.91 + Math.sin(t * 0.6) * 0.09;
    // hue sweep: very faint red-orange overlay using a pseudo via box-shadow trick
    const hue = 12 + Math.sin(t * 0.4) * 8; // 4 to 20deg range — red-orange
    const sat = 60 + Math.sin(t * 0.3) * 20;
    const sweepAlpha = 0.04 + Math.sin(t * 0.5) * 0.025; // 0.015 to 0.065 — barely there
    el.style.opacity = collapsed ? '0' : breath;
    if (!collapsed) {
      el.style.filter = `drop-shadow(0 0 40px hsla(${hue}, ${sat}%, 55%, ${sweepAlpha}))`;
    }
  }, 30);
}

styles[0]();
startAtmosphere();
setInterval(cycle, 2800);
setInterval(() => {
  if (!collapsed && !collapsing && Math.random() < 0.4) glitch();
}, 1800);

window.nameplate = { glitch, collapseToNav };
