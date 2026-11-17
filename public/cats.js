// Pixel Office cats: Bosch, Ingca and Makita. Sprites, needs, state machines, props and interaction.
// Exposed as window.Cats. All art is original and drawn procedurally, then auto-outlined.
(function () {
  'use strict';

  const FW = 18, FH = 14;
  const EXCLUSIVE = new Set(['sleep', 'groom', 'zoomies', 'stretch', 'watch', 'beg', 'eat', 'play']);
  const LOUD = new Set(['zoomies', 'fight']);
  const VEERS = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
  const STATES = ['sit', 'wander', 'zoomies', 'play', 'sleep', 'groom', 'stretch', 'eat', 'watch', 'beg', 'follow', 'fight', 'roll'];
  const LABELS = {
    sit: 'Sitting', wander: 'Wandering', zoomies: 'ZOOMIES!', play: 'Playing with ball', sleep: 'Sleeping',
    groom: 'Grooming', stretch: 'Stretching', eat: 'Eating', watch: 'Bird watching', beg: 'Begging',
    follow: 'Following Claude', fight: 'Play-fighting', roll: 'Rolling around', pet: 'Being petted',
    wandplay: 'Chasing the feather',
  };

  const DEFS = [
    {
      name: 'Bosch', color: '#f6c27d', shade: '#d9944a', light: '#fff0d6', eye: '#3c8a3c', stripes: true,
      trait: 'Greedy boss', walk: 13, run: 30, hungerRate: 0.0065, energyRate: 0.004,
      weights: { sit: 3, wander: 1.5, zoomies: 0.2, play: 0.5, sleep: 2, groom: 1, stretch: 0.6, eat: 3, watch: 0.8, beg: 3, follow: 1.5, fight: 0.15, roll: 1 },
      lines: { eat: ['Nom nom!', 'MINE!', 'More!'], beg: ['FEED ME!', 'Food?!', 'Hungry!!'], pet: ['Purrrr…', 'More pets!'], shove: ['MINE!', 'Move it!'], sleep: [], misc: ['I am the boss.', 'Snack time?'] },
    },
    {
      name: 'Ingca', color: '#3fc1b5', shade: '#258f86', light: '#c2f4ee', eye: '#f0d040', stripes: false,
      trait: 'Zoomie goblin', walk: 22, run: 58, hungerRate: 0.004, energyRate: 0.007,
      weights: { sit: 1, wander: 3, zoomies: 2.5, play: 3, sleep: 1, groom: 0.6, stretch: 1, eat: 1.2, watch: 1.4, beg: 0.5, follow: 2, fight: 1.4, roll: 1.2 },
      lines: { zoomies: ['Zoomies!', 'NYOOM!', 'Wheee!'], play: ['Gotcha!', 'Pounce!'], fight: ['Fight me!', 'En garde!'], pet: ['Nope!', 'Eek!'], misc: ['Mrrp!', 'Hehe!'] },
    },
    {
      name: 'Makita', color: '#8d939e', shade: '#666b76', light: '#d0d3da', eye: '#e09a30', stripes: false,
      trait: 'Aloof napper', walk: 15, run: 36, hungerRate: 0.0035, energyRate: 0.0055,
      weights: { sit: 2, wander: 1, zoomies: 0.08, play: 0.3, sleep: 4, groom: 2.5, stretch: 1, eat: 1, watch: 2, beg: 0.2, follow: 0.2, fight: 0.05, roll: 0.3 },
      lines: { pet: ['Hmph.'], watch: ['Birds…', '…'], misc: ['Hmph.', '*yawn*'] },
    },
  ];

  // ---------------------------------------------------------------- sprites
  function paintPose(pose, d) {
    const c = document.createElement('canvas');
    c.width = FW; c.height = FH;
    const g = c.getContext('2d');
    const B = d.color, D = d.shade, L = d.light, E = d.eye, N = '#e88a9a';
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const P = (x, y, col) => R(x, y, 1, 1, col);
    const head = (hx, hy, closed, down) => {
      R(hx, hy, 5, 4, B);
      if (!down) { P(hx, hy - 1, B); P(hx + 1, hy - 1, B); P(hx, hy - 2, B); P(hx + 3, hy - 1, B); P(hx + 4, hy - 1, B); P(hx + 4, hy - 2, B); P(hx, hy - 1, N); P(hx + 4, hy - 1, N); }
      else { P(hx, hy + 4, B); P(hx + 4, hy + 4, B); }
      R(hx + 3, hy + 2, 2, 2, L);
      P(hx + 4, hy + (down ? 2 : 1), N);
      if (closed) { P(hx + 2, hy + 1, D); P(hx + 3, hy + 1, D); } else { P(hx + 3, hy + (down ? 2 : 1), E); if (!down) P(hx + 3, hy, '#ffffff'); }
      if (d.stripes) { P(hx + 1, hy, D); P(hx + 2, hy, D); }
    };
    const stripes = (xs, y) => { if (d.stripes) for (const x of xs) P(x, y, D); else P(xs[0], y, D); };
    const legs = (xs, y0, h) => { for (let i = 0; i < xs.length; i++) R(xs[i], y0, 1, h, i % 2 ? D : B); };
    const stdBody = () => { R(3, 6, 9, 4, B); R(5, 9, 6, 1, L); stripes([5, 7, 9], 6); };
    const tail = (pts) => { for (const [x, y] of pts) P(x, y, B); const t = pts[pts.length - 1]; P(t[0], t[1], D); };

    switch (pose) {
      case 'stand': stdBody(); legs([3, 5, 9, 11], 10, 3); head(11, 3); tail([[2, 6], [1, 5], [1, 4], [2, 3]]); break;
      case 'walk1': stdBody(); legs([2, 5, 9, 12], 10, 3); head(11, 3); tail([[2, 6], [1, 5], [1, 4], [2, 3]]); break;
      case 'walk2': stdBody(); legs([4, 6, 10, 11], 10, 3); P(4, 12, 'rgba(0,0,0,0)'); head(11, 4); tail([[2, 6], [1, 5], [2, 4], [2, 3]]); break;
      case 'run1':
        R(2, 7, 11, 3, B); R(4, 9, 7, 1, L); stripes([4, 6, 8, 10], 7);
        R(1, 10, 2, 1, B); P(1, 11, D); R(13, 10, 2, 1, B); P(15, 11, D);
        head(12, 4); tail([[1, 7], [1, 6]]); break;
      case 'run2':
        R(3, 6, 10, 3, B); R(5, 8, 6, 1, L); stripes([5, 7, 9], 6);
        R(5, 9, 2, 2, D); R(9, 9, 2, 2, B);
        head(12, 3); tail([[2, 5], [1, 4]]); break;
      case 'sit': case 'sitEyes': case 'sitPaw':
        R(4, 8, 6, 5, B); R(8, 6, 3, 7, B); R(9, 7, 2, 5, L); stripes([5, 7], 8);
        R(10, 9, 1, 4, B);
        if (pose === 'sitPaw') { R(11, 7, 2, 1, B); P(12, 6, B); } else R(11, 9, 1, 4, D);
        R(2, 12, 4, 1, B); P(2, 11, D);
        head(8, 3, pose === 'sitEyes'); break;
      case 'watch':
        R(5, 7, 8, 6, B); R(6, 6, 6, 1, B); R(7, 8, 4, 4, D);
        R(6, 2, 6, 4, B); P(6, 1, B); P(7, 1, N); P(11, 1, B); P(10, 1, N); P(6, 0, B); P(11, 0, B);
        if (d.stripes) { P(8, 2, D); P(9, 3, D); } else P(9, 2, D);
        R(13, 12, 2, 1, B); P(14, 11, B); P(14, 10, D); break;
      case 'groom1': case 'groom2':
        R(4, 8, 6, 5, B); R(8, 7, 3, 6, B); R(9, 8, 2, 4, L); stripes([5, 7], 8);
        R(10, 10, 1, 3, B); R(11, 8, 1, 3, B); P(12, 8, L);
        R(2, 12, 4, 1, B); P(2, 11, D);
        head(pose === 'groom1' ? 9 : 10, pose === 'groom1' ? 5 : 4, true);
        if (pose === 'groom2') P(14, 8, N); break;
      case 'sleep':
        R(4, 8, 10, 5, B); R(3, 9, 12, 3, B); R(5, 7, 7, 1, B); stripes([6, 8, 10], 8);
        R(3, 12, 9, 1, D);
        R(10, 7, 5, 4, B); P(10, 6, B); P(14, 6, B); P(12, 9, D); P(13, 9, D); R(13, 10, 2, 1, L); break;
      case 'stretch':
        R(3, 4, 3, 3, B); R(5, 5, 3, 3, B); R(7, 7, 3, 3, B); R(9, 8, 3, 3, B); stripes([4, 6], 4);
        R(3, 7, 1, 6, B); R(5, 8, 1, 5, D);
        R(11, 11, 5, 1, B); R(11, 12, 5, 1, D);
        head(11, 7, true); tail([[2, 3], [1, 2], [1, 1]]); break;
      case 'pounce':
        R(3, 5, 9, 3, B); R(5, 7, 6, 1, L); stripes([5, 7, 9], 5);
        R(13, 8, 2, 1, B); P(15, 9, D); R(1, 8, 2, 1, B); P(1, 9, D);
        head(12, 3); tail([[2, 4], [1, 3]]); break;
      case 'bat':
        stdBody(); legs([3, 5, 9], 10, 3); R(12, 8, 1, 2, B); R(13, 7, 2, 1, B); P(15, 6, B);
        head(11, 3); tail([[2, 6], [1, 5], [1, 4], [2, 3]]); break;
      case 'puff':
        R(4, 5, 8, 5, B); R(6, 4, 4, 1, B); R(7, 3, 2, 1, B); P(5, 4, B); P(10, 4, B); P(8, 2, B);
        R(5, 9, 6, 1, L); stripes([6, 8], 5);
        legs([4, 6, 9, 11], 10, 3);
        R(2, 2, 2, 5, B); P(1, 3, B); P(4, 2, B); P(2, 1, D);
        head(11, 4); break;
      case 'eat':
        stdBody(); legs([3, 5, 9, 11], 10, 3); head(12, 7, true, true); tail([[2, 6], [1, 5], [1, 4], [2, 3]]); break;
      case 'roll':
        R(3, 7, 10, 5, B); R(5, 7, 6, 2, L);
        R(5, 4, 1, 3, B); R(7, 5, 1, 2, D); R(9, 4, 1, 3, B); R(11, 5, 1, 2, D);
        R(12, 8, 4, 4, B); P(12, 12, B); P(15, 12, B); P(13, 10, E); R(14, 8, 2, 1, L);
        tail([[2, 10], [1, 11]]); break;
      default: stdBody(); head(11, 3);
    }
    return window.Sprites.outline(c);
  }

  const POSES = ['stand', 'walk1', 'walk2', 'bat', 'run1', 'run2', 'sit', 'sitEyes', 'sitPaw', 'watch', 'groom1', 'groom2', 'sleep', 'stretch', 'pounce', 'puff', 'eat', 'roll'];
  function buildFrames(d) {
    const right = {}, left = {};
    for (const p of POSES) { right[p] = paintPose(p, d); left[p] = window.Sprites.mirror(right[p]); }
    return { right, left };
  }

  // ---------------------------------------------------------------- world helpers
  let W = 240, H = 176;
  let bounds = { x0: 10, x1: 230, y0: 48, y1: 170 };
  let blocks = [];        // inflated desk / obstacle rects
  let staticBlocks = [];
  let spots = {};
  let cats = [];
  let bowls = [];
  let ball = null;
  let fx = [];            // fight clouds
  let fightCooldownUntil = 0;
  let now = 0;
  let ctxCache = { hour: 12, lamp: 0, wand: null, claude: null };
  let claudeJob = null;   // { kind, cat, active }
  let frames = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b, c, d) => Math.hypot(c - a, d - b);

  function inflate(r, mx, top, bottom) { return { x0: r.x - mx, y0: r.y - top, x1: r.x + r.w + mx, y1: r.y + r.h + bottom }; }

  function setDesks(desks) {
    // desk footprint (desk body + seated chair zone), inflated by a margin for the cat's body
    blocks = desks.map((d) => inflate({ x: d.x, y: d.y + 6, w: 32, h: 24 }, 9, 2, 3)).concat(staticBlocks);
  }

  function isFree(x, y) {
    if (x < bounds.x0 || x > bounds.x1 || y < bounds.y0 || y > bounds.y1) return false;
    for (const b of blocks) if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return false;
    return true;
  }

  function freeSpot(tries = 60) {
    for (let i = 0; i < tries; i++) {
      const x = rand(bounds.x0 + 2, bounds.x1 - 2), y = rand(bounds.y0 + 2, bounds.y1 - 2);
      if (isFree(x, y)) return { x, y };
    }
    return { x: 70, y: 88 };
  }

  function nearestFree(x, y) {
    if (isFree(x, y)) return { x, y };
    for (let r = 2; r < 80; r += 2) {
      for (let a = 0; a < 16; a++) {
        const nx = x + Math.cos((a / 16) * Math.PI * 2) * r, ny = y + Math.sin((a / 16) * Math.PI * 2) * r;
        if (isFree(nx, ny)) return { x: nx, y: ny };
      }
    }
    return freeSpot();
  }

  function isNight(h) { return h >= 21 || h < 6; }
  function isDeepNight(h) { return h >= 1 && h < 5; }

  // ---------------------------------------------------------------- cat basics
  function makeCat(d, i) {
    const s = nearestFree(60 + i * 50, 92 + (i % 2) * 40);
    return {
      def: d, name: d.name, x: s.x, y: s.y, face: 1, state: 'sit', lastState: null, t: 0, dur: rand(2, 4),
      pose: 'sit', anim: 0, moving: false, speed: d.walk, target: null, sub: null, data: {},
      needs: { energy: rand(0.5, 0.9), hunger: rand(0.2, 0.5), love: rand(0.4, 0.8) },
      emote: null, bubble: null, nextChatter: rand(8, 20), reserved: false, petLog: [], hz: 0,
      stuckT: 0, bestD: Infinity, hidden: false,
    };
  }

  function emote(cat, type, ttl = 1.6) { cat.emote = { type, ttl, max: ttl }; }
  function say(cat, text, ttl = 2.4) { if (text) cat.bubble = { text, ttl }; }
  function sayFrom(cat, key, chance = 1) {
    const arr = cat.def.lines[key];
    if (arr && arr.length && Math.random() < chance) say(cat, pick(arr));
  }

  function others(cat) { return cats.filter((c) => c !== cat); }

  // Shared gate: may this cat enter `state` now?
  function enterFree(cat, state, partner) {
    if (EXCLUSIVE.has(state) && others(cat).some((c) => c.state === state)) return false;
    if (LOUD.has(state) && others(cat).some((c) => c !== partner && LOUD.has(c.state) && !(state === 'fight' && c.data.partner === cat))) return false;
    if (state === 'fight' && now < fightCooldownUntil) return false;
    if (state === 'eat' && !usableBowl(cat)) return false;
    return true;
  }

  function setState(cat, state, opts = {}) {
    if (!opts.force && !enterFree(cat, state, opts.partner)) state = 'sit';
    if (cat.state === 'sleep' && state !== 'sleep') cat.emote = null;
    if (cat.state === 'eat' && cat.data.bowl) cat.data.bowl.eater = null;
    cat.lastState = cat.state;
    cat.state = state;
    cat.t = 0;
    cat.sub = null;
    cat.data = {};
    cat.target = null;
    cat.moving = false;
    cat.hidden = false;
    cat.hz = 0;
    cat.speed = cat.def.walk;
    cat.stuckT = 0; cat.bestD = Infinity;
    enterState[state] ? enterState[state](cat, opts) : (cat.dur = rand(3, 6));
  }

  function goTo(cat, x, y, run) {
    const s = nearestFree(x, y);
    cat.target = s;
    cat.speed = run ? cat.def.run : cat.def.walk;
    cat.stuckT = 0; cat.bestD = Infinity;
  }

  // Steering toward cat.target with veer offsets; returns 'arrived', 'moving' or 'stuck'.
  function steer(cat, dt, reach = 2) {
    const tg = cat.target;
    if (!tg) return 'arrived';
    const dx = tg.x - cat.x, dy = tg.y - cat.y;
    const d = Math.hypot(dx, dy);
    if (d <= reach) { cat.moving = false; return 'arrived'; }
    const base = Math.atan2(dy, dx);
    const step = Math.min(d, cat.speed * dt);
    const look = Math.max(step, 3);
    let moved = false;
    for (const v of VEERS) {
      const a = base + v;
      const lx = cat.x + Math.cos(a) * look, ly = cat.y + Math.sin(a) * look;
      const nx = cat.x + Math.cos(a) * step, ny = cat.y + Math.sin(a) * step;
      if (isFree(lx, ly) && isFree(nx, ny)) {
        cat.x = nx; cat.y = ny;
        if (Math.abs(Math.cos(a)) > 0.2) cat.face = Math.cos(a) > 0 ? 1 : -1;
        moved = true;
        break;
      }
    }
    cat.moving = moved;
    // no-progress watchdog
    if (d < cat.bestD - 1) { cat.bestD = d; cat.stuckT = 0; } else cat.stuckT += dt;
    if (cat.stuckT > 2.5) { cat.moving = false; return 'stuck'; }
    return 'moving';
  }

  function walkPose(cat, run) {
    const f = Math.floor(cat.anim * (run ? 10 : 6)) % 2;
    return run ? (f ? 'run1' : 'run2') : (f ? 'walk1' : 'walk2');
  }

  function usableBowl(cat) {
    let best = null, bd = Infinity;
    for (const b of bowls) {
      if (b.servings <= 0) continue;
      if (b.eater && b.eater !== cat) continue;
      const d = dist(cat.x, cat.y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function eatSpot(b) { return nearestFree(b.x - 9, b.y); }

  // ---------------------------------------------------------------- state behaviours
  const enterState = {
    sit(cat) { cat.dur = rand(3, 8); cat.pose = pick(['sit', 'sit', 'sitEyes', 'sitPaw']); },
    wander(cat, opts) { const s = opts.to || freeSpot(); goTo(cat, s.x, s.y, opts.run); cat.dur = opts.run ? 6 : 14; },
    zoomies(cat) { cat.data.legs = Math.floor(rand(3, 6)); const s = freeSpot(); goTo(cat, s.x, s.y, true); cat.dur = 14; sayFrom(cat, 'zoomies', 0.7); emote(cat, 'spark', 1); },
    play(cat) { cat.dur = rand(10, 18); cat.sub = 'stalk'; if (!ball) cat.data.prey = freeSpot(); },
    sleep(cat) {
      cat.dur = rand(15, 40);
      let s;
      if (cat.name === 'Makita') s = ctxCache.lamp > 0.3 ? spots.lamp : (ctxCache.hour >= 7 && ctxCache.hour < 17 ? spots.sun : null);
      if (!s) s = pick([spots.cozy1, spots.cozy2, spots.sun]);
      goTo(cat, s.x, s.y); cat.sub = 'go'; cat.data.dest = cat.target; cat.data.tries = 0;
    },
    groom(cat) { cat.dur = rand(4, 8); },
    stretch(cat) { cat.dur = rand(1.8, 2.6); },
    eat(cat) {
      const b = usableBowl(cat);
      cat.data.bowl = b; if (b) b.eater = cat;
      const s = eatSpot(b); goTo(cat, s.x, s.y); cat.sub = 'go'; cat.dur = 999;
    },
    watch(cat) { const w = pick(spots.windows); goTo(cat, w.x, w.y); cat.sub = 'go'; cat.dur = rand(6, 14); },
    beg(cat) { goTo(cat, spots.beg.x, spots.beg.y); cat.sub = 'go'; cat.dur = rand(6, 12); },
    follow(cat) { cat.dur = rand(6, 11); },
    roll(cat) { cat.dur = rand(2, 3.2); emote(cat, 'heart', 1.4); },
    fight(cat, opts) {
      cat.data.partner = opts.partner; cat.data.lead = !!opts.lead; cat.sub = opts.lead ? 'approach' : 'wait'; cat.dur = 20;
      if (opts.lead) sayFrom(cat, 'fight', 0.8);
    },
    pet(cat, opts) {
      cat.dur = 999; cat.sub = 'react'; cat.data.by = opts.by || 'user';
      emote(cat, 'heart', 1.8);
      cat.needs.love = clamp(cat.needs.love + 0.35, 0, 1);
      const n = cat.name;
      if (n === 'Bosch') { cat.data.plan = [['sitEyes', 1.8], ['roll', 2.0]]; sayFrom(cat, 'pet', 0.8); }
      else if (n === 'Ingca') { cat.data.plan = [['squirm', 1.2]]; sayFrom(cat, 'pet', 0.6); }
      else {
        cat.petLog = cat.petLog.filter((t) => now - t < 25);
        cat.petLog.push(now);
        if (cat.petLog.length >= 2) { cat.data.plan = [['sitEyes', 0.8]]; cat.data.leave = true; say(cat, 'Hmph.'); emote(cat, 'anger', 1.4); cat.petLog = []; }
        else { cat.data.plan = [['sitEyes', 2.2]]; }
      }
      cat.data.step = 0; cat.data.stepT = 0;
    },
    wandplay(cat) { cat.dur = 999; },
  };

  const updateState = {
    sit(cat) { if (cat.t > cat.dur) return 'next'; },
    wander(cat, dt) {
      const r = steer(cat, dt);
      cat.pose = cat.moving ? walkPose(cat, cat.speed > cat.def.walk) : 'stand';
      if (r !== 'moving' || cat.t > cat.dur) return 'next';
    },
    zoomies(cat, dt) {
      const r = steer(cat, dt, 3);
      cat.pose = cat.moving ? walkPose(cat, true) : 'stand';
      cat.needs.energy = clamp(cat.needs.energy - 0.02 * dt, 0, 1);
      if (r !== 'moving') {
        cat.data.legs--;
        if (cat.data.legs <= 0 || cat.t > cat.dur) return 'next';
        const s = freeSpot(); goTo(cat, s.x, s.y, true);
      }
    },
    play(cat, dt) {
      const prey = ball || cat.data.prey;
      if (!prey) return 'next';
      if (cat.sub === 'stalk') {
        goTo(cat, prey.x - 12 * (prey.x >= cat.x ? 1 : -1), prey.y, false);
        cat.speed = cat.def.walk * 0.6;
        const r = steer(cat, dt, 4);
        cat.pose = cat.moving ? (Math.floor(cat.anim * 4) % 2 ? 'walk1' : 'watch') : 'watch';
        if (cat.moving) cat.pose = walkPose(cat, false);
        if (r === 'arrived' || dist(cat.x, cat.y, prey.x, prey.y) < 15) { cat.sub = 'crouch'; cat.data.t = 0; cat.face = prey.x >= cat.x ? 1 : -1; }
        if (r === 'stuck') { if (!ball) cat.data.prey = freeSpot(); cat.stuckT = 0; cat.bestD = Infinity; }
      } else if (cat.sub === 'crouch') {
        cat.data.t += dt; cat.pose = 'stand';
        if (cat.data.t > 0.7) { cat.sub = 'pounce'; cat.data.t = 0; }
      } else if (cat.sub === 'pounce') {
        cat.data.t += dt; cat.pose = cat.data.t < 0.35 ? 'pounce' : 'bat';
        cat.hz = Math.sin(Math.min(1, cat.data.t / 0.35) * Math.PI) * 4;
        if (cat.data.t > 0.35 && !cat.data.hit) {
          cat.data.hit = true;
          if (ball) { ball.vx = cat.face * rand(30, 70); ball.vy = rand(-35, 35); ball.vz = rand(20, 40); sayFrom(cat, 'play', 0.3); emote(cat, 'star', 0.8); }
          else cat.data.prey = freeSpot();
        }
        if (cat.data.t > 0.9) { cat.sub = 'stalk'; cat.data.hit = false; cat.hz = 0; }
      }
      cat.needs.energy = clamp(cat.needs.energy - 0.008 * dt, 0, 1);
      if (cat.t > cat.dur) return 'next';
    },
    sleep(cat, dt) {
      if (cat.sub === 'go' || cat.sub === 'detour') {
        const r = steer(cat, dt, 3);
        cat.pose = cat.moving ? walkPose(cat, false) : 'stand';
        if (cat.sub === 'detour' && r !== 'moving') { cat.sub = 'go'; cat.target = cat.data.dest; cat.stuckT = 0; cat.bestD = Infinity; }
        else if (r === 'arrived') { cat.sub = 'zz'; cat.t = 0; }
        else if (r === 'stuck') {
          // take a detour via a random free spot, then try the cozy spot again
          if (++cat.data.tries <= 4) { cat.sub = 'detour'; cat.target = freeSpot(); cat.stuckT = 0; cat.bestD = Infinity; }
          else { cat.sub = 'zz'; cat.t = 0; }
        }
        return;
      }
      cat.pose = 'sleep';
      if (!cat.emote || cat.emote.type !== 'z') emote(cat, 'z', 1e9);
      cat.needs.energy = clamp(cat.needs.energy + 0.035 * dt, 0, 1);
      if (cat.t > cat.dur) { cat.emote = null; return 'next'; }
    },
    groom(cat) { cat.pose = Math.floor(cat.t * 3) % 2 ? 'groom1' : 'groom2'; if (cat.t > cat.dur) return 'next'; },
    stretch(cat) { cat.pose = cat.t < 0.3 ? 'stand' : 'stretch'; if (cat.t > cat.dur) return 'next'; },
    eat(cat, dt) {
      const b = cat.data.bowl;
      if (!b || bowls.indexOf(b) < 0) return 'next';
      if (cat.sub === 'go') {
        const r = steer(cat, dt, 3);
        cat.pose = cat.moving ? walkPose(cat, cat.name === 'Bosch' && cat.needs.hunger > 0.6) : 'stand';
        if (r === 'arrived' || r === 'stuck') {
          if (dist(cat.x, cat.y, b.x, b.y) > 16) return 'next';
          cat.sub = 'eat'; cat.t = 0; cat.face = b.x >= cat.x ? 1 : -1;
          cat.data.min = 4.5 + cat.needs.hunger * 3; sayFrom(cat, 'eat', 0.4);
        }
        return;
      }
      cat.pose = Math.floor(cat.t * 2.5) % 2 ? 'eat' : 'stand';
      if (cat.pose === 'stand' && Math.floor(cat.t * 2.5) % 4 !== 1) cat.pose = 'eat';
      cat.needs.hunger = clamp(cat.needs.hunger - 0.09 * dt, 0, 1);
      if (cat.t > cat.data.min) {
        b.servings = Math.max(0, b.servings - 1);
        b.eater = null;
        emote(cat, 'heart', 1.2);
        return 'next';
      }
    },
    watch(cat, dt) {
      if (cat.sub === 'go') {
        const r = steer(cat, dt, 3);
        cat.pose = cat.moving ? walkPose(cat, false) : 'stand';
        if (r !== 'moving') { cat.sub = 'look'; cat.t = 0; sayFrom(cat, 'watch', 0.25); }
        return;
      }
      cat.pose = 'watch';
      if (Math.random() < dt * 0.15) emote(cat, 'spark', 0.8);
      if (cat.t > cat.dur) return 'next';
    },
    beg(cat, dt) {
      if (cat.sub === 'go') {
        const r = steer(cat, dt, 3);
        cat.pose = cat.moving ? walkPose(cat, false) : 'stand';
        if (r !== 'moving') { cat.sub = 'beg'; cat.t = 0; cat.face = 1; sayFrom(cat, 'beg', 0.8); }
        return;
      }
      cat.pose = Math.floor(cat.t * 2) % 3 === 0 ? 'sitPaw' : 'sit';
      if (cat.t > 3 && Math.random() < dt * 0.2) sayFrom(cat, 'beg', 1);
      if (cat.t > cat.dur || cat.needs.hunger < 0.2) return 'next';
    },
    follow(cat, dt) {
      const cl = ctxCache.claude;
      if (!cl) return 'next';
      if (!cl.moving) { cat.data.still = (cat.data.still || 0) + dt; if (cat.data.still > 1.5) return 'next'; } else cat.data.still = 0;
      const d = dist(cat.x, cat.y, cl.x, cl.y);
      if (d > 14) { goTo(cat, cl.x - 12 * (cl.face || 1), cl.y + 3, d > 50); const r = steer(cat, dt, 4); cat.pose = cat.moving ? walkPose(cat, cat.speed > cat.def.walk) : 'sit'; if (r === 'stuck') return 'next'; }
      else { cat.moving = false; cat.pose = 'sit'; cat.face = cl.x >= cat.x ? 1 : -1; }
      if (cat.t > cat.dur) return 'next';
    },
    roll(cat) { cat.pose = Math.floor(cat.t * 3) % 2 ? 'roll' : 'sitEyes'; if (cat.t > cat.dur) return 'next'; },
    fight(cat, dt) {
      const p = cat.data.partner;
      if (!p || p.state !== 'fight') return 'next';
      if (!cat.data.lead) { cat.pose = cat.sub === 'puff' ? 'puff' : 'stand'; cat.face = p.x >= cat.x ? 1 : -1; return; }
      if (cat.sub === 'approach') {
        cat.target = nearestFree(p.x - 12 * (p.x >= cat.x ? 1 : -1), p.y);
        cat.speed = cat.def.run * 0.7;
        const r = steer(cat, dt, 3);
        cat.pose = cat.moving ? walkPose(cat, true) : 'stand';
        if (r !== 'moving' || dist(cat.x, cat.y, p.x, p.y) < 16) {
          cat.sub = 'puff'; p.sub = 'puff'; cat.data.t = 0;
          cat.face = p.x >= cat.x ? 1 : -1; p.face = -cat.face;
          emote(cat, 'anger', 1); emote(p, 'anger', 1);
        }
        if (cat.t > 8) { finishFight(cat, p); return; }
      } else if (cat.sub === 'puff') {
        cat.data.t += dt; cat.pose = 'puff';
        if (cat.data.t > 0.9) {
          cat.sub = 'cloud'; p.sub = 'cloud'; cat.data.t = 0; cat.hidden = true; p.hidden = true;
          fx.push({ x: (cat.x + p.x) / 2, y: Math.max(cat.y, p.y), t: 0, ttl: 2.1 });
        }
      } else if (cat.sub === 'cloud') {
        cat.data.t += dt;
        if (cat.data.t > 2.1) finishFight(cat, p);
      }
    },
    pet(cat, dt) {
      const d = cat.data;
      if (d.step < d.plan.length) {
        const [pose, len] = d.plan[d.step];
        cat.pose = pose === 'squirm' ? (Math.floor(cat.t * 8) % 2 ? 'roll' : 'puff') : pose;
        d.stepT += dt;
        if (Math.random() < dt * 1.5) emote(cat, 'heart', 1);
        if (d.stepT > len) { d.step++; d.stepT = 0; }
        return;
      }
      if (claudeJob && claudeJob.kind === 'pet' && claudeJob.cat === cat && claudeJob.active && cat.name === 'Bosch') {
        cat.pose = 'sitEyes'; return; // keeps purring while Claude pets
      }
      if (cat.name === 'Bosch') { setState(cat, 'beg'); if (cat.state !== 'beg') setState(cat, 'sit'); return; }
      if (cat.name === 'Ingca') { setState(cat, 'wander', { run: true, to: farSpot(cat) }); return; }
      if (d.leave) { setState(cat, 'wander', { to: farSpot(cat) }); return; }
      return 'next';
    },
    wandplay(cat, dt) {
      const w = ctxCache.wand;
      if (!w || !claudeJob || !claudeJob.active) return 'next';
      cat.target = nearestFree(w.x, w.y + 4);
      cat.speed = cat.def.run * 0.8;
      steer(cat, dt, 4);
      const close = dist(cat.x, cat.y, w.x, w.y + 4) < 10;
      cat.pose = cat.moving ? walkPose(cat, true) : (Math.floor(cat.t * 4) % 2 ? 'bat' : 'pounce');
      if (close) { cat.face = w.x >= cat.x ? 1 : -1; cat.hz = Math.abs(Math.sin(cat.t * 6)) * 3; } else cat.hz = 0;
      cat.needs.energy = clamp(cat.needs.energy - 0.01 * dt, 0, 1);
      cat.needs.love = clamp(cat.needs.love + 0.01 * dt, 0, 1);
    },
  };

  function farSpot(cat) {
    let best = null, bd = -1;
    for (let i = 0; i < 10; i++) { const s = freeSpot(); const d = dist(cat.x, cat.y, s.x, s.y); if (d > bd) { bd = d; best = s; } }
    return best;
  }

  function finishFight(a, b) {
    fightCooldownUntil = now + rand(50, 100);
    for (const c of [a, b]) {
      c.hidden = false;
      c.data.partner = null;
      c.state = 'sit';
    }
    setState(a, 'wander', { run: true, to: farSpot(a), force: true });
    setState(b, 'wander', { run: true, to: farSpot(b), force: true });
    emote(a, 'star', 1.2); emote(b, 'star', 1.2);
  }

  // ---------------------------------------------------------------- decision
  function chooseNext(cat) {
    if (cat.reserved) { setState(cat, 'sit'); cat.dur = 1; cat.pose = 'sit'; return; }
    const h = ctxCache.hour, n = cat.needs, w = cat.def.weights;
    const cl = ctxCache.claude;
    const weights = {};
    for (const s of STATES) {
      let v = w[s] || 0;
      switch (s) {
        case 'sleep':
          v *= 0.4 + (1 - n.energy) * 3;
          if (isNight(h)) v *= 2.5;
          if (isDeepNight(h)) v *= 2;
          if (cat.name === 'Makita' && isNight(h)) v *= 3;
          break;
        case 'zoomies':
          v *= n.energy * 1.4;
          if (cat.name === 'Ingca' && (h >= 21 || h < 2)) v *= 3;
          break;
        case 'play': v *= 0.3 + n.energy; if (ball) v *= 1.3; break;
        case 'eat': v *= n.hunger * 2.5 + 0.1; if (n.hunger < 0.25 && cat.name !== 'Bosch') v *= 0.2; break;
        case 'beg': v *= n.hunger * 2; break;
        case 'follow': if (!cl || !cl.moving) v = 0; break;
        case 'fight': if (now < fightCooldownUntil) v = 0; v *= n.energy; break;
        case 'roll': v *= 0.5 + n.love; break;
        case 'groom': if (n.energy < 0.2) v *= 0.5; break;
      }
      if (s === cat.lastState || s === cat.state) v *= 0.15;
      if (s !== 'fight' && !enterFree(cat, s)) v = 0;
      if (s === 'eat' && !usableBowl(cat)) {
        // Bosch can shove another cat off the bowl
        if (cat.name === 'Bosch' && bowls.some((b) => b.servings > 0 && b.eater && b.eater !== cat)) v = w.eat * n.hunger * 2;
        else v = 0;
      }
      weights[s] = Math.max(0, v);
    }
    // fight needs a willing target
    let fightTarget = null;
    if (weights.fight > 0) {
      const cands = others(cat).filter((c) => ['sit', 'wander', 'groom', 'watch', 'roll'].includes(c.state) && !c.reserved);
      fightTarget = cands.length ? pick(cands) : null;
      if (!fightTarget || others(cat).some((c) => LOUD.has(c.state))) weights.fight = 0;
    }
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total, choice = 'sit';
    for (const k in weights) { r -= weights[k]; if (r <= 0) { choice = k; break; } }

    if (choice === 'eat' && !usableBowl(cat) && cat.name === 'Bosch') {
      const b = bowls.find((x) => x.servings > 0 && x.eater && x.eater !== cat);
      if (b) {
        const victim = b.eater;
        setState(victim, 'wander', { to: farSpot(victim), force: true });
        emote(victim, 'anger', 1.2); say(victim, 'Hey!');
        sayFrom(cat, 'shove', 1);
      }
    }
    if (choice === 'fight' && fightTarget) {
      setState(cat, 'fight', { partner: fightTarget, lead: true });
      if (cat.state === 'fight') setState(fightTarget, 'fight', { partner: cat, lead: false, force: true });
      return;
    }
    setState(cat, choice);
    if (cat.state === 'sit' && Math.random() < 0.15) sayFrom(cat, 'misc', 1);
  }

  // ---------------------------------------------------------------- props
  function updateProps(dt) {
    for (const b of bowls) {
      if (b.home) {
        if (b.servings < 3) { b.regen += dt; if (b.regen >= 45) { b.regen = 0; b.servings++; } } else b.regen = 0;
      }
    }
    bowls = bowls.filter((b) => b.home || b.servings > 0 || (b.emptyT = (b.emptyT || 0) + dt) < 3);
    for (const c of cats) if (c.data.bowl && bowls.indexOf(c.data.bowl) < 0 && c.state === 'eat') setState(c, 'sit');
    if (ball) {
      ball.z += ball.vz * dt; ball.vz -= 140 * dt;
      if (ball.z < 0) { ball.z = 0; ball.vz = Math.abs(ball.vz) > 12 ? -ball.vz * 0.5 : 0; }
      const nx = ball.x + ball.vx * dt, ny = ball.y + ball.vy * dt;
      if (isFree(nx, ball.y)) ball.x = nx; else ball.vx = -ball.vx * 0.7;
      if (isFree(ball.x, ny)) ball.y = ny; else ball.vy = -ball.vy * 0.7;
      const fr = Math.pow(ball.z > 0 ? 0.9 : 0.35, dt);
      ball.vx *= fr; ball.vy *= fr;
      ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.3;
    }
    for (const f of fx) f.t += dt;
    fx = fx.filter((f) => f.t < f.ttl);
  }

  // ---------------------------------------------------------------- public API
  const Cats = {
    get list() { return cats; },
    get bowls() { return bowls; },
    get ball() { return ball; },
    LABELS, EXCLUSIVE, LOUD,

    init(opts) {
      W = opts.W || 240; H = opts.H || 176;
      bounds = { x0: 10, x1: W - 10, y0: 48, y1: H - 6 };
      staticBlocks = (opts.obstacles || []).map((r) => inflate(r, 8, 2, 3));
      setDesks(opts.desks || [opts.mainDesk]);
      const md = opts.mainDesk;
      const wins = opts.windows || [];
      spots = {
        lamp: nearestFree(md.x + 44, md.y + 24),
        beg: nearestFree(md.x - 14, md.y + 32),
        windows: wins.map((w) => nearestFree(w.x + w.w / 2, 50)),
        sun: nearestFree((wins[0] ? wins[0].x + wins[0].w / 2 : 60) + 4, 56),
        cozy1: nearestFree(14, 120),
        cozy2: nearestFree(226, 120),
      };
      bowls = [{ x: (opts.homeBowl || { x: 76 }).x, y: (opts.homeBowl || { y: 60 }).y, servings: 3, home: true, regen: 0, eater: null }];
      ball = { x: 160, y: 132, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };
      const b0 = nearestFree(ball.x, ball.y); ball.x = b0.x; ball.y = b0.y;
      frames = DEFS.map(buildFrames);
      cats = DEFS.map(makeCat);
      cats.forEach((c, i) => { c.frames = frames[i]; });
      return Cats;
    },

    update(dt, t, ctx) {
      now = t;
      ctxCache = Object.assign(ctxCache, ctx || {});
      if (ctx && ctx.desks) setDesks(ctx.desks);
      updateProps(dt);
      for (const cat of cats) {
        cat.t += dt; cat.anim += dt;
        const d = cat.def;
        cat.needs.hunger = clamp(cat.needs.hunger + d.hungerRate * dt, 0, 1);
        if (cat.state !== 'sleep') cat.needs.energy = clamp(cat.needs.energy - d.energyRate * 0.5 * dt, 0, 1);
        cat.needs.love = clamp(cat.needs.love - 0.003 * dt, 0, 1);
        if (cat.emote) { cat.emote.ttl -= dt; if (cat.emote.ttl <= 0) cat.emote = null; }
        if (cat.bubble) { cat.bubble.ttl -= dt; if (cat.bubble.ttl <= 0) cat.bubble = null; }
        cat.nextChatter -= dt;
        if (cat.nextChatter <= 0) {
          cat.nextChatter = rand(25, 60);
          if (cat.state === 'beg' || (cat.name === 'Bosch' && cat.needs.hunger > 0.7)) sayFrom(cat, 'beg', 0.8);
          else if (cat.state !== 'sleep') sayFrom(cat, 'misc', 0.35);
        }
        const fn = updateState[cat.state];
        const res = fn ? fn(cat, dt) : (cat.t > cat.dur ? 'next' : undefined);
        if (res === 'next') chooseNext(cat);
        // safety: never rest inside an obstacle
        if (!isFree(cat.x, cat.y)) { const s = nearestFree(cat.x, cat.y); cat.x = s.x; cat.y = s.y; }
      }
    },

    // ---- drawing (world resolution)
    drawFloor(g) {
      for (const b of bowls) {
        const x = Math.round(b.x), y = Math.round(b.y);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x - 5, y, 11, 2);
        g.fillStyle = '#241c22'; g.fillRect(x - 5, y - 4, 11, 5);
        g.fillStyle = b.home ? '#5b8dd9' : '#d95b8d'; g.fillRect(x - 4, y - 3, 9, 3);
        g.fillStyle = b.home ? '#3f6cb3' : '#b33f6d'; g.fillRect(x - 4, y - 1, 9, 1);
        if (b.servings > 0) {
          g.fillStyle = '#a0603a'; g.fillRect(x - 3, y - 4, 7, 1);
          if (b.servings > 1) { g.fillStyle = '#c07a4a'; g.fillRect(x - 2, y - 5, 5, 1); }
          if (b.servings > 2) { g.fillStyle = '#a0603a'; g.fillRect(x - 1, y - 6, 3, 1); }
        }
      }
      if (ball) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(Math.round(ball.x) - 2, Math.round(ball.y), 5, 1); }
    },

    drawables() {
      const list = [];
      for (const cat of cats) {
        if (cat.hidden) continue;
        list.push({
          y: cat.y, kind: 'cat', name: cat.name, draw(g) {
            const fr = (cat.face > 0 ? cat.frames.right : cat.frames.left)[cat.pose] || cat.frames.right.stand;
            g.fillStyle = 'rgba(0,0,0,0.18)';
            g.fillRect(Math.round(cat.x) - 6, Math.round(cat.y), 12, 1);
            g.drawImage(fr, Math.round(cat.x - FW / 2), Math.round(cat.y - FH + 1 - cat.hz));
          },
        });
      }
      if (ball) {
        list.push({
          y: ball.y, kind: 'ball', draw(g) {
            const x = Math.round(ball.x) - 2, y = Math.round(ball.y - 4 - ball.z);
            g.fillStyle = '#241c22'; g.fillRect(x, y + 1, 5, 3); g.fillRect(x + 1, y, 3, 5);
            g.fillStyle = '#e8483a'; g.fillRect(x + 1, y + 1, 3, 3);
            g.fillStyle = Math.floor(ball.spin) % 2 ? '#ffd84a' : '#ffffff'; g.fillRect(x + 1 + (Math.floor(ball.spin) % 2), y + 2, 1, 1);
          },
        });
      }
      return list;
    },

    drawTop(g, t) {
      for (const cat of cats) {
        if (!cat.emote || cat.hidden) continue;
        const x = Math.round(cat.x) + 4 * cat.face, bob = Math.round(Math.sin(t * 4) * 1);
        const y = Math.round(cat.y - FH - 5 - cat.hz) + bob;
        drawEmote(g, cat.emote.type, x, y, t);
      }
      for (const f of fx) drawCloud(g, f, t);
    },

    // speech bubbles for game.js to draw at display resolution (world coords)
    bubbles() {
      const out = [];
      for (const cat of cats) {
        if (cat.bubble && !cat.hidden) out.push({ x: cat.x, y: cat.y - FH - 2 - cat.hz, text: cat.bubble.text, color: cat.def.color, name: cat.name });
      }
      return out;
    },

    hitTest(x, y) {
      let best = null;
      for (const cat of cats) {
        if (cat.hidden) continue;
        if (x >= cat.x - 9 && x <= cat.x + 9 && y >= cat.y - FH && y <= cat.y + 2) {
          if (!best || cat.y > best.y) best = cat;
        }
      }
      return best ? best.name : null;
    },

    get(name) { return cats.find((c) => c.name === name) || null; },

    pet(name, by) {
      const cat = this.get(name);
      if (!cat || cat.state === 'fight') return false;
      setState(cat, 'pet', { by: by || 'user', force: true });
      return true;
    },

    dropFood(x, y) {
      const s = nearestFree(x, y);
      const temp = bowls.filter((b) => !b.home);
      if (temp.length >= 2) bowls.splice(bowls.indexOf(temp[0]), 1);
      bowls.push({ x: s.x, y: s.y, servings: 3, home: false, eater: null });
      return s;
    },

    tossToy(x, y) {
      const s = nearestFree(x, y);
      ball = { x: s.x, y: s.y, z: 18, vx: rand(-30, 30), vy: rand(-20, 20), vz: 30, spin: 0 };
      return s;
    },

    // ---- Claude's free-time cat activities
    wants() {
      const hungry = Math.max(...cats.map((c) => c.needs.hunger));
      const begging = cats.some((c) => c.state === 'beg');
      const home = bowls.find((b) => b.home);
      const lonely = cats.reduce((a, c) => a + (1 - c.needs.love), 0) / cats.length;
      const ingca = this.get('Ingca');
      return {
        pet: 0.6 + lonely * 1.5,
        wand: 0.4 + (ingca ? ingca.needs.energy : 0.5),
        feed: (home && home.servings >= 3) ? 0.1 : 0.4 + hungry * 2.5 + (begging ? 3 : 0),
      };
    },

    // Returns where Claude should stand for this activity, or null. `reach(x,y)` tells which spots Claude can walk to.
    planClaude(kind, reach) {
      const ok = (s) => s && (!reach || reach(s.x, s.y));
      if (kind === 'feed') {
        const b = bowls.find((x) => x.home);
        const s = { x: b.x - 12, y: b.y + 1, face: 1, cat: null };
        return ok(s) ? s : null;
      }
      if (kind === 'pet') {
        const cands = cats.filter((c) => !['fight', 'zoomies', 'eat', 'pet', 'wandplay'].includes(c.state) && !c.reserved);
        for (const c of cands.sort(() => Math.random() - 0.5)) {
          for (const side of [-1, 1]) {
            const s = { x: c.x + side * 12, y: c.y + 1, face: -side, cat: c.name };
            if (ok(s)) return s;
          }
        }
        return null;
      }
      if (kind === 'wand') {
        const c = cats.find((x) => !['fight', 'eat', 'pet', 'sleep'].includes(x.state) && !x.reserved && x.name === 'Ingca') ||
          cats.find((x) => !['fight', 'eat', 'pet', 'sleep'].includes(x.state) && !x.reserved);
        if (!c) return null;
        for (const s of [{ x: 64, y: 86 }, { x: 170, y: 84 }, { x: 40, y: 72 }]) if (ok(s)) return { x: s.x, y: s.y, face: 1, cat: c.name };
        return null;
      }
      return null;
    },

    reserve(kind, name) {
      claudeJob = { kind, cat: name ? this.get(name) : null, active: false };
      if (claudeJob.cat && kind === 'pet') {
        const c = claudeJob.cat;
        if (c.state !== 'fight') { c.reserved = true; if (c.state !== 'sleep') setState(c, 'sit', { force: true }); c.dur = 999; }
      }
    },

    claudeBegin(kind) {
      if (!claudeJob) claudeJob = { kind, cat: null, active: false };
      claudeJob.active = true;
      const c = claudeJob.cat;
      if (kind === 'pet' && c && c.state !== 'fight') { c.reserved = false; this.pet(c.name, 'claude'); }
      if (kind === 'wand' && c && c.state !== 'fight') setState(c, 'wandplay', { force: true });
      if (kind === 'feed') {
        const b = bowls.find((x) => x.home);
        if (b) { b.servings = 3; b.regen = 0; }
      }
    },

    claudeEnd() {
      if (claudeJob && claudeJob.cat) {
        const c = claudeJob.cat;
        c.reserved = false;
        if (c.state === 'wandplay') { setState(c, 'sit', { force: true }); emote(c, 'star', 1); }
        if (c.state === 'sit' && c.dur === 999) c.dur = 1;
      }
      claudeJob = null;
    },

    claudeBusy() { return !!claudeJob; },

    roster() {
      return cats.map((c) => ({
        name: c.name, color: c.def.color, trait: c.def.trait,
        activity: LABELS[c.state] || c.state,
        energy: c.needs.energy, tummy: 1 - c.needs.hunger, love: c.needs.love,
      }));
    },

    // test helpers
    isFree, blocks: () => blocks, bounds: () => bounds, spots: () => spots,
  };

  // ---------------------------------------------------------------- emotes & fight cloud
  const EMOTES = {
    heart: ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'],
    z: ['bbbb', '..b.', '.b..', 'bbbb'],
    anger: ['r.r', '.r.', 'r.r'],
    star: ['..y..', '.yyy.', 'yyyyy', '.y.y.'],
    spark: ['.w.', 'www', '.w.'],
  };
  const EMOTE_COL = { r: '#e8483a', b: '#5b8dd9', y: '#ffd84a', w: '#ffffff' };
  function drawEmote(g, type, x, y, t) {
    const m = EMOTES[type];
    if (!m) return;
    if (type === 'z') {
      // stacked rising z's
      for (let i = 0; i < 2; i++) {
        const ph = (t * 0.7 + i * 0.5) % 1;
        drawMap(g, m, x + i * 3, Math.round(y + 2 - ph * 6), 0.4 + (1 - ph) * 0.6);
      }
      return;
    }
    drawMap(g, m, x - (m[0].length >> 1), y, 1);
  }
  function drawMap(g, m, x, y, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = '#241c22';
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c] !== '.') g.fillRect(x + c - 1, y + r, 3, 1), g.fillRect(x + c, y + r - 1, 1, 3);
    for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
      const ch = m[r][c];
      if (ch === '.') continue;
      g.fillStyle = EMOTE_COL[ch]; g.fillRect(x + c, y + r, 1, 1);
    }
    g.globalAlpha = 1;
  }
  function drawCloud(g, f, t) {
    const cx = Math.round(f.x), cy = Math.round(f.y - 7);
    const puffs = 7;
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * Math.PI * 2 + t * 5;
      const r = 4 + ((i * 3 + Math.floor(t * 10)) % 3);
      const px = cx + Math.cos(a) * 7, py = cy + Math.sin(a) * 4;
      g.fillStyle = '#241c22'; g.beginPath(); g.arc(px, py, r + 1, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * Math.PI * 2 + t * 5;
      const r = 4 + ((i * 3 + Math.floor(t * 10)) % 3);
      const px = cx + Math.cos(a) * 7, py = cy + Math.sin(a) * 4;
      g.fillStyle = i % 2 ? '#f4efe6' : '#e0d6c8'; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    }
    // flailing paws and stars
    const k = Math.floor(t * 8);
    g.fillStyle = '#241c22';
    g.fillRect(cx - 10 + (k % 3) * 2, cy - 2 + (k % 2) * 3, 2, 2);
    g.fillRect(cx + 8 - (k % 2) * 2, cy + 1 - (k % 3), 2, 2);
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.1;
      drawMap(g, EMOTES.star, Math.round(cx + Math.cos(a) * 12) - 2, Math.round(cy - 6 + Math.sin(a) * 4), 1);
    }
  }

  window.Cats = Cats;
})();
