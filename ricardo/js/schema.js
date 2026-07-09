// ── ricardo/js/schema.js — single source of truth: tiles, level format ──────
// Shared by game (index.html) and builder (builder.html). No dependencies.
// A level pack is: { start: "roomId", rooms: [ { id, name, grid:[16 strings
// of 28 chars], exits:{left,right,up,down} } ] }
(function () {
  'use strict';

  const W = 28, H = 16, TILE_PX = 12;

  // One char per tile. Grid strings are the wire format (compact JSON).
  const T = {
    EMPTY:  '.',
    WALL:   '#',
    LADDER: 'H',
    ROPE:   '|',
    CONV_L: '<',   // conveyor pushing left
    CONV_R: '=',   // conveyor pushing right
    VANISH: '~',   // disappearing floor (global blink cycle)
    KEY_R:  'R', KEY_G: 'G', KEY_B: 'B',
    DOOR_R: 'r', DOOR_G: 'g', DOOR_B: 'b',
    TREASURE: '$',
    SKULL:  's',   // spawn marker → replaced by entity at load
    SPAWN:  'P',
    EXIT:   'X',   // pyramid exit — touch to win
  };

  // Builder palette, in display order.
  const TILESET = [
    { ch: T.EMPTY,    label: 'ERASE'   },
    { ch: T.WALL,     label: 'WALL'    },
    { ch: T.LADDER,   label: 'LADDER'  },
    { ch: T.ROPE,     label: 'ROPE'    },
    { ch: T.CONV_L,   label: 'CONV ◀'  },
    { ch: T.CONV_R,   label: 'CONV ▶'  },
    { ch: T.VANISH,   label: 'VANISH'  },
    { ch: T.KEY_R,    label: 'KEY·M'   },
    { ch: T.KEY_G,    label: 'KEY·C'   },
    { ch: T.KEY_B,    label: 'KEY·A'   },
    { ch: T.DOOR_R,   label: 'DOOR·M'  },
    { ch: T.DOOR_G,   label: 'DOOR·C'  },
    { ch: T.DOOR_B,   label: 'DOOR·A'  },
    { ch: T.TREASURE, label: 'GEM'     },
    { ch: T.SKULL,    label: 'SKULL'   },
    { ch: T.SPAWN,    label: 'SPAWN'   },
    { ch: T.EXIT,     label: 'EXIT'    },
  ];

  const LEGAL = new Set(TILESET.map(t => t.ch));
  const KEY_FOR_DOOR = { r: 'R', g: 'G', b: 'B' };

  // Static solidity (doors + vanish are dynamic; game layers state on top).
  function isStaticSolid(ch) {
    return ch === T.WALL || ch === T.CONV_L || ch === T.CONV_R;
  }
  function isDoor(ch) { return ch === 'r' || ch === 'g' || ch === 'b'; }
  function isKey(ch)  { return ch === 'R' || ch === 'G' || ch === 'B'; }

  function blankRoom(id) {
    const rows = [];
    for (let y = 0; y < H; y++) {
      rows.push(y === 0 || y === H - 1
        ? '#'.repeat(W)
        : '#' + '.'.repeat(W - 2) + '#');
    }
    return { id, name: id.toUpperCase(), grid: rows, exits: {} };
  }

  // Returns array of human-readable problems. Empty array = clean.
  function validatePack(pack) {
    const errs = [];
    if (!pack || !Array.isArray(pack.rooms) || !pack.rooms.length) {
      return ['pack has no rooms'];
    }
    const ids = new Set();
    for (const room of pack.rooms) {
      const tag = 'room "' + (room.id || '?') + '"';
      if (!room.id) errs.push('room missing id');
      else if (ids.has(room.id)) errs.push('duplicate id ' + room.id);
      ids.add(room.id);
      if (!Array.isArray(room.grid) || room.grid.length !== H) {
        errs.push(tag + ': grid must be ' + H + ' rows'); continue;
      }
      room.grid.forEach((row, y) => {
        if (row.length !== W) errs.push(tag + ' row ' + y + ': len ' + row.length + ' ≠ ' + W);
        for (const ch of row) if (!LEGAL.has(ch)) { errs.push(tag + ' row ' + y + ': bad char "' + ch + '"'); break; }
      });
    }
    if (!ids.has(pack.start)) errs.push('start room "' + pack.start + '" not found');
    else {
      const startRoom = pack.rooms.find(r => r.id === pack.start);
      const spawns = startRoom.grid.join('').split(T.SPAWN).length - 1;
      if (spawns !== 1) errs.push('start room needs exactly 1 spawn (has ' + spawns + ')');
    }
    for (const room of pack.rooms) {
      for (const dir of ['left', 'right', 'up', 'down']) {
        const to = room.exits && room.exits[dir];
        if (to && !ids.has(to)) errs.push('room "' + room.id + '" exit ' + dir + ' → unknown "' + to + '"');
      }
    }
    return errs;
  }

  function serialize(pack) { return JSON.stringify(pack, null, 1); }
  function parse(text) {
    const pack = JSON.parse(text);
    const errs = validatePack(pack);
    if (errs.length) throw new Error('invalid pack:\n' + errs.join('\n'));
    return pack;
  }

  window.RicardoSchema = {
    W, H, TILE_PX, T, TILESET, KEY_FOR_DOOR,
    isStaticSolid, isDoor, isKey,
    blankRoom, validatePack, serialize, parse,
  };
})();
