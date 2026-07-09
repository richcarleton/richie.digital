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

  const CLIMB = 4.2;        // tiles/s on ladders/ropes
  const CONV  = 2.6;        // conveyor push, tiles/s
  const FALL_TILES = 5.2;   // falls beyond this = death (the Coleco tax)
  const VANISH_PERIOD = 2.4, VANISH_DUTY = 0.62;
  const STEP = 1 / 120;     // simulation step, s
  const PW = 0.66, PH = 0.94; // player AABB in tiles

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
  const sfx = {
    jump:     () => blip(240, 0.12),
    key:      () => { blip(660, 0.1); setTimeout(() => blip(880, 0.12), 90); },
    door:     () => blip(180, 0.2, 'sawtooth'),
    gem:      () => { blip(880, 0.08); setTimeout(() => blip(1175, 0.08), 70); setTimeout(() => blip(1568, 0.12), 140); },
    die:      () => blip(90, 0.5, 'sawtooth', 0.09),
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
  };

  function roomState(id) {
    // per-room persistent mutations (opened doors, taken pickups, dead-forever? no — skulls respawn)
    if (!G.mut) G.mut = {};
    if (!G.mut[id]) G.mut[id] = { cleared: {} }; // "y,x" -> true for removed tiles
    return G.mut[id];
  }

  function enterRoom(id, px, py) {
    const room = G.roomsById[id];
    if (!room) return;
    G.room = room;
    const mut = roomState(id);
    G.grid = room.grid.map(r => r.split(''));
    G.skulls = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (mut.cleared[y + ',' + x]) { G.grid[y][x] = T.EMPTY; continue; }
      const ch = G.grid[y][x];
      if (ch === T.SKULL) { G.grid[y][x] = T.EMPTY; G.skulls.push({ x, y, dir: 1, fx: x }); }
      if (ch === T.SPAWN) { G.grid[y][x] = T.EMPTY; if (px == null) { px = x + 0.17; py = y + 0.03; } }
    }
    G.player = {
      x: px, y: py, vx: 0, vy: 0,
      grounded: false, climbing: false, airVX: 0,
      fallPeak: py, face: 1, anim: 0,
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
      p.climbing = true; p.vx = 0; p.vy = 0; p.airVX = 0;
      p.x = cx + 0.5 - PW / 2; // snap to rail
    }

    if (p.climbing) {
      if (!onClimbable) { p.climbing = false; }
      else {
        p.vy = (keys.up ? -CLIMB : 0) + (keys.down ? CLIMB : 0);
        p.vx = 0;
        if (jumpQueued) { p.climbing = false; p.vy = -JUMP * 0.6; p.airVX = (keys.left ? -1 : keys.right ? 1 : 0) * SPEED; sfx.jump(); }
        jumpQueued = false;
        // vertical move w/ collision
        let ny = p.y + p.vy * dt;
        if (p.vy < 0 && rectSolid(p.x, ny, PW, PH, p)) ny = p.y;
        if (p.vy > 0 && rectSolid(p.x, ny, PW, PH, p)) { ny = p.y; p.climbing = tileAt(cx, cy) !== T.EMPTY; }
        p.y = ny;
        p.fallPeak = p.y;
        p.anim += Math.abs(p.vy) * dt;
        collectAndHazards(p);
        return;
      }
    }

    // grounded check (feet probe)
    const feetY = p.y + PH + 0.02;
    const g0 = solid(Math.floor(p.x + 0.06), Math.floor(feetY), p) ||
               solid(Math.floor(p.x + PW - 0.06), Math.floor(feetY), p) ||
               ladderTopSolid(Math.floor(p.x + PW / 2), Math.floor(feetY), p);
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
        // fall damage
        if (ny - p.fallPeak > FALL_TILES) { kill(); return; }
        p.vy = 0; p.grounded = true; p.airVX = 0;
      }
    } else if (p.vy < 0 && rectSolid(p.x, ny, PW, PH, p)) {
      ny = Math.floor(ny) + 1.001; p.vy = 0;
    }
    p.y = ny;
    if (p.vy < 0 || p.grounded) p.fallPeak = Math.min(p.fallPeak, p.y);
    if (p.grounded) p.fallPeak = p.y;

    if (p.grounded && Math.abs(p.vx) > 0.1) { p.anim += Math.abs(p.vx) * dt; if ((p.anim | 0) % 2 === 0 && Math.random() < 0.02) sfx.step(); }

    // room transitions at edges
    const ex = G.room.exits || {};
    if (p.x + PW < 0.05 && ex.left)   return enterRoom(ex.left,  W - PW - 0.1, p.y);
    if (p.x > W - 0.05 && ex.right)   return enterRoom(ex.right, 0.1, p.y);
    if (p.y > H && ex.down)           return enterRoom(ex.down,  p.x, 0.1);
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
      else if (ch === T.EXIT)     { G.mode = 'win'; G.modeT = 0; sfx.win(); }
    }
    // skulls
    for (const sk of G.skulls) {
      if (p.x < sk.fx + 0.85 && p.x + PW > sk.fx + 0.15 &&
          p.y < sk.y + 0.9  && p.y + PH > sk.y + 0.25) { kill(); return; }
    }
  }

  function kill() {
    if (G.mode !== 'play') return;
    G.mode = 'dying'; G.modeT = 0; sfx.die();
  }

  function simSkulls(dt) {
    const sp = window.EFFECT_RICARDO_SKULL;
    for (const sk of G.skulls) {
      const nfx = sk.fx + sk.dir * sp * dt;
      const aheadX = Math.floor(nfx + (sk.dir > 0 ? 0.9 : 0.1));
      const wallAhead = solid(aheadX, sk.y, false);
      const floorAhead = solid(aheadX, sk.y + 1, false) || tileAt(aheadX, sk.y + 1) === T.LADDER;
      if (wallAhead || !floorAhead) sk.dir *= -1;
      else sk.fx = nfx;
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

    const von = vanishOn();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = G.grid[y][x];
      if (ch !== T.EMPTY) SP.drawTile(ctx, ch, x, y, G.time, { vanishOn: von });
    }

    // skulls
    for (const sk of G.skulls) {
      const bob = Math.sin(G.time * 6 + sk.fx) * 0.7;
      SP.drawBitmap(ctx, SP.SKULL, Math.round(sk.fx * TP + 2), Math.round(sk.y * TP + 3 + bob));
    }

    // player
    const p = G.player;
    if (G.mode !== 'dying' || (G.modeT * 10 | 0) % 2 === 0) {
      let bmp = SP.CAT_STAND;
      if (p.climbing) bmp = ((p.anim * 2 | 0) % 2) ? SP.CAT_CLIMB : SP.CAT_STAND;
      else if (!p.grounded) bmp = SP.CAT_JUMP;
      else if (Math.abs(p.vx) > 0.1) bmp = ((p.anim | 0) % 2) ? SP.CAT_WALK : SP.CAT_STAND;
      const px = Math.round(p.x * TP - 1), py = Math.round(p.y * TP);
      if (p.face < 0) {
        ctx.save(); ctx.translate(px + 8, py); ctx.scale(-1, 1);
        SP.drawBitmap(ctx, bmp, -4, 0); ctx.restore();
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
    ctx.fillText('a pyramid awaits the cosmic cat', buf.width / 2, 88);
    const big = 3;
    ctx.save(); ctx.translate(buf.width / 2 - 12, 100); ctx.scale(big, big);
    SP.drawBitmap(ctx, SP.CAT_STAND, 0, 0); ctx.restore();
    if ((G.time * 2 | 0) % 2 === 0) {
      ctx.fillStyle = SP.PAL['5'];
      ctx.fillText('TAP / SPACE TO START', buf.width / 2, 160);
    }
    ctx.textAlign = 'left';
  }

  function blit() {
    const scale = Math.max(1, Math.floor(Math.min(view.width / buf.width, view.height / buf.height)));
    const dw = buf.width * scale, dh = buf.height * scale;
    vctx.fillStyle = '#080b14';
    vctx.fillRect(0, 0, view.width, view.height);
    vctx.imageSmoothingEnabled = false;
    vctx.drawImage(buf, (view.width - dw) / 2, (view.height - dh) / 2, dw, dh);
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
      if (G.mode === 'play') { simPlayer(STEP); simSkulls(STEP); }
      else if (G.mode === 'dying' && G.modeT > 0.9) {
        G.lives--;
        if (G.lives <= 0) { G.mode = 'gameover'; G.modeT = 0; }
        else { G.mode = 'play'; enterRoom(G.room.id, G.entry.x, G.entry.y); }
      } else if ((G.mode === 'title' || G.mode === 'gameover' || G.mode === 'win') && anyInput && G.modeT > 0.5) {
        startRun();
      }
      anyInput = anyInput && false;
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }

  function startRun() {
    G.score = 0; G.lives = 3; G.keysHeld = []; G.mut = {};
    G.mode = 'play'; G.modeT = 0;
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
