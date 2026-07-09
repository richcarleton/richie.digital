// ── ricardo/js/sprites.js — palette, pixel sprites, tile renderer ────────────
// Chunky sprites drawn from string bitmaps. Shared by game + builder.
// Bitmap chars index PAL; '.' = transparent; 'C' = per-call tint.
(function () {
  'use strict';
  const S = window.RicardoSchema;
  const TP = S.TILE_PX;

  const PAL = {
    '1': '#080b14',  // site background
    '2': '#8a0ae8',  // purple  (Ricardo)
    '3': '#e80a78',  // magenta (eyes / gems)
    '4': '#0ac8e8',  // cyan    (ladders)
    '5': '#e8900a',  // amber   (vanish / keys·A)
    '6': '#0ae87a',  // green   (ropes)
    '7': '#e8e8f0',  // bone white
    '8': '#2a1a4a',  // wall fill
    '9': '#141d33',  // wall shadow
    'a': '#4a2a8a',  // wall highlight
  };
  const TINT = { R: '#e80a78', G: '#0ac8e8', B: '#e8900a' }; // keys/doors: magenta·cyan·amber

  // ── Ricardo the cat (8×12) ──────────────────────────────────────────────────
  const CAT_STAND = [
    '2......2',
    '22....22',
    '23222232',
    '22222222',
    '23.22.32',   // magenta slit eyes, like the planet
    '22222222',
    '.222222.',
    '.222222.',
    '.222222.',
    '.22..22.',
    '.22..22.',
    '.72..27.',
  ];
  const CAT_WALK = [
    '2......2',
    '22....22',
    '23222232',
    '22222222',
    '23.22.32',
    '22222222',
    '.222222.',
    '.222222.',
    '.222222.',
    '.22.22..',
    '22..22..',
    '7....7..',
  ];
  const CAT_CLIMB = [
    '2.2222.2',
    '22222222',
    '23222232',
    '72222227',
    '23.22.32',
    '22222222',
    '.222222.',
    '.222222.',
    '.222222.',
    '.22..22.',
    '.72..27.',
    '........',
  ];
  const CAT_JUMP = [
    '2......2',
    '22....22',
    '23222232',
    '22222222',
    '23.22.32',
    '22222222',
    '7222222.',
    '.2222227',
    '.222222.',
    '22....22',
    '7......7',
    '........',
  ];

  const SKULL = [
    '.777777.',
    '77777777',
    '77.77.77',
    '77.77.77',
    '77777777',
    '.777777.',
    '.7.77.7.',
    '........',
  ];
  const GEM = [
    '........',
    '..3333..',
    '.373333.',
    '33733333',
    '.333333.',
    '..3333..',
    '...33...',
    '........',
  ];
  const KEY = [
    '........',
    '.CC.....',
    'C..C....',
    'C..CCCCC',
    'C..C..C.',
    '.CC...C.',
    '........',
    '........',
  ];

  function drawBitmap(ctx, bmp, x, y, tint) {
    for (let r = 0; r < bmp.length; r++) {
      const row = bmp[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'C' ? (tint || '#fff') : (PAL[ch] || '#fff');
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }

  // ── tile renderer ────────────────────────────────────────────────────────────
  // t = seconds (for vanish blink); opts.vanishOn = current vanish solidity.
  function drawTile(ctx, ch, cx, cy, t, opts) {
    const x = cx * TP, y = cy * TP;
    const T = S.T;
    switch (ch) {
      case T.WALL:
        ctx.fillStyle = PAL['8']; ctx.fillRect(x, y, TP, TP);
        ctx.fillStyle = PAL['a']; ctx.fillRect(x, y, TP, 1); ctx.fillRect(x, y, 1, TP);
        ctx.fillStyle = PAL['9']; ctx.fillRect(x, y + TP - 1, TP, 1); ctx.fillRect(x + TP - 1, y, 1, TP);
        break;
      case T.LADDER:
        ctx.fillStyle = PAL['4'];
        ctx.fillRect(x + 2, y, 1, TP); ctx.fillRect(x + TP - 3, y, 1, TP);
        for (let r = 1; r < TP; r += 4) ctx.fillRect(x + 2, y + r, TP - 4, 1);
        break;
      case T.ROPE:
        ctx.fillStyle = PAL['6'];
        ctx.fillRect(x + TP / 2 - 1, y, 1, TP);
        ctx.fillRect(x + TP / 2, y + ((cy * 7) % 4), 1, 2); // knots
        break;
      case T.CONV_L:
      case T.CONV_R: {
        ctx.fillStyle = PAL['8']; ctx.fillRect(x, y, TP, TP);
        ctx.fillStyle = PAL['4'];
        const dir = ch === T.CONV_R ? 1 : -1;
        const off = Math.floor((t * 8 * dir) % 4 + 4) % 4;
        for (let c = off; c < TP; c += 4) ctx.fillRect(x + c, y + 1, 2, 2);
        ctx.fillStyle = PAL['a']; ctx.fillRect(x, y, TP, 1);
        break;
      }
      case T.VANISH: {
        const on = opts && 'vanishOn' in opts ? opts.vanishOn : true;
        ctx.fillStyle = PAL['5'];
        if (on) { ctx.globalAlpha = 0.9; ctx.fillRect(x, y, TP, 3); ctx.globalAlpha = 1; }
        else { ctx.globalAlpha = 0.18; for (let c = 0; c < TP; c += 3) ctx.fillRect(x + c, y + 1, 2, 1); ctx.globalAlpha = 1; }
        break;
      }
      case T.DOOR_R: case T.DOOR_G: case T.DOOR_B: {
        const tint = TINT[S.KEY_FOR_DOOR[ch]];
        ctx.fillStyle = tint; ctx.globalAlpha = 0.85;
        ctx.fillRect(x + 3, y, 2, TP); ctx.fillRect(x + 7, y, 2, TP);
        ctx.globalAlpha = 1;
        break;
      }
      case T.KEY_R: case T.KEY_G: case T.KEY_B:
        drawBitmap(ctx, KEY, x + 2, y + 3, TINT[ch]);
        break;
      case T.TREASURE:
        drawBitmap(ctx, GEM, x + 2, y + 3);
        break;
      case T.EXIT: {
        const p = (Math.sin(t * 3) + 1) / 2;
        ctx.fillStyle = PAL['6']; ctx.globalAlpha = 0.35 + 0.5 * p;
        ctx.fillRect(x + 2, y + 1, TP - 4, TP - 2);
        ctx.globalAlpha = 1; ctx.strokeStyle = PAL['6'];
        ctx.strokeRect(x + 1.5, y + 0.5, TP - 3, TP - 1);
        break;
      }
      case T.SKULL: // builder-only marker; game replaces with entity
        drawBitmap(ctx, SKULL, x + 2, y + 3);
        break;
      case T.SPAWN: // builder-only marker
        ctx.strokeStyle = PAL['2']; ctx.strokeRect(x + 2.5, y + 2.5, TP - 5, TP - 5);
        break;
    }
  }

  window.RicardoSprites = {
    PAL, TINT, drawBitmap, drawTile,
    CAT_STAND, CAT_WALK, CAT_CLIMB, CAT_JUMP, SKULL, GEM, KEY,
  };
})();
