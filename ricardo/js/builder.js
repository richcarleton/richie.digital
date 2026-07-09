// ── ricardo/js/builder.js — pyramid level builder ────────────────────────────
// Paint tiles on a grid, manage rooms + exits, export/import compact JSON.
// SAVE writes localStorage 'ricardo.pack'; TEST opens the game with ?pack=local.
(function () {
  'use strict';
  const S  = window.RicardoSchema;
  const SP = window.RicardoSprites;
  const W = S.W, H = S.H, TP = S.TILE_PX;

  // ── state ────────────────────────────────────────────────────────────────────
  let pack;
  try {
    const saved = localStorage.getItem('ricardo.pack');
    pack = saved ? S.parse(saved) : JSON.parse(JSON.stringify(window.RICARDO_PACK));
  } catch (e) {
    pack = JSON.parse(JSON.stringify(window.RICARDO_PACK));
  }
  let cur = 0;              // room index
  let brush = S.T.WALL;
  let grids = pack.rooms.map(r => r.grid.map(row => row.split(''))); // mutable

  const $ = id => document.getElementById(id);
  const canvas = $('grid');
  const ctx = canvas.getContext('2d');

  // logical buffer + DPR-aware display, same trick as the game
  const buf = document.createElement('canvas');
  buf.width = W * TP; buf.height = H * TP;
  const bctx = buf.getContext('2d');

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.width * dpr * (H / W)));
    ctx.imageSmoothingEnabled = false;
    draw();
  }
  window.addEventListener('resize', fit);

  // ── painting ─────────────────────────────────────────────────────────────────
  let painting = false;
  function cellFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * W);
    const y = Math.floor((e.clientY - r.top) / r.height * H);
    return (x >= 0 && x < W && y >= 0 && y < H) ? { x, y } : null;
  }
  function paint(e) {
    const c = cellFromEvent(e);
    if (!c) return;
    if (brush === S.T.SPAWN) { // one spawn per room
      const g = grids[cur];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (g[y][x] === S.T.SPAWN) g[y][x] = S.T.EMPTY;
    }
    grids[cur][c.y][c.x] = brush;
    draw(); dirty();
  }
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); painting = true; paint(e); });
  canvas.addEventListener('pointermove', e => { if (painting) paint(e); });
  canvas.addEventListener('pointerup',     () => painting = false);
  canvas.addEventListener('pointercancel', () => painting = false);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ── render ───────────────────────────────────────────────────────────────────
  let t0 = performance.now();
  function draw() {
    const t = (performance.now() - t0) / 1000;
    bctx.fillStyle = SP.PAL['1'];
    bctx.fillRect(0, 0, buf.width, buf.height);
    const g = grids[cur];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== S.T.EMPTY) SP.drawTile(bctx, g[y][x], x, y, t, { vanishOn: true });
    }
    // grid lines
    bctx.strokeStyle = 'rgba(232,144,10,0.10)';
    bctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x++) { bctx.beginPath(); bctx.moveTo(x * TP, 0); bctx.lineTo(x * TP, buf.height); bctx.stroke(); }
    for (let y = 0; y <= H; y++) { bctx.beginPath(); bctx.moveTo(0, y * TP); bctx.lineTo(buf.width, y * TP); bctx.stroke(); }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);
  }
  setInterval(draw, 250); // keep animated tiles gently alive

  // ── palette ──────────────────────────────────────────────────────────────────
  const palEl = $('palette');
  S.TILESET.forEach(({ ch, label }) => {
    const b = document.createElement('button');
    b.className = 'tile-btn' + (ch === brush ? ' on' : '');
    const c = document.createElement('canvas');
    c.width = TP; c.height = TP;
    const cc = c.getContext('2d');
    cc.fillStyle = SP.PAL['1']; cc.fillRect(0, 0, TP, TP);
    if (ch !== S.T.EMPTY) SP.drawTile(cc, ch, 0, 0, 0.5, { vanishOn: true });
    b.appendChild(c);
    const sp = document.createElement('span');
    sp.textContent = label;
    b.appendChild(sp);
    b.addEventListener('click', () => {
      brush = ch;
      palEl.querySelectorAll('.tile-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
    palEl.appendChild(b);
  });

  // ── room manager ─────────────────────────────────────────────────────────────
  function syncPackFromGrids() {
    pack.rooms.forEach((r, i) => { r.grid = grids[i].map(row => row.join('')); });
  }
  function refreshRoomUI() {
    const sel = $('room-sel');
    sel.innerHTML = '';
    pack.rooms.forEach((r, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = r.id + (pack.start === r.id ? ' ★' : '');
      if (i === cur) o.selected = true;
      sel.appendChild(o);
    });
    const room = pack.rooms[cur];
    $('room-id').value = room.id;
    $('room-name').value = room.name || '';
    for (const d of ['left', 'right', 'up', 'down']) {
      const s = $('exit-' + d);
      s.innerHTML = '<option value="">—</option>';
      pack.rooms.forEach(r => {
        if (r.id === room.id) return;
        const o = document.createElement('option');
        o.value = r.id; o.textContent = r.id;
        if (room.exits && room.exits[d] === r.id) o.selected = true;
        s.appendChild(o);
      });
    }
    $('start-room').checked = pack.start === room.id;
    draw();
  }

  $('room-sel').addEventListener('change', e => { cur = +e.target.value; refreshRoomUI(); });
  $('room-id').addEventListener('change', e => {
    const old = pack.rooms[cur].id, nid = e.target.value.trim();
    if (!nid) { e.target.value = old; return; }
    pack.rooms[cur].id = nid;
    if (pack.start === old) pack.start = nid;
    pack.rooms.forEach(r => { for (const d in r.exits || {}) if (r.exits[d] === old) r.exits[d] = nid; });
    refreshRoomUI(); dirty();
  });
  $('room-name').addEventListener('change', e => { pack.rooms[cur].name = e.target.value; dirty(); });
  ['left', 'right', 'up', 'down'].forEach(d => {
    $('exit-' + d).addEventListener('change', e => {
      pack.rooms[cur].exits = pack.rooms[cur].exits || {};
      if (e.target.value) pack.rooms[cur].exits[d] = e.target.value;
      else delete pack.rooms[cur].exits[d];
      dirty();
    });
  });
  $('start-room').addEventListener('change', e => {
    if (e.target.checked) pack.start = pack.rooms[cur].id;
    refreshRoomUI(); dirty();
  });
  $('room-new').addEventListener('click', () => {
    let n = pack.rooms.length + 1, id;
    do { id = 'room' + n++; } while (pack.rooms.some(r => r.id === id));
    pack.rooms.push(S.blankRoom(id));
    grids.push(pack.rooms[pack.rooms.length - 1].grid.map(r => r.split('')));
    cur = pack.rooms.length - 1;
    refreshRoomUI(); dirty();
  });
  $('room-del').addEventListener('click', () => {
    if (pack.rooms.length <= 1) { status('cannot delete the last room', true); return; }
    const dead = pack.rooms[cur].id;
    pack.rooms.splice(cur, 1); grids.splice(cur, 1);
    pack.rooms.forEach(r => { for (const d in r.exits || {}) if (r.exits[d] === dead) delete r.exits[d]; });
    if (pack.start === dead) pack.start = pack.rooms[0].id;
    cur = Math.min(cur, pack.rooms.length - 1);
    refreshRoomUI(); dirty();
  });

  // ── io ───────────────────────────────────────────────────────────────────────
  function status(msg, bad) {
    const el = $('status');
    el.textContent = msg;
    el.className = bad ? 'bad' : 'good';
  }
  function dirty() { status('unsaved changes'); }

  $('btn-export').addEventListener('click', () => {
    syncPackFromGrids();
    const errs = S.validatePack(pack);
    $('io').value = S.serialize(pack);
    status(errs.length ? 'exported with warnings: ' + errs[0] : 'exported ✓ (paste into levels/pack.json + js/levels.js)', errs.length > 0);
  });
  $('btn-import').addEventListener('click', () => {
    try {
      pack = S.parse($('io').value);
      grids = pack.rooms.map(r => r.grid.map(row => row.split('')));
      cur = 0;
      refreshRoomUI();
      status('imported ✓');
    } catch (e) { status(String(e.message || e).split('\n')[0], true); }
  });
  $('btn-save').addEventListener('click', () => {
    syncPackFromGrids();
    const errs = S.validatePack(pack);
    if (errs.length) { status('not saved: ' + errs[0], true); return; }
    localStorage.setItem('ricardo.pack', S.serialize(pack));
    status('saved to browser ✓ — TEST to play it');
  });
  $('btn-test').addEventListener('click', () => {
    syncPackFromGrids();
    const errs = S.validatePack(pack);
    if (errs.length) { status('fix first: ' + errs[0], true); return; }
    localStorage.setItem('ricardo.pack', S.serialize(pack));
    window.open('index.html?pack=local', '_blank');
  });
  $('btn-revert').addEventListener('click', () => {
    pack = JSON.parse(JSON.stringify(window.RICARDO_PACK));
    grids = pack.rooms.map(r => r.grid.map(row => row.split('')));
    cur = 0;
    refreshRoomUI();
    status('reverted to shipped pack');
  });

  refreshRoomUI();
  fit();
})();
