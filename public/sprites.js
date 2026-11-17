// Pixel Office sprites: characters, desks, props and the room background.
// Everything is original art built from palette string maps (fromMap) and rects.
(function () {
  'use strict';

  const OUTLINE = '#241c22';

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // rows: array of equal-length strings; pal: { char: '#rrggbb' }. '.' and ' ' are transparent.
  function fromMap(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = canvas(w, h), g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        const col = pal[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  // Adds a 1px outline around every opaque pixel (4-neighbourhood) in place.
  function outline(c, color) {
    const g = c.getContext('2d');
    const { width: w, height: h } = c;
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const marks = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push(x, y);
      }
    }
    g.fillStyle = color || OUTLINE;
    for (let i = 0; i < marks.length; i += 2) g.fillRect(marks[i], marks[i + 1], 1, 1);
    return c;
  }

  function mirror(src) {
    const c = canvas(src.width, src.height), g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- characters (12x16)
  // Helpers (short hair, trousers)
  const HEAD_FRONT = [
    '...oooooo...',
    '..ohhhhhho..',
    '.ohhhhhhkho.',
    '.ohssssssho.',
    '.ossessesso.',
    '.osssssssso.',
    '..osssSsso..',
    '....osso....',
  ];
  const HEAD_BACK = [
    '...oooooo...',
    '..ohhhhhho..',
    '.ohkhhhhhho.',
    '.ohhhhhhhho.',
    '.ohhhhhhhho.',
    '.oHhhhhhhHo.',
    '..oHHhhHHo..',
    '....osso....',
  ];
  const HEAD_SIDE = [
    '...ooooo....',
    '..ohhhhho...',
    '.ohkhhhhho..',
    '.ohhhhssso..',
    '.ohhhssseso.',
    '.ohhhssssso.',
    '..ohsssSso..',
    '....osso....',
  ];
  const BODY_FRONT = [
    '..occcccco..',
    '.occcccccco.',
    '.osccccccso.',
    '.osCCCCCCso.',
    '..oppppppo..',
  ];
  const BODY_BACK = BODY_FRONT;
  const BODY_SIDE = [
    '...occcco...',
    '...occcco...',
    '...occcso...',
    '...oCCCCo...',
    '...oppppo...',
  ];

  // Claude (long hair with a clip, skirt)
  const F_HEAD_FRONT = [
    '...oooooo...',
    '..ohhhhhho..',
    '.ohhhhhhkho.',
    '.ohhsssshho.',
    'ohssessessho',
    'ohssssssssho',
    'ohhsssSsshho',
    'ohhoossoohho',
  ];
  const F_BODY_FRONT = [
    'ohhcccccchho',
    '.occcccccco.',
    '.osccccccso.',
    '.osCCCCCCso.',
    '.oppppppppo.',
  ];
  const F_HEAD_BACK = [
    '...oooooo...',
    '..ohhhhhho..',
    '.ohkhhhhhho.',
    '.ohhhhhhhho.',
    'ohhhhhhhhhho',
    'ohHhhhhhhHho',
    'ohHHhhhhHHho',
    'ohhHhhhhHhho',
  ];
  const F_BODY_BACK = [
    '.ohHhhhhHho.',
    '.ocHhhhhHco.',
    '.osccHHccso.',
    '.osCCCCCCso.',
    '.oppppppppo.',
  ];
  const F_HEAD_SIDE = [
    '...ooooo....',
    '..ohhhhho...',
    '.ohkhhhhho..',
    'ohhhhhssso..',
    'ohhhhssseso.',
    'ohhhhssssso.',
    'ohhhosssSso.',
    'ohhho.osso..',
  ];
  const F_BODY_SIDE = [
    '.ohhcccco...',
    '..ohcccco...',
    '...occcso...',
    '...oCCCCo...',
    '..opppppo...',
  ];

  const LEGS_FB = {
    stand: ['..opo..opo..', '..opo..opo..', '..obbo.obbo.'],
    w1: ['..opo..opo..', '..obbo.opo..', '.......obbo.'],
    w2: ['..opo..opo..', '..opo..obbo.', '..obbo......'],
  };
  const LEGS_SIDE = {
    stand: ['....oppo....', '....oppo....', '....obbbo...'],
    w1: ['...oppopo...', '..oppo.opo..', '..obbo..obo.'],
    w2: ['...opoppo...', '...opoopo...', '...obo.obo..'],
  };

  function charPalette(p) {
    return {
      o: OUTLINE, h: p.hair, H: p.hairShade, k: p.clip, s: p.skin, S: p.skinShade, e: '#2b2233',
      c: p.shirt, C: p.shirtShade, p: p.pants, b: p.shoes,
    };
  }

  const CLAUDE_PALETTE = {
    hair: '#3b2a26', hairShade: '#2a1d1a', clip: '#d97757', skin: '#f2c7a5', skinShade: '#d9a37f',
    shirt: '#d97757', shirtShade: '#b85c3e', pants: '#4a4e69', shoes: '#2b2233',
  };
  const HELPER_PALETTES = [
    { hair: '#e8c35a', hairShade: '#b8933a', clip: '#5b8dd9', skin: '#f6d3b3', skinShade: '#ddb08c', shirt: '#5b8dd9', shirtShade: '#3f6cb3', pants: '#3b3f55', shoes: '#2b2233' },
    { hair: '#1f1a1a', hairShade: '#0f0c0c', clip: '#6abf69', skin: '#c68642', skinShade: '#a56a30', shirt: '#6abf69', shirtShade: '#4a9a4a', pants: '#5a4636', shoes: '#2b2233' },
    { hair: '#7a3b1d', hairShade: '#5a2a12', clip: '#9b6ad9', skin: '#e0ac7e', skinShade: '#c08a5e', shirt: '#9b6ad9', shirtShade: '#7a4ab8', pants: '#33364a', shoes: '#2b2233' },
    { hair: '#2d2d2d', hairShade: '#1a1a1a', clip: '#e0c040', skin: '#8d5524', skinShade: '#6e3f18', shirt: '#e0c040', shirtShade: '#b89a26', pants: '#2f4a5a', shoes: '#2b2233' },
    { hair: '#b04a8a', hairShade: '#8a3268', clip: '#4fb3c8', skin: '#f1c27d', skinShade: '#d4a25a', shirt: '#4fb3c8', shirtShade: '#358fa3', pants: '#4a3a5a', shoes: '#2b2233' },
    { hair: '#3a5a8a', hairShade: '#284268', clip: '#d95b8d', skin: '#5c3a21', skinShade: '#442a16', shirt: '#d95b8d', shirtShade: '#b33f6d', pants: '#3a3a3a', shoes: '#2b2233' },
  ];

  const charCache = new Map();
  function character(key) {
    if (charCache.has(key)) return charCache.get(key);
    const isClaude = key === 'claude';
    const p = isClaude ? CLAUDE_PALETTE : HELPER_PALETTES[Number(key) % HELPER_PALETTES.length];
    const pal = charPalette(p);
    const hf = isClaude ? F_HEAD_FRONT : HEAD_FRONT, bf = isClaude ? F_BODY_FRONT : BODY_FRONT;
    const hb = isClaude ? F_HEAD_BACK : HEAD_BACK, bb = isClaude ? F_BODY_BACK : BODY_BACK;
    const hs = isClaude ? F_HEAD_SIDE : HEAD_SIDE, bs = isClaude ? F_BODY_SIDE : BODY_SIDE;
    // Claude's legs: dark tights under the skirt
    const legPal = isClaude ? Object.assign({}, pal, { p: '#3a3550' }) : pal;
    const build = (head, body, legs) => {
      const top = fromMap([...head, ...body], pal);
      const c = canvas(12, 16), g = c.getContext('2d');
      g.drawImage(fromMap(legs, legPal), 0, 13);
      g.drawImage(top, 0, 0);
      return c;
    };
    const set = {
      front: ['stand', 'w1', 'w2'].map((k) => build(hf, bf, LEGS_FB[k])),
      back: ['stand', 'w1', 'w2'].map((k) => build(hb, bb, LEGS_FB[k])),
      side: ['stand', 'w1', 'w2'].map((k) => build(hs, bs, LEGS_SIDE[k])),
      palette: p,
    };
    set.sideL = set.side.map(mirror);
    // Eyes closed (meditate): paint over the eye pixels with skin shade.
    const calm = build(hf, bf, LEGS_FB.stand), cg = calm.getContext('2d');
    cg.fillStyle = p.skinShade; cg.fillRect(4, 4, 1, 1); cg.fillRect(7, 4, 1, 1);
    set.frontCalm = calm;
    // Arms up (jumping jacks): hands raised beside the head.
    const up = build(hf, bf, LEGS_FB.stand), ug = up.getContext('2d');
    ug.fillStyle = p.shirt; ug.fillRect(2, 10, 1, 2); ug.fillRect(9, 10, 1, 2);
    ug.fillStyle = OUTLINE; ug.fillRect(0, 3, 2, 6); ug.fillRect(10, 3, 2, 6);
    ug.fillStyle = p.shirt; ug.fillRect(0, 5, 1, 3); ug.fillRect(11, 5, 1, 3);
    ug.fillStyle = p.skin; ug.fillRect(0, 3, 1, 2); ug.fillRect(11, 3, 1, 2);
    set.armsUp = up;
    charCache.set(key, set);
    return set;
  }

  // ---------------------------------------------------------------- desk (32x24)
  const deskCache = new Map();
  function desk(screen, lampOn) {
    const key = screen + '|' + (lampOn ? 1 : 0);
    if (deskCache.has(key)) return deskCache.get(key);
    const c = canvas(32, 24), g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // legs
    R(1, 19, 3, 5, '#5a3a22'); R(28, 19, 3, 5, '#5a3a22');
    // top + front
    R(0, 10, 32, 5, '#b07a4a'); R(0, 10, 32, 1, '#c99360');
    R(0, 15, 32, 5, '#8a5a32'); R(0, 15, 32, 1, '#6e4626');
    R(13, 17, 6, 1, '#c99360');
    // monitor
    R(9, 8, 3, 3, '#3a3a4a');
    R(3, 0, 15, 9, '#2f2f3d');
    const scr = { off: '#1d2b3a', on: '#2a6f8a', alert: '#f0902a', alert2: '#8a3a1a', idle: '#23384d' }[screen] || '#1d2b3a';
    R(4, 1, 13, 7, scr);
    if (screen === 'on') {
      R(5, 2, 6, 1, '#9ff0ff'); R(6, 3, 8, 1, '#5fd0e6'); R(6, 4, 5, 1, '#f6c27d'); R(5, 5, 9, 1, '#5fd0e6'); R(6, 6, 4, 1, '#9ff0ff');
    } else if (screen === 'alert' || screen === 'alert2') {
      R(9, 2, 3, 3, screen === 'alert' ? '#fff1dc' : '#f0902a'); R(10, 6, 1, 1, screen === 'alert' ? '#fff1dc' : '#f0902a');
    } else if (screen === 'idle') {
      R(7, 3, 2, 2, '#4a6a8a'); R(12, 4, 2, 2, '#3a5a7a');
    }
    // keyboard + mouse
    R(5, 11, 12, 2, '#e8e4dc'); for (let i = 0; i < 5; i++) R(6 + i * 2, 11, 1, 1, '#b8b0a4');
    R(18, 12, 2, 1, '#e8e4dc');
    // mug
    R(20, 9, 3, 3, '#f4efe6'); R(23, 10, 1, 1, '#f4efe6'); R(20, 9, 3, 1, '#6a3a2a');
    // lamp
    R(25, 12, 5, 2, '#2f6f5e'); R(27, 5, 1, 7, '#3a3a4a'); R(24, 2, 7, 3, '#2f6f5e'); R(25, 1, 5, 1, '#3f8f7a');
    R(25, 5, 5, 1, lampOn ? '#ffe9a0' : '#8a8a7a');
    outline(c);
    deskCache.set(key, c);
    return c;
  }

  // ---------------------------------------------------------------- props
  function chair() {
    return fromMap([
      '.oooooooo.',
      'oCCCCCCCCo',
      'oCccccccCo',
      'oCccccccCo',
      'oCCCCCCCCo',
      '.oooooooo.',
      '....oo....',
      '...oCCo...',
    ], { o: OUTLINE, C: '#3a3a4a', c: '#4e4e62' });
  }

  function plant() {
    return fromMap([
      '....oo.oo...',
      '...oggogGo..',
      '..oGggogggo.',
      '.ogggoGgGgo.',
      'oGgGgggogGo.',
      '.oggGgGggo..',
      '..ooggGoo...',
      '...oGgo.....',
      '..oooooooo..',
      '..oppppppo..',
      '..oPppppPo..',
      '...oPppPo...',
      '...oPPPPo...',
      '....oooo....',
    ].map((r) => r.padEnd(12, '.').slice(0, 12)), { o: OUTLINE, g: '#5aa04a', G: '#3d7a35', p: '#c96a4a', P: '#a84e34' });
  }

  function door() {
    const c = canvas(16, 30), g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(0, 0, 16, 30, '#6e4626');
    R(1, 1, 14, 29, '#9a6a3e');
    R(3, 3, 10, 10, '#8a5a32'); R(3, 16, 10, 11, '#8a5a32');
    R(4, 4, 8, 8, '#a8784a'); R(4, 17, 8, 9, '#a8784a');
    R(12, 15, 2, 2, '#f0c860');
    return c;
  }

  function shelf() {
    const c = canvas(24, 28), g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(0, 0, 24, 28, '#6e4626'); R(1, 1, 22, 26, '#4a2e18');
    const books = ['#d97757', '#5b8dd9', '#6abf69', '#e0c040', '#9b6ad9', '#4fb3c8', '#d95b8d', '#f4efe6'];
    let bi = 0;
    for (const sy of [1, 10, 19]) {
      let x = 2;
      while (x < 21) {
        const w = 2 + ((bi * 7) % 2);
        const h = 6 + ((bi * 5) % 3);
        R(x, sy + 8 - h, w, h, books[bi % books.length]);
        x += w + ((bi % 4 === 3) ? 2 : 0);
        bi++;
      }
      R(1, sy + 8, 22, 1, '#8a5a32');
    }
    return outline(c);
  }

  function poster() {
    const c = canvas(14, 12), g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(0, 0, 14, 12, '#f4efe6'); R(1, 1, 12, 10, '#ffe2c4');
    R(3, 6, 8, 4, '#d97757'); R(5, 3, 4, 3, '#f6c27d'); R(5, 2, 1, 1, '#f6c27d'); R(8, 2, 1, 1, '#f6c27d');
    R(6, 4, 1, 1, '#2b2233'); R(8, 4, 1, 1, '#2b2233');
    return c;
  }

  // Server rack: drawn every frame for blinking LEDs.
  function drawRack(g, x, y, t) {
    const R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(x + a, y + b, w, h); };
    R(-1, -1, 14, 26, OUTLINE);
    R(0, 0, 12, 24, '#2c2f3a');
    for (let i = 0; i < 5; i++) {
      R(1, 1 + i * 5, 10, 4, '#3c4050');
      R(2, 2 + i * 5, 5, 1, '#1d2028');
      const on1 = Math.sin(t * (3 + i) + i * 1.7) > 0;
      const on2 = Math.sin(t * (5 + i * 0.7) + i) > 0.3;
      R(8, 2 + i * 5, 1, 1, on1 ? '#6aff8a' : '#2a5a3a');
      R(10, 2 + i * 5, 1, 1, on2 ? '#ffb84a' : '#5a4a2a');
    }
  }

  // ---------------------------------------------------------------- background (240x176)
  function background(W, H, opts) {
    const c = canvas(W, H), g = c.getContext('2d');
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // wall
    R(0, 0, W, 40, '#e9dcc7');
    for (let x = 0; x < W; x += 12) R(x, 0, 1, 28, '#e0d1b8');
    R(0, 28, W, 10, '#c9b08f'); R(0, 28, W, 1, '#b39874');
    for (let x = 4; x < W; x += 16) R(x, 30, 8, 6, '#bfa480');
    R(0, 38, W, 2, '#7a5a3e');
    // floor checker
    for (let y = 40; y < H; y += 8) {
      for (let x = 0; x < W; x += 8) {
        const even = ((x >> 3) + (y >> 3)) % 2 === 0;
        R(x, y, 8, 8, even ? '#d9c3a0' : '#cfb68f');
      }
    }
    R(0, 40, W, 1, '#b39874');
    // rug under the main desk area
    R(84, 44, 72, 40, '#a9574a'); R(86, 46, 68, 36, '#c06a58'); R(90, 50, 60, 28, '#a9574a'); R(92, 52, 56, 24, '#c87a62');
    // wall decor
    if (opts) {
      g.drawImage(door(), opts.door.x, opts.door.y);
      g.drawImage(shelf(), opts.shelf.x, opts.shelf.y);
      g.drawImage(poster(), opts.poster.x, opts.poster.y);
    }
    return c;
  }

  // Wall clock face; hands are drawn by game.js after the tint.
  function drawClock(g, cx, cy, r, hh, mm, ss) {
    g.fillStyle = OUTLINE; g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d97757'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fbf6ec'; g.beginPath(); g.arc(cx, cy, r - 1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6a5a5a';
    for (let i = 0; i < 12; i += 3) {
      const a = (i / 12) * Math.PI * 2;
      g.fillRect(Math.round(cx + Math.sin(a) * (r - 2)), Math.round(cy - Math.cos(a) * (r - 2)), 1, 1);
    }
    const hand = (frac, len, col) => {
      const a = frac * Math.PI * 2;
      pixelLine(g, cx, cy, cx + Math.sin(a) * len, cy - Math.cos(a) * len, col);
    };
    hand(((hh % 12) + mm / 60) / 12, r * 0.5, '#2b2233');
    hand((mm + ss / 60) / 60, r * 0.8, '#2b2233');
    hand(ss / 60, r * 0.8, '#d94a3a');
    g.fillStyle = '#2b2233'; g.fillRect(cx, cy, 1, 1);
  }

  function pixelLine(g, x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    g.fillStyle = col;
    for (let i = 0; i < 64; i++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  window.Sprites = {
    OUTLINE, canvas, fromMap, outline, mirror, character, desk, chair: null, plant: null,
    drawRack, background, drawClock, pixelLine, CLAUDE_PALETTE, HELPER_PALETTES,
    init() {
      this.chair = chair();
      this.plant = plant();
      return this;
    },
  };
})();
