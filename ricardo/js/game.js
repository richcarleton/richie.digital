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
    const on = window.EFFECT_RICARDO_MUSIC && G.mode === 'play' && AC && AC.state === 'running';
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
    if (k === 'jump' && !keys.jump) jumpQueued = true;
    keys[k] = true; anyInput = true; audio();
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  // losing focus mid-press (alt-tab, devtools, clicking away) means the keyup
  // never arrives — without this the player drifts in that direction forever.
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // touch.js calls this:
  window.RICARDO_INPUT = (name, down) => {
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
    G.entry = { x: px, y: py };
    G.roomFlash = 0.5;
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
    blit();
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
    while (acc >= STEP) {
      G.time += STEP; G.modeT += STEP;
      if (G.roomFlash > 0) G.roomFlash -= STEP;
      if (G.shake > 0) G.shake = Math.max(0, G.shake - 9 * STEP);
      for (const gh of G.ghosts) gh.life -= STEP;
      if (G.mode === 'play') { simPlayer(STEP); simSkulls(STEP); }
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
    G.shake = 0; G.ghosts = []; MUS.next = 0; MUS.step = 0;
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

  window.RICARDO_GAME = { G, restart: startRun }; // devpanel hooks
})();
