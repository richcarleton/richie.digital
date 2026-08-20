// ── ricardo/js/game.js — Ricardo's Return core ───────────────────────────────
// Fixed-timestep, deterministic, Coleco-stiff: jump arcs are locked at takeoff.
// Physics in TILE units. Renders to a 336×192 offscreen buffer, then scales to
// the display canvas at integer multiples (DPR-aware, crisp).
(function () {
  'use strict';
  const S  = window.RicardoSchema;
  const SP = window.RicardoSprites;
  const T  = S.T, W = S.W, H = S.H, TP = S.TILE_PX;

  // ── tunables (devpanel writes these; defaults if panel absent) ──────────────
  window.EFFECT_RICARDO_GRAVITY ??= 38;    // tiles/s²
  window.EFFECT_RICARDO_SPEED   ??= 6;     // tiles/s
  window.EFFECT_RICARDO_JUMP    ??= 13.5;  // tiles/s takeoff
  window.EFFECT_RICARDO_SKULL   ??= 2.5;   // tiles/s
  window.EFFECT_RICARDO_SOUND   ??= true;
  window.EFFECT_RICARDO_CRT     ??= true;
  window.EFFECT_RICARDO_FALL    ??= 4.75;  // tiles of fall before death (was hardcoded 5.2)
  window.EFFECT_RICARDO_VINE    ??= 0.9;   // vine-grab magnet reach, tiles
  window.EFFECT_RICARDO_SHAKE   ??= 1;     // camera shake multiplier (0 = accessibility mode)
  window.EFFECT_RICARDO_MUSIC   ??= true;  // FM techno loop
  window.EFFECT_RICARDO_FILL    ??= true;  // fill screen (fractional scale) vs integer pixel-fit

  const CLIMB = 4.2;        // tiles/s on ladders/ropes
  const CONV  = 2.6;        // conveyor push, tiles/s
  const VANISH_PERIOD = 2.4, VANISH_DUTY = 0.62;
  const STEP = 1 / 120;     // simulation step, s
  const PW = 0.833, PH = 0.94; // player AABB in tiles (10px wide — Duke mode)

  // ── canvas setup ─────────────────────────────────────────────────────────────
  const buf = document.createElement('canvas');
  buf.width = W * TP; buf.height = H * TP;
  const bctx = buf.getContext('2d');
  const view = document.getElementById('game');
  const vctx = view.getContext('2d');

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const r = view.getBoundingClientRect();
    view.width  = Math.max(1, Math.round(r.width  * dpr));
    view.height = Math.max(1, Math.round(r.height * dpr));
    vctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // ── sound: tiny WebAudio square blips, unlocked on first input ──────────────
  let AC = null;
  function audio() {
    if (!window.EFFECT_RICARDO_SOUND) return null;
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function blip(freq, dur, type, vol) {
    const ac = audio(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.06, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  }
  // ── FM synthesis: two-op voice (tiny DX7 cosplay) + drum kit ────────────────
  let noiseBuf = null;
  function noise(ac) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2 | 0, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  // modulator → carrier.frequency; index sweeps down over dur = the classic bwow
  function fm(t0, freq, dur, ratio, index, vol, type) {
    const ac = audio(); if (!ac) return;
    t0 = t0 || ac.currentTime;
    const car = ac.createOscillator(), mod = ac.createOscillator(),
          mg = ac.createGain(), g = ac.createGain();
    car.type = type || 'sine'; mod.type = 'sine';
    car.frequency.value = freq;
    mod.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(Math.max(1, freq * index), t0);
    mg.gain.exponentialRampToValueAtTime(1, t0 + dur);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    car.connect(g).connect(ac.destination);
    mod.start(t0); car.start(t0);
    mod.stop(t0 + dur + 0.02); car.stop(t0 + dur + 0.02);
  }
  function kick(t0) {
    const ac = audio(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 0.12);
    g.gain.setValueAtTime(0.16, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.16);
  }
  function hat(t0) {
    const ac = audio(); if (!ac) return;
    const src = ac.createBufferSource(); src.buffer = noise(ac);
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    src.connect(f).connect(g).connect(ac.destination);
    src.start(t0); src.stop(t0 + 0.05);
  }

  // ── the loop: 142 BPM, A-minor acid line, straight outta a 1994 .XM pattern ─
  // Lookahead scheduler (rAF-driven, schedules ~150ms ahead on the audio clock).
  const MUS = { next: 0, step: 0 };
  const BASSLINE = [0, -1, 0, 12, 3, -1, 12, -1, 0, 0, -1, 12, 7, 15, 12, 10]; // -1 = rest
  function music() {
    const on = window.EFFECT_RICARDO_MUSIC && !G.paused &&
               (G.mode === 'play' || G.mode === 'flappy') && AC && AC.state === 'running';
    if (!on) { MUS.next = 0; return; }
    const SPB = 60 / 142 / 4; // one 16th
    if (!MUS.next || MUS.next < AC.currentTime - 0.2) { MUS.next = AC.currentTime + 0.06; MUS.step = 0; }
    while (MUS.next < AC.currentTime + 0.15) {
      const t0 = MUS.next, s = MUS.step % 16;
      if (s % 4 === 0) kick(t0);
      if (s % 4 === 2) hat(t0);
      const n = BASSLINE[s];
      if (n >= 0) fm(t0, 55 * Math.pow(2, n / 12), SPB * 1.7, 1, 6, 0.05, 'square');
      if (MUS.step % 64 === 48) // minor stab arp every 4 bars, because 1994
        [220, 261.63, 329.63, 440].forEach((f, i) => fm(t0 + i * SPB, f, 0.35, 3, 4, 0.035));
      MUS.step++; MUS.next += SPB;
    }
  }

  const sfx = {
    jump:     () => blip(240, 0.12),
    key:      () => { blip(660, 0.1); setTimeout(() => blip(880, 0.12), 90); },
    door:     () => blip(180, 0.2, 'sawtooth'),
    gem:      () => { blip(880, 0.08); setTimeout(() => blip(1175, 0.08), 70); setTimeout(() => blip(1568, 0.12), 140); },
    die:      () => blip(90, 0.5, 'sawtooth', 0.09),
    grab:     () => { blip(520, 0.06, 'triangle', 0.07); setTimeout(() => blip(390, 0.1, 'triangle', 0.05), 50); },
    scare:    () => fm(0, 660, 0.22, 2.01, 9, 0.06),   // inharmonic FM squeal
    flap:     () => fm(0, 280, 0.09, 0.5, 3, 0.05),    // soft FM whumpf
    poof:     () => {                                   // dusty lowpass noise burst
      const ac = audio(); if (!ac) return;
      const src = ac.createBufferSource(); src.buffer = noise(ac);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.14, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.28);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(); src.stop(ac.currentTime + 0.3);
    },
    step:     () => blip(140, 0.03, 'square', 0.02),
    win:      () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18), i * 130)),
  };

  // ── input ────────────────────────────────────────────────────────────────────
  const keys = { left: false, right: false, up: false, down: false, jump: false };
  let jumpQueued = false, anyInput = false;
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump',
  };
  window.addEventListener('keydown', e => {
    const k = KEYMAP[e.code]; if (!k) return;
    e.preventDefault();
    if (G.paused) return; // no queuing jumps from the pause screen
    if (k === 'jump' && !keys.jump) jumpQueued = true;
    keys[k] = true; anyInput = true; audio();
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  // meta keys: ESC pause · M music (while paused) · TAB boss key
  window.addEventListener('keydown', e => {
    if (e.code === 'Tab') { e.preventDefault(); toggleBoss(); return; }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (bossEl && bossEl.style.display !== 'none') { toggleBoss(); return; }
      if (G.mode === 'play' || G.mode === 'flappy') togglePause();
      return;
    }
    if (e.code === 'KeyM' && G.paused) {
      window.EFFECT_RICARDO_MUSIC = !window.EFFECT_RICARDO_MUSIC;
      const cb = document.getElementById('rd-music'); // keep devpanel + localStorage honest
      if (cb) { cb.checked = window.EFFECT_RICARDO_MUSIC; cb.dispatchEvent(new Event('change')); }
    }
  });

  function togglePause() {
    G.paused = !G.paused;
    if (G.paused) { for (const k in keys) keys[k] = false; jumpQueued = false; if (AC && AC.state === 'running') AC.suspend(); }
    else { if (AC && AC.state === 'suspended') AC.resume(); MUS.next = 0; }
  }

  // ── boss key: instant alien productivity ─────────────────────────────────────
  let bossEl = null;
  function toggleBoss() {
    if (!bossEl) { bossEl = buildBoss(); document.body.appendChild(bossEl); }
    const show = bossEl.style.display === 'none';
    bossEl.style.display = show ? 'block' : 'none';
    if (show) {
      if (!G.paused && (G.mode === 'play' || G.mode === 'flappy')) togglePause();
      else if (AC && AC.state === 'running') AC.suspend();
    }
    // on hide we STAY paused — assess the coast, then ESC to resume
  }
  function buildBoss() {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:9500;display:none;background:#050c05;' +
      'color:#7fff9f;font:13px/1.5 ui-monospace,monospace;cursor:default;user-select:none';
    const rows = [
      ['SECTOR', 'SPECIMENS', 'QUOTA', 'STATUS'],
      ['KEPLER-42B', '1,204', '1,000', '&#10003; AHEAD'],
      ['EARTH (SOL-3)', '47', '50', '&#9888; BEHIND'],
      ['TRAPPIST-1E', '88', '90', '&#9888; BEHIND'],
      ['VEGA PRIME', '3,506', '200', '&#10003;&#10003; PROMOTED'],
      ['MOON BASE ZETA', '0', '12', '&#10007; SEE HR'],
    ].map((r, i) => '<tr>' + r.map(c =>
      `<td style="border:1px solid #1d4d2a;padding:3px 14px;${i ? '' : 'background:#0d2413;font-weight:bold'}">${c}</td>`
    ).join('') + '</tr>').join('');
    d.innerHTML = `
      <div style="background:#0d2413;padding:4px 12px;display:flex;justify-content:space-between;border-bottom:1px solid #1d4d2a">
        <span>&#9651; ZORGON OS 9.4&nbsp;&nbsp;&nbsp;FILE&nbsp;&nbsp;EDIT&nbsp;&nbsp;PROBE&nbsp;&nbsp;HELP</span>
        <span id="boss-clock"></span>
      </div>
      <div style="position:absolute;left:24px;top:64px;line-height:2.4;opacity:.85">
        &#9673; SpecimenViewer<br>&#8889; FleetOps<br>&#9851; Recycle Nebula
      </div>
      <div style="position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);background:#08160b;border:1px solid #2a6b3a;box-shadow:0 0 40px #0f3;min-width:520px">
        <div style="background:#123920;padding:4px 10px;display:flex;justify-content:space-between">
          <span>XENOCEL&#8482; &mdash; Q3_ABDUCTION_QUOTAS.XLS</span><span>&#9472; &#9634; &#10005;</span>
        </div>
        <div style="padding:3px 10px;border-bottom:1px solid #1d4d2a;color:#4dcc70">
          fx&nbsp;&nbsp;=SUM(B2:B6)-PLAUSIBLE_DENIABILITY
        </div>
        <table style="border-collapse:collapse;margin:10px">${rows}</table>
        <div style="padding:4px 10px;color:#4dcc70;border-top:1px solid #1d4d2a">
          47 specimens processed &mdash; do not feed<span style="animation:none">_</span>
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:#0d2413;padding:4px 12px;display:flex;justify-content:space-between;border-top:1px solid #1d4d2a">
        <span style="background:#123920;padding:0 10px;border:1px solid #2a6b3a">&#8889; INVADE</span>
        <span>&#9602;&#9604;&#9606; mothership signal: OK &mdash; definitely spreadsheets happening here</span>
      </div>`;
    const tick = () => { const c = d.querySelector('#boss-clock'); if (c) c.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 10000);
    return d;
  }
  // losing focus mid-press (alt-tab, devtools, clicking away) means the keyup
  // never arrives — without this the player drifts in that direction forever.
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // touch.js calls this:
  window.RICARDO_INPUT = (name, down) => {
    if (G.paused && down) return;
    if (name === 'jump' && down && !keys.jump) jumpQueued = true;
    keys[name] = down; if (down) { anyInput = true; audio(); }
  };

  // ── pack loading ─────────────────────────────────────────────────────────────
  async function loadPack() {
    const q = new URLSearchParams(location.search);
    if (q.get('pack') === 'local') {
      const s = localStorage.getItem('ricardo.pack');
      if (s) { try { return S.parse(s); } catch (e) { console.warn('local pack invalid, falling back', e); } }
    }
    try {
      const r = await fetch('levels/pack.json', { cache: 'no-store' });
      if (r.ok) { const p = await r.json(); if (!S.validatePack(p).length) return p; }
    } catch (e) { /* file:// or offline — fine */ }
    return window.RICARDO_PACK;
  }

  // ── game state ───────────────────────────────────────────────────────────────
  const G = {
    pack: null, roomsById: {}, room: null,
    grid: null,               // mutable copy: doors removed, pickups cleared
    skulls: [],
    player: null,
    keysHeld: [],             // e.g. ['B','R']
    score: 0, lives: 3,
    mode: 'title',            // title | play | dying | gameover | win
    modeT: 0, time: 0,
    entry: null,              // respawn point for current room
    roomFlash: 0,
    shake: 0,                 // camera shake magnitude, decays in the step loop
    ghosts: [],               // airborne afterimages
    paused: false,
    fl: null,                 // flappy-mode state (OPEN SKY)
  };

  function addShake(m) { G.shake = Math.min(8, Math.max(G.shake, m)); }

  function roomState(id) {
    // per-room persistent mutations (opened doors, taken pickups, dead-forever? no — skulls respawn)
    if (!G.mut) G.mut = {};
    if (!G.mut[id]) G.mut[id] = { cleared: {} }; // "y,x" -> true for removed tiles
    return G.mut[id];
  }

  // carry = { fall, vy } — momentum through a down exit. Pits remember.
  // A negative carry.fall (respawn grace) forgives the first landing.
  function enterRoom(id, px, py, carry) {
    const room = G.roomsById[id];
    if (!room) return;
    G.room = room;
    const mut = roomState(id);
    G.grid = room.grid.map(r => r.split(''));
    G.skulls = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (mut.cleared[y + ',' + x]) { G.grid[y][x] = T.EMPTY; continue; }
      const ch = G.grid[y][x];
      if (ch === T.SKULL) { G.grid[y][x] = T.EMPTY; G.skulls.push({ x, y, dir: 1, fx: x, state: 'walk', t: 0 }); }
      if (ch === T.SPAWN) { G.grid[y][x] = T.EMPTY; if (px == null) { px = x + 0.17; py = y + 0.03; } }
    }
    G.player = {
      x: px, y: py, vx: 0, vy: carry ? (carry.vy || 0) : 0,
      grounded: false, climbing: false, airVX: 0, slideV: 0,
      fallPeak: py - (carry ? carry.fall : 0), face: 1, anim: 0,
    };
    // sky arrivals land wherever there's room; entry is recorded after the
    // correction so dying here doesn't respawn you back inside the roof
    if (carry && carry.dropIn) {
      unstick(G.player);
      G.player.fallPeak = G.player.y - carry.fall;
    }
    G.entry = { x: G.player.x, y: G.player.y };
    G.roomFlash = 0.5;
    // rooms flagged flappy have no floor, no walls, no rules — only sky
    if (room.flappy && (G.mode === 'play' || G.mode === 'title')) {
      G.mode = 'flappy';
      const clouds = [];
      for (let i = 0; i < 10; i++) clouds.push({
        x: Math.random() * (W + 8) - 4, y: 1 + Math.random() * (H - 4),
        s: 1 + Math.random(), sp: 5 + Math.random() * 6,
      });
      // flocks cross the middle distance — slower than the clouds they pass
      const birds = [];
      for (let i = 0; i < 3; i++) birds.push({
        x: Math.random() * (W + 20), y: 2 + Math.random() * 5,
        sp: 3 + Math.random() * 2, ph: Math.random() * 6.28, n: 3 + (Math.random() * 3 | 0),
      });
      G.fl = {
        y: 4, vy: 0, dist: 0, hintT: 3, gt: 0, clouds, puffs: [], flapPulse: 0, arriveT: 0,
        birds, shoots: [], shootT: 1 + Math.random() * 3, wisps: [],
      };
    }
  }

  function clearTile(x, y) {
    G.grid[y][x] = T.EMPTY;
    roomState(G.room.id).cleared[y + ',' + x] = true;
  }

  // ── collision helpers ────────────────────────────────────────────────────────
  const vanishOn = () => (G.time % VANISH_PERIOD) < VANISH_PERIOD * VANISH_DUTY;
  function tileAt(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return T.EMPTY; // edges open for transitions
    return G.grid[y][x];
  }
  function solid(x, y, forPlayer) {
    const ch = tileAt(x, y);
    if (S.isStaticSolid(ch)) return true;
    if (ch === T.VANISH) return vanishOn();
    if (S.isDoor(ch)) {
      if (forPlayer && G.keysHeld.includes(S.KEY_FOR_DOOR[ch])) {
        // unlock on contact — consume one key, dissolve both door tiles in column
        const need = S.KEY_FOR_DOOR[ch];
        G.keysHeld.splice(G.keysHeld.indexOf(need), 1);
        for (let yy = 0; yy < H; yy++) if (G.grid[yy][x] === ch) clearTile(x, yy);
        sfx.door();
        return false;
      }
      return true;
    }
    return false;
  }
  // ladder top: standable from above when falling and not pressing down
  function ladderTopSolid(x, y, p) {
    return tileAt(x, y) === T.LADDER && tileAt(x, y - 1) !== T.LADDER &&
           p.vy >= 0 && !keys.down && (p.y + PH) <= y + 0.35;
  }

  function rectSolid(x, y, w, h, p) {
    const x0 = Math.floor(x), x1 = Math.floor(x + w - 1e-9);
    const y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-9);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
      if (solid(tx, ty, !!p)) return true;
    return false;
  }

  // Arriving by air, not through a door: the destination room has a real roof
  // and the requested spot may be inside it. Nudge down to the first gap that
  // fits, then sideways if the whole column is masonry. Never passes `p` to
  // rectSolid — this runs before the player has agency, so doors must stay shut
  // rather than silently eating a key.
  function unstick(p) {
    for (let dy = 0; dy < H; dy += 0.25) {
      if (!rectSolid(p.x, p.y + dy, PW, PH)) { p.y += dy; return true; }
    }
    for (let dx = 1; dx < W; dx++) {                 // ceiling's solid all the way down
      for (const sx of [p.x + dx, p.x - dx]) {
        if (sx < 0 || sx + PW > W) continue;
        for (let dy = 0; dy < H; dy += 0.25) {
          if (!rectSolid(sx, p.y + dy, PW, PH)) { p.x = sx; p.y += dy; return true; }
        }
      }
    }
    return false;
  }

  // ── player sim ───────────────────────────────────────────────────────────────
  function simPlayer(dt) {
    const p = G.player;
    const SPEED = window.EFFECT_RICARDO_SPEED, GRAV = window.EFFECT_RICARDO_GRAVITY,
          JUMP = window.EFFECT_RICARDO_JUMP;
    const cx = Math.floor(p.x + PW / 2), cy = Math.floor(p.y + PH / 2);
    const onClimbable = tileAt(cx, cy) === T.LADDER || tileAt(cx, cy) === T.ROPE ||
                        tileAt(cx, Math.floor(p.y + PH - 0.1)) === T.LADDER;

    // enter climb
    if (!p.climbing && onClimbable && (keys.up || (keys.down && !p.grounded)) ) {
      p.climbing = true; p.vx = 0; p.vy = 0; p.airVX = 0; p.slideV = 0;
      p.x = cx + 0.5 - PW / 2; // snap to rail
    }

    // VINE CATCH: falling + holding ▲ = grab a passing rope, even off-center.
    // Magnet reach is tunable (EFFECT_RICARDO_VINE). Resets fall distance —
    // this is the one mercy the pyramid offers. You slide a bit first (physics
    // is a suggestion, friction is a negotiation).
    if (!p.climbing && !p.grounded && p.vy > 2 && keys.up) {
      const reach = window.EFFECT_RICARDO_VINE;
      const pcx = p.x + PW / 2;
      const ty0 = Math.floor(p.y + 0.2), ty1 = Math.floor(p.y + PH * 0.7);
      outer:
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = Math.floor(pcx - reach); tx <= Math.floor(pcx + reach); tx++) {
          if (tileAt(tx, ty) === T.ROPE && Math.abs(tx + 0.5 - pcx) <= reach) {
            p.climbing = true;
            p.slideV = Math.min(p.vy * 0.55, 9); // burn off momentum down the vine
            p.vx = 0; p.airVX = 0;
            p.x = tx + 0.5 - PW / 2;
            p.fallPeak = p.y;
            sfx.grab();
            break outer;
          }
        }
      }
    }

    if (p.climbing) {
      if (!onClimbable) { p.climbing = false; }
      else {
        p.vy = (keys.up ? -CLIMB : 0) + (keys.down ? CLIMB : 0) + p.slideV;
        if (p.slideV > 0) p.slideV = Math.max(0, p.slideV - 32 * dt);
        p.vx = 0;
        if (jumpQueued) { p.climbing = false; p.vy = -JUMP * 0.6; p.airVX = (keys.left ? -1 : keys.right ? 1 : 0) * SPEED; sfx.jump(); }
        jumpQueued = false;
        // vertical move w/ collision
        let ny = p.y + p.vy * dt;
        if (p.vy < 0 && rectSolid(p.x, ny, PW, PH, p)) ny = p.y;
        if (p.vy > 0 && rectSolid(p.x, ny, PW, PH, p)) { ny = p.y; p.climbing = false; p.grounded = true; p.vy = 0; }
        p.y = ny;
        p.fallPeak = p.y;
        p.anim += Math.abs(p.vy) * dt;
        collectAndHazards(p);
        return;
      }
    }

    // grounded check (feet probe) — span the full foot width so it agrees
    // with rectSolid's fall-collision check; narrow point-probes can both
    // land past a ledge's edge while the AABB still overlaps it, causing
    // grounded to flip false/true within the same frame and soft-lock the player.
    const feetY = p.y + PH + 0.02;
    const fx0 = Math.floor(p.x + 1e-3), fx1 = Math.floor(p.x + PW - 1e-3);
    let g0 = ladderTopSolid(Math.floor(p.x + PW / 2), Math.floor(feetY), p);
    for (let fx = fx0; fx <= fx1 && !g0; fx++) g0 = solid(fx, Math.floor(feetY), p);
    p.grounded = g0 && p.vy >= 0;

    // conveyor push
    let push = 0;
    if (p.grounded) {
      const under = tileAt(Math.floor(p.x + PW / 2), Math.floor(feetY));
      if (under === T.CONV_L) push = -CONV;
      if (under === T.CONV_R) push =  CONV;
    }

    // horizontal: full control grounded; arc locked in air (Coleco charm)
    if (p.grounded) {
      p.vx = (keys.left ? -SPEED : 0) + (keys.right ? SPEED : 0) + push;
      if (keys.left) p.face = -1; if (keys.right) p.face = 1;
      if (jumpQueued) {
        p.vy = -JUMP; p.grounded = false;
        p.airVX = (keys.left ? -SPEED : 0) + (keys.right ? SPEED : 0);
        p.fallPeak = p.y; sfx.jump();
      }
    } else {
      p.vx = p.airVX;
    }
    jumpQueued = false;

    // integrate
    if (!p.grounded) p.vy = Math.min(p.vy + GRAV * dt, 30);
    else p.vy = Math.min(p.vy, 0);

    // X move + resolve
    let nx = p.x + p.vx * dt;
    if (p.vx !== 0 && rectSolid(nx, p.y, PW, PH, p)) {
      nx = p.vx > 0 ? Math.floor(nx + PW) - PW - 0.001 : Math.floor(nx) + 1.001;
      if (rectSolid(nx, p.y, PW, PH, p)) nx = p.x;
      p.airVX = 0;
    }
    p.x = nx;

    // Y move + resolve (including ladder tops)
    let ny = p.y + p.vy * dt;
    if (p.vy > 0) {
      const fy = Math.floor(ny + PH);
      const hit = rectSolid(p.x, ny, PW, PH, p) ||
                  ladderTopSolid(Math.floor(p.x + PW / 2), fy, p);
      if (hit) {
        ny = fy - PH;
        // fall damage (tunable; distance may include the room above — see exits)
        const fd = ny - p.fallPeak;
        if (fd > window.EFFECT_RICARDO_FALL) { kill(); return; }
        if (fd > 2) addShake(Math.min(4, fd)); // survived, but the camera felt it
        p.vy = 0; p.grounded = true; p.airVX = 0;
      }
    } else if (p.vy < 0 && rectSolid(p.x, ny, PW, PH, p)) {
      ny = Math.floor(ny) + 1.001; p.vy = 0;
    }
    p.y = ny;
    if (p.vy < 0 || p.grounded) p.fallPeak = Math.min(p.fallPeak, p.y);
    if (p.grounded) p.fallPeak = p.y;

    if (p.grounded && Math.abs(p.vx) > 0.1) { p.anim += Math.abs(p.vx) * dt; if ((p.anim | 0) % 2 === 0 && Math.random() < 0.02) sfx.step(); }

    // afterimage trail while airborne (cyan/magenta, very legal, very cool)
    if (!p.grounded) {
      p.ghostT = (p.ghostT || 0) + dt;
      if (p.ghostT > 0.035) {
        p.ghostT = 0;
        G.ghosts.push({ x: p.x, y: p.y, life: 0.3, c: (G.ghosts.length % 2) ? '#0ac8e8' : '#e80a78' });
        if (G.ghosts.length > 14) G.ghosts.shift();
      }
    }

    // room transitions at edges
    const ex = G.room.exits || {};
    if (p.x + PW < 0.05 && ex.left)   return enterRoom(ex.left,  W - PW - 0.1, p.y);
    if (p.x > W - 0.05 && ex.right)   return enterRoom(ex.right, 0.1, p.y);
    // down exits carry fall distance AND velocity — the pit in the next screen
    // still counts everything since your last solid ground. Catch a vine.
    if (p.y > H && ex.down)           return enterRoom(ex.down,  p.x, 0.1,
                                        { fall: p.y - p.fallPeak, vy: p.vy });
    if (p.y + PH < 0 && ex.up)        return enterRoom(ex.up,    p.x, H - PH - 0.1);
    // fell out of world with no exit
    if (p.y > H + 2) { kill(); return; }
    p.x = Math.max(-PW + 0.02, Math.min(W - 0.02, p.x));

    collectAndHazards(p);
  }

  function collectAndHazards(p) {
    const x0 = Math.floor(p.x), x1 = Math.floor(p.x + PW - 1e-9);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + PH - 1e-9);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(tx, ty);
      if (S.isKey(ch))       { G.keysHeld.push(ch); G.score += 50;  clearTile(tx, ty); sfx.key(); }
      else if (ch === T.TREASURE) { G.score += 100; clearTile(tx, ty); sfx.gem(); }
      else if (ch === T.EXIT)     { G.mode = 'win'; G.modeT = 0; sfx.win(); addShake(3); }
    }
    // skulls (only ambulatory ones bite; scared/charred/ash are busy dying)
    for (const sk of G.skulls) {
      if (sk.state !== 'walk') continue;
      if (p.x < sk.fx + 0.85 && p.x + PW > sk.fx + 0.15 &&
          p.y < sk.y + 0.9  && p.y + PH > sk.y + 0.25) { kill(); return; }
    }
  }

  function kill() {
    if (G.mode !== 'play') return;
    G.mode = 'dying'; G.modeT = 0; sfx.die(); addShake(5);
  }

  function simSkulls(dt) {
    const sp = window.EFFECT_RICARDO_SKULL;
    const p = G.player;
    for (const sk of G.skulls) {
      // scare chain: ! → red panic → charred → ash pile → gone
      if (sk.state === 'scared') { sk.t += dt; if (sk.t > 0.75) { sk.state = 'black'; sk.t = 0; } continue; }
      if (sk.state === 'black')  { sk.t += dt; if (sk.t > 0.35) { sk.state = 'ash';   sk.t = 0; sfx.poof(); addShake(2.5); G.score += 25; } continue; }
      if (sk.state === 'ash')    { sk.t += dt; if (sk.t > 1.4) sk.dead = true; continue; }
      // jumped over?! skulls have exactly one fear and it is airborne cat
      if (p && !p.grounded && !p.climbing &&
          p.y + PH <= sk.y + 0.35 &&
          p.x < sk.fx + 1 && p.x + PW > sk.fx) {
        sk.state = 'scared'; sk.t = 0; sfx.scare(); addShake(1.5);
        continue;
      }
      const nfx = sk.fx + sk.dir * sp * dt;
      const aheadX = Math.floor(nfx + (sk.dir > 0 ? 0.9 : 0.1));
      const wallAhead = solid(aheadX, sk.y, false);
      const floorAhead = solid(aheadX, sk.y + 1, false) || tileAt(aheadX, sk.y + 1) === T.LADDER;
      if (wallAhead || !floorAhead) sk.dir *= -1;
      else sk.fx = nfx;
    }
    if (G.skulls.some(s => s.dead)) G.skulls = G.skulls.filter(s => !s.dead);
  }

  // ── OPEN SKY: the next screen was never built, so gravity improvises ────────
  // No pipes, no death — just clouds. Flap across, land on CLOUD NINE.
  function simFlappy(dt) {
    const F = G.fl;
    if (F.arriveT > 0) { // touchdown beat — freeze flight, let the celebration play
      jumpQueued = false;
      F.arriveT -= dt;
      if (F.arriveT <= 0) {
        G.mode = 'play'; G.fl = null; G.ghosts = [];
        // 1.05 mirrors the flappy ceiling — just under the HUD bar. dropIn lets
        // enterRoom push him clear if the landing room's roof is solid there.
        enterRoom((G.room.exits && G.room.exits.right) || G.pack.start, 2, 1.05,
                  { fall: -99, dropIn: true });
      }
      return;
    }
    if (jumpQueued) {
      jumpQueued = false; F.vy = -7.5; sfx.flap(); F.flapPulse = 1; addShake(1);
      for (let i = 0; i < 6; i++) { // downward puff burst — the wing-beat you can feel
        const a = Math.PI * (0.15 + Math.random() * 0.7);
        const sp = 3 + Math.random() * 3;
        F.puffs.push({ x: 7.5, y: F.y + 1, vx: -Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, s: 1 + Math.random() });
      }
    }
    F.flapPulse = Math.max(0, F.flapPulse - dt * 4);
    F.vy = Math.min(F.vy + 20 * dt, 12);
    F.y += F.vy * dt;
    // ceiling sits just below the HUD bar (1 tile) so the sprite never clips under it
    if (F.y < 1.05)    { F.y = 1.05;    F.vy = Math.max(F.vy, 0); }
    if (F.y > H - 2.2) { F.y = H - 2.2; F.vy = Math.min(F.vy, 0); } // bouncy cloud floor
    F.dist += 9 * dt;
    F.hintT -= dt;
    for (const c of F.clouds) {
      c.x -= c.sp * dt;
      if (c.x < -8) { c.x = W + 4 + Math.random() * 6; c.y = 1 + Math.random() * (H - 4); }
    }
    // migrating flocks, bobbing as they go
    for (const b of F.birds) {
      b.x -= b.sp * dt; b.ph += dt * 7;
      if (b.x < -6) { b.x = W + 6 + Math.random() * 14; b.y = 2 + Math.random() * 5; }
    }
    // meteors streak the upper dusk band now and then
    F.shootT -= dt;
    if (F.shootT <= 0) {
      F.shootT = 2 + Math.random() * 4;
      F.shoots.push({ x: W * (0.4 + Math.random() * 0.7), y: -1 + Math.random() * 3, life: 1 });
    }
    for (const s of F.shoots) { s.x -= 34 * dt; s.y += 15 * dt; s.life -= dt * 1.4; }
    F.shoots = F.shoots.filter(s => s.life > 0);
    // near-field wisps rip past the camera — the fastest layer, sells the speed
    if (Math.random() < dt * 5) F.wisps.push({
      x: W + 2, y: Math.random() * H, len: 1.2 + Math.random() * 2, sp: 26 + Math.random() * 16,
    });
    for (const w of F.wisps) w.x -= w.sp * dt;
    F.wisps = F.wisps.filter(w => w.x > -8);
    for (const pf of F.puffs) { pf.x += pf.vx * dt; pf.y += pf.vy * dt; pf.life -= dt; }
    F.puffs = F.puffs.filter(pf => pf.life > 0);
    // afterimages drift behind (the sky scrolls; the ghosts remember)
    F.gt += dt;
    if (F.gt > 0.05) {
      F.gt = 0;
      G.ghosts.push({ x: 7, y: F.y, life: 0.3, c: (G.ghosts.length % 2) ? '#0ac8e8' : '#e80a78' });
      if (G.ghosts.length > 14) G.ghosts.shift();
    }
    for (const gh of G.ghosts) gh.x -= 9 * dt;
    if (F.dist >= 130) { // made it across — freeze the number and take a bow
      F.dist = 130; F.arriveT = 0.9; sfx.win(); addShake(3);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────
  function starDot(x, y) { return ((x * 73856093) ^ (y * 19349663)) % 97 === 0; }

  function render() {
    const ctx = bctx;
    ctx.fillStyle = SP.PAL['1'];
    ctx.fillRect(0, 0, buf.width, buf.height);
    // faint deterministic stars
    ctx.fillStyle = 'rgba(232,232,240,0.25)';
    for (let y = 0; y < buf.height; y += 3) for (let x = 0; x < buf.width; x += 3)
      if (starDot(x, y)) ctx.fillRect(x, y, 1, 1);

    if (G.mode === 'title') { renderTitle(ctx); blit(); return; }
    if (G.mode === 'flappy') {
      renderFlappy(ctx);
      if (G.paused) renderPause(ctx);
      blit(); return;
    }

    const von = vanishOn();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = G.grid[y][x];
      if (ch !== T.EMPTY) SP.drawTile(ctx, ch, x, y, G.time, { vanishOn: von });
    }

    // afterimage ghosts (under everything else)
    for (const gh of G.ghosts) {
      ctx.globalAlpha = Math.max(0, gh.life / 0.3) * 0.35;
      SP.drawBitmapMono(ctx, SP.CAT_JUMP, Math.round(gh.x * TP), Math.round(gh.y * TP), gh.c);
    }
    ctx.globalAlpha = 1;

    // skulls
    for (const sk of G.skulls) {
      const sx = Math.round(sk.fx * TP + 2), sy = Math.round(sk.y * TP + 3);
      if (sk.state === 'ash') {                       // dearly departed
        ctx.globalAlpha = Math.max(0.15, 1 - sk.t / 1.4);
        SP.drawBitmap(ctx, SP.ASH, sx, sk.y * TP + 8);
        ctx.globalAlpha = 1;
      } else if (sk.state === 'black') {              // charred
        SP.drawBitmapMono(ctx, SP.SKULL, sx, sy, '#1a1420');
      } else if (sk.state === 'scared') {             // shiver + red panic + !
        const jit = Math.round(Math.sin(G.time * 70) * 1.4);
        SP.drawBitmapMono(ctx, SP.SKULL, sx + jit, sy,
          ((G.time * 14 | 0) % 2) ? '#e82a0a' : '#e8e8f0');
        SP.drawBitmap(ctx, SP.EXCLAIM, sx + 3, sk.y * TP - 6);
      } else {                                        // business as usual
        const bob = Math.sin(G.time * 6 + sk.fx) * 0.7;
        SP.drawBitmap(ctx, SP.SKULL, sx, Math.round(sk.y * TP + 3 + bob));
      }
    }

    // player
    const p = G.player;
    if (G.mode !== 'dying' || (G.modeT * 10 | 0) % 2 === 0) {
      let bmp = SP.CAT_STAND;
      if (p.climbing) bmp = ((p.anim * 2 | 0) % 2) ? SP.CAT_CLIMB : SP.CAT_STAND;
      else if (!p.grounded) bmp = SP.CAT_JUMP;
      else if (Math.abs(p.vx) > 0.1) bmp = ((p.anim | 0) % 2) ? SP.CAT_WALK : SP.CAT_STAND;
      const px = Math.round(p.x * TP), py = Math.round(p.y * TP); // 10px sprite = AABB
      if (p.face < 0) {
        ctx.save(); ctx.translate(px + 10, py); ctx.scale(-1, 1);
        SP.drawBitmap(ctx, bmp, 0, 0); ctx.restore();
      } else SP.drawBitmap(ctx, bmp, px, py);
    }

    // HUD over the top wall row
    ctx.fillStyle = 'rgba(8,11,20,0.55)';
    ctx.fillRect(0, 0, buf.width, TP);
    ctx.font = '8px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = SP.PAL['5'];
    ctx.fillText('SCORE ' + String(G.score).padStart(5, '0'), 4, TP / 2 + 1);
    ctx.fillStyle = SP.PAL['2'];
    for (let i = 0; i < G.lives; i++) ctx.fillText('ᐱ', 90 + i * 9, TP / 2 + 1);
    G.keysHeld.forEach((k, i) => SP.drawBitmap(ctx, SP.KEY, 130 + i * 10, 2, SP.TINT[k]));
    ctx.fillStyle = SP.PAL['4'];
    const nm = G.room.name || G.room.id;
    ctx.fillText(nm, buf.width - 4 - ctx.measureText(nm).width, TP / 2 + 1);

    if (G.roomFlash > 0) {
      ctx.fillStyle = 'rgba(138,10,232,' + (G.roomFlash * 0.25) + ')';
      ctx.fillRect(0, 0, buf.width, buf.height);
    }

    if (G.mode === 'gameover') centerText(ctx, 'GAME OVER', 'SCORE ' + G.score + ' — TAP / SPACE TO RETRY');
    if (G.mode === 'win')      centerText(ctx, 'PYRAMID CLEARED', 'SCORE ' + G.score + ' — RICARDO RETURNS. TAP TO REPLAY');
    if (G.paused) renderPause(ctx);
    blit();
  }

  function renderPause(ctx) {
    ctx.fillStyle = 'rgba(8,11,20,0.78)'; ctx.fillRect(0, 0, buf.width, buf.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = SP.PAL['5']; ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.fillText('PAUSED', buf.width / 2, 74);
    ctx.fillStyle = SP.PAL['7']; ctx.font = '8px ui-monospace, monospace';
    ctx.fillText('ESC — RESUME', buf.width / 2, 96);
    ctx.fillText('M — MUSIC: ' + (window.EFFECT_RICARDO_MUSIC ? 'ON' : 'OFF'), buf.width / 2, 108);
    ctx.fillText('TAB — LOOK BUSY', buf.width / 2, 120);
    ctx.textAlign = 'left';
  }

  function drawCloud(ctx, x, y, s) {
    ctx.fillStyle = SP.PAL['7']; ctx.globalAlpha = 0.7;
    ctx.fillRect(x + 3 * s, y, 8 * s, 2 * s);
    ctx.fillRect(x, y + 2 * s, 14 * s, 3 * s);
    ctx.fillStyle = SP.PAL['2']; ctx.globalAlpha = 0.3;   // cosmic underglow
    ctx.fillRect(x + 2 * s, y + 5 * s, 11 * s, 2 * s);
    ctx.globalAlpha = 1;
  }

  // A pyramid skyline that never repeats visibly: peak heights are hashed off
  // the peak index, so scrolling is deterministic and costs no state.
  function drawRidge(ctx, scroll, baseY, h, color, period) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, buf.height);
    for (let x = 0; x <= buf.width; x += 2) {
      const t = (x + scroll) / period;
      const tri = 1 - Math.abs((t % 1) - 0.5) * 2;        // 0 at valley, 1 at peak
      const hash = ((Math.floor(t) * 73856093) >>> 0) % 97 / 97;
      ctx.lineTo(x, baseY - h * (0.5 + hash * 0.5) * tri);
    }
    ctx.lineTo(buf.width, buf.height);
    ctx.closePath();
    ctx.fill();
  }

  function drawBird(ctx, x, y, ph) {
    const w = Math.cos(ph) * 2;                            // wingbeat
    ctx.fillRect(x - 2, y - w, 2, 1);
    ctx.fillRect(x + 1, y - w, 2, 1);
    ctx.fillRect(x, y, 1, 1);
  }

  function renderFlappy(ctx) {
    const F = G.fl;
    // dusk gradient sky — indigo up top, warm synthwave glow at the horizon
    const grad = ctx.createLinearGradient(0, 0, 0, buf.height);
    grad.addColorStop(0,    '#0a0c1c');
    grad.addColorStop(0.55, '#1a1440');
    grad.addColorStop(1,    '#3a1450');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, buf.width, buf.height);
    // faint stars, only in the upper dusk band
    ctx.fillStyle = 'rgba(232,232,240,0.22)';
    for (let y = 0; y < buf.height * 0.55; y += 3) for (let x = 0; x < buf.width; x += 3)
      if (starDot(x, y)) ctx.fillRect(x, y, 1, 1);
    // distant sun, drifting slow with distance travelled (parallax)
    let sunX = (buf.width * 1.15 - F.dist * 1.1) % (buf.width + 90);
    if (sunX < -45) sunX += buf.width + 90;
    ctx.fillStyle = 'rgba(232,144,10,0.16)';
    ctx.beginPath(); ctx.arc(sunX, 36, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SP.PAL['5'];
    ctx.beginPath(); ctx.arc(sunX, 36, 13, 0, Math.PI * 2); ctx.fill();
    // meteors in the dusk band, drawn over the sun's glow but behind the ridge
    for (const s of F.shoots) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life)) * 0.8;
      ctx.fillStyle = SP.PAL['7'];
      const sx = s.x * TP, sy = s.y * TP;
      for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(sx + i * 3), Math.round(sy - i * 1.4), 2, 1);
    }
    ctx.globalAlpha = 1;
    // two pyramid ridgelines — the horizon Ricardo is flying away from
    drawRidge(ctx, F.dist * 2.2, buf.height * 0.88, 34, 'rgba(58,20,80,0.85)', 70);
    drawRidge(ctx, F.dist * 4.5, buf.height * 0.96, 24, 'rgba(26,8,42,0.95)', 46);
    // far clouds first (slow = far, painter's algorithm on a budget)
    const sorted = F.clouds.slice().sort((a, b) => a.sp - b.sp);
    for (const c of sorted) drawCloud(ctx, Math.round(c.x * TP - 14), Math.round(c.y * TP), c.s);
    // flocks, above the cloud deck
    ctx.fillStyle = 'rgba(232,232,240,0.5)';
    for (const b of F.birds)
      for (let i = 0; i < b.n; i++)
        drawBird(ctx, Math.round((b.x + i * 1.1) * TP), Math.round(b.y * TP + i * 3), b.ph - i * 0.5);
    // ghosts
    for (const gh of G.ghosts) {
      ctx.globalAlpha = Math.max(0, gh.life / 0.3) * 0.35;
      SP.drawBitmapMono(ctx, SP.CAT_JUMP, Math.round(gh.x * TP), Math.round(gh.y * TP), gh.c);
    }
    ctx.globalAlpha = 1;
    // wing-beat puffs, behind the cat
    for (const pf of F.puffs) {
      ctx.globalAlpha = Math.max(0, pf.life / 0.4) * 0.6;
      ctx.fillStyle = SP.PAL['7'];
      const s = pf.s * 2;
      ctx.fillRect(Math.round(pf.x * TP - s / 2), Math.round(pf.y * TP - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
    // Ricardo, tilting with vertical velocity like he read the flappy spec,
    // with a squash-stretch pop on every flap
    ctx.save();
    ctx.translate(7 * TP + 5, F.y * TP + 6);
    ctx.rotate(Math.max(-0.45, Math.min(0.6, F.vy * 0.07)));
    const pop = F.flapPulse * 0.22;
    ctx.scale(1 - pop, 1 + pop);
    SP.drawBitmap(ctx, SP.CAT_JUMP, -5, -6);
    ctx.restore();
    // near-field wisps, in front of everything — closest layer, fastest parallax
    ctx.fillStyle = 'rgba(232,232,240,0.20)';
    for (const w of F.wisps)
      ctx.fillRect(Math.round(w.x * TP), Math.round(w.y * TP), Math.round(w.len * TP), 1);
    // HUD
    ctx.fillStyle = 'rgba(8,11,20,0.55)'; ctx.fillRect(0, 0, buf.width, TP);
    ctx.font = '8px ui-monospace, monospace'; ctx.textBaseline = 'middle';
    const pct = Math.min(100, F.dist / 130 * 100 | 0);
    ctx.fillStyle = SP.PAL['4'];
    ctx.fillText('OPEN SKY — ' + pct + '%', 4, TP / 2 + 1);
    // progress bar, right-aligned in the HUD strip
    const barW = 80, barX = buf.width - barW - 4, barY = TP / 2 - 2;
    ctx.fillStyle = 'rgba(232,232,240,0.25)'; ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle = SP.PAL['6']; ctx.fillRect(barX, barY, barW * pct / 100, 4);
    if (F.hintT > 0 && (G.time * 2 | 0) % 2 === 0) {
      ctx.textAlign = 'center'; ctx.fillStyle = SP.PAL['5'];
      ctx.fillText('TAP / SPACE = FLAP', buf.width / 2, 60);
      ctx.textAlign = 'left';
    }
    if (F.arriveT > 0) centerText(ctx, 'CLOUD NINE!', 'made it across');
  }

  function centerText(ctx, big, small) {
    ctx.fillStyle = 'rgba(8,11,20,0.75)'; ctx.fillRect(0, 60, buf.width, 60);
    ctx.textAlign = 'center';
    ctx.fillStyle = SP.PAL['3']; ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.fillText(big, buf.width / 2, 82);
    ctx.fillStyle = SP.PAL['7']; ctx.font = '8px ui-monospace, monospace';
    ctx.fillText(small, buf.width / 2, 100);
    ctx.textAlign = 'left';
  }

  function renderTitle(ctx) {
    ctx.textAlign = 'center';
    ctx.fillStyle = SP.PAL['2']; ctx.font = 'bold 20px ui-monospace, monospace';
    ctx.fillText("RICARDO'S RETURN", buf.width / 2, 70);
    ctx.fillStyle = SP.PAL['3']; ctx.font = '8px ui-monospace, monospace';
    ctx.fillText('the pyramid is all outta catnip', buf.width / 2, 88);
    const big = 3;
    ctx.save(); ctx.translate(buf.width / 2 - 15, 100); ctx.scale(big, big);
    SP.drawBitmap(ctx, SP.CAT_STAND, 0, 0); ctx.restore();
    if ((G.time * 2 | 0) % 2 === 0) {
      ctx.fillStyle = SP.PAL['5'];
      ctx.fillText('TAP / SPACE TO START', buf.width / 2, 160);
    }
    ctx.fillStyle = SP.PAL['4']; ctx.globalAlpha = 0.7;
    ctx.fillText('ESC PAUSE · TAB BOSS KEY', buf.width / 2, 176);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function blit() {
    // FILL: fractional scale, fills the screen (bigger). Off = integer pixel-fit.
    let scale = Math.min(view.width / buf.width, view.height / buf.height);
    if (!window.EFFECT_RICARDO_FILL) scale = Math.max(1, Math.floor(scale));
    const dw = buf.width * scale, dh = buf.height * scale;
    vctx.fillStyle = '#080b14';
    vctx.fillRect(0, 0, view.width, view.height);
    vctx.imageSmoothingEnabled = false;
    let dx = (view.width - dw) / 2, dy = (view.height - dh) / 2;
    const s = G.shake * (window.EFFECT_RICARDO_SHAKE ?? 1);
    if (s > 0.01) {
      // trippy mode: positional jitter + micro-rotation + hue-split ghosts
      dx += (Math.random() * 2 - 1) * s * scale * 0.6;
      dy += (Math.random() * 2 - 1) * s * scale * 0.6;
      vctx.save();
      vctx.translate(view.width / 2, view.height / 2);
      vctx.rotate((Math.random() * 2 - 1) * 0.004 * s);
      vctx.translate(-view.width / 2, -view.height / 2);
      vctx.globalCompositeOperation = 'lighter';
      vctx.globalAlpha = 0.22;
      vctx.filter = 'hue-rotate(90deg)';
      vctx.drawImage(buf, dx - s * scale * 0.5, dy, dw, dh);
      vctx.filter = 'hue-rotate(270deg)';
      vctx.drawImage(buf, dx + s * scale * 0.5, dy, dw, dh);
      vctx.filter = 'none';
      vctx.globalAlpha = 1;
      vctx.globalCompositeOperation = 'source-over';
      vctx.drawImage(buf, dx, dy, dw, dh);
      vctx.restore();
    } else vctx.drawImage(buf, dx, dy, dw, dh);
  }

  // ── main loop ────────────────────────────────────────────────────────────────
  let last = performance.now(), acc = 0;

  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25; // tab-switch guard
    acc += dt;
    if (G.paused) acc = 0; // frozen, but still rendering (pause menu needs a stage)
    while (acc >= STEP) {
      G.time += STEP; G.modeT += STEP;
      if (G.roomFlash > 0) G.roomFlash -= STEP;
      if (G.shake > 0) G.shake = Math.max(0, G.shake - 9 * STEP);
      for (const gh of G.ghosts) gh.life -= STEP;
      if (G.mode === 'play') { simPlayer(STEP); simSkulls(STEP); }
      else if (G.mode === 'flappy') { simFlappy(STEP); }
      else if (G.mode === 'dying' && G.modeT > 0.9) {
        G.lives--;
        if (G.lives <= 0) { G.mode = 'gameover'; G.modeT = 0; }
        // respawn grace: entry points can hang over pits now, so the first
        // landing after a respawn is free (fall: -99 pushes fallPeak way up)
        else { G.mode = 'play'; enterRoom(G.room.id, G.entry.x, G.entry.y, { fall: -99 }); }
      } else if ((G.mode === 'title' || G.mode === 'gameover' || G.mode === 'win') && anyInput && G.modeT > 0.5) {
        startRun();
      }
      anyInput = anyInput && false;
      acc -= STEP;
    }
    if (G.ghosts.length && G.ghosts[0].life <= 0) G.ghosts = G.ghosts.filter(g => g.life > 0);
    music();
    render();
    requestAnimationFrame(frame);
  }

  function startRun() {
    G.score = 0; G.lives = 3; G.keysHeld = []; G.mut = {};
    G.mode = 'play'; G.modeT = 0;
    G.shake = 0; G.ghosts = []; G.fl = null; G.paused = false;
    MUS.next = 0; MUS.step = 0;
    enterRoom(G.pack.start, null, null);
  }

  // ── boot ─────────────────────────────────────────────────────────────────────
  loadPack().then(pack => {
    G.pack = pack;
    pack.rooms.forEach(r => { G.roomsById[r.id] = r; });
    // dummy room so title renders before first run
    G.room = pack.rooms[0]; G.grid = G.room.grid.map(r => r.split(''));
    document.body.classList.toggle('crt', !!window.EFFECT_RICARDO_CRT);
    requestAnimationFrame(ts => { last = ts; frame(ts); });
  });

  window.RICARDO_GAME = { G, restart: startRun, pause: togglePause, boss: toggleBoss }; // devpanel hooks
})();
