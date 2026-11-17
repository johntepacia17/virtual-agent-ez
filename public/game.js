// Pixel Office: renderer, state sync (SSE), Claude's free time, clock/sky/lamps, UI.
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const W = 240, H = 176;
  const MAIN_DESK = { x: 104, y: 48 };
  const HELPER_DESKS = [];
  for (const y of [96, 140]) for (const x of [24, 104, 184]) HELPER_DESKS.push({ x, y });
  const ALL_DESKS = [MAIN_DESK, ...HELPER_DESKS];
  const DOOR = { x: 6, y: 24 };
  const DOOR_SPOT = { x: DOOR.x + 8, y: 44 };
  const GUTTER_X = 14;
  const CLAUDE_AISLE = 86;
  const WALK_SPEED = 42;
  const WINDOWS = [{ x: 34, y: 7, w: 34, h: 22 }, { x: 170, y: 7, w: 34, h: 22 }];
  const CLOCK = { x: 120, y: 16, r: 8 };
  const RACK = { x: 150, y: 15 };
  const SHELF = { x: 212, y: 12 };
  const POSTER = { x: 86, y: 11 };
  const PLANT = { x: 224, y: 56 };
  const HOME_BOWL = { x: 78, y: 60 };
  const IDLE_BEFORE_FUN = 5;
  const MAX_DT = 0.5;

  const seatOf = (d) => ({ x: d.x + 10, y: d.y + 28 });
  const aisleOf = (d) => d.y + 32;

  const params = new URLSearchParams(location.search);

  // ---------------------------------------------------------------- DOM
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const display = $('screen');
  const dg = display.getContext('2d');
  const world = document.createElement('canvas');
  world.width = W; world.height = H;
  const wg = world.getContext('2d');
  wg.imageSmoothingEnabled = false;

  Sprites.init();
  const BG = Sprites.background(W, H, { door: { x: DOOR.x, y: DOOR.y - 14 }, shelf: SHELF, poster: POSTER });

  // Cats.init must run before the roster DOM is built.
  Cats.init({
    wg, W, H, mainDesk: MAIN_DESK, windows: WINDOWS, desks: ALL_DESKS, homeBowl: HOME_BOWL,
    obstacles: [{ x: PLANT.x, y: PLANT.y + 6, w: 12, h: 8 }],
  });

  // ---------------------------------------------------------------- clock
  let TZ = params.get('tz') || 'Asia/Singapore';
  let fmt;
  try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  catch (_) { TZ = 'Asia/Singapore'; fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  let clockOffset = 0;

  function clockParts(ms) {
    const o = { h: 0, m: 0, s: 0 };
    for (const p of fmt.formatToParts(new Date(ms))) {
      if (p.type === 'hour') o.h = Number(p.value) % 24;
      else if (p.type === 'minute') o.m = Number(p.value);
      else if (p.type === 'second') o.s = Number(p.value);
    }
    o.frac = o.h + o.m / 60 + o.s / 3600 + (ms % 1000) / 3600000;
    return o;
  }
  function nowClock() { return clockParts(Date.now() + clockOffset); }
  if (params.has('hour')) {
    const target = parseFloat(params.get('hour'));
    if (isFinite(target)) {
      const cur = nowClock().frac;
      clockOffset = ((((target - cur) % 24) + 24) % 24) * 3600000;
    }
  }

  function phaseOf(h) {
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 11) return 'morning';
    if (h >= 11 && h < 15) return 'daytime';
    if (h >= 15 && h < 17) return 'afternoon';
    if (h >= 17 && h < 19) return 'sunset';
    return 'night';
  }

  function lampLevel(h) {
    if (h >= 7 && h < 17) return 0;
    if (h >= 17 && h < 18.5) return (h - 17) / 1.5;
    if (h >= 5.5 && h < 7) return 1 - (h - 5.5) / 1.5;
    return 1;
  }

  const SKY = [
    [0, '#0b1030', '#1b2350'], [4.5, '#141a40', '#2a2a5a'], [5.5, '#3a3a78', '#c88080'], [6.5, '#6a8ad0', '#f6c49a'],
    [8, '#6fb2f0', '#cfe8ff'], [12, '#4aa3f0', '#a9dcff'], [15, '#5aa6ec', '#b7dcf8'], [16.5, '#6a90d8', '#f6d09a'],
    [17.7, '#5a5aa8', '#f59a5a'], [18.6, '#34306e', '#c0607a'], [19.5, '#161c46', '#33305e'], [21, '#0b1030', '#1b2350'], [24, '#0b1030', '#1b2350'],
  ];
  const TINT = [
    [0, '#6a6ea8'], [4.5, '#76749f'], [5.5, '#b09ab8'], [6.5, '#ead8d0'], [8, '#ffffff'], [15.5, '#ffffff'],
    [17, '#ffe8cc'], [18, '#f2b898'], [19, '#a890b8'], [20.5, '#7478b0'], [24, '#6a6ea8'],
  ];
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  function keyframe(table, h, idx) {
    for (let i = 0; i < table.length - 1; i++) {
      const a = table[i], b = table[i + 1];
      if (h >= a[0] && h < b[0]) return mix(a[idx], b[idx], (h - a[0]) / (b[0] - a[0]));
    }
    return table[0][idx];
  }
  function starLevel(h) {
    if (h >= 20 || h < 4.5) return 1;
    if (h >= 18.6 && h < 20) return (h - 18.6) / 1.4;
    if (h >= 4.5 && h < 6) return 1 - (h - 4.5) / 1.5;
    return 0;
  }

  // ---------------------------------------------------------------- rooms & actors
  const rooms = new Map();
  let currentId = null;
  let pinnedId = null;
  let sessionsList = [];
  let simTime = 0;

  function newActor(o) {
    return Object.assign({
      uid: 0, name: '', kind: 'helper', palette: 0, x: 0, y: 0, dir: 'down', moving: false, path: [],
      speed: WALK_SPEED, status: 'idle', text: '', mode: 'seated', anim: 0, deskIndex: -1, seat: null,
      idleT: 0, fun: null, face: 1,
    }, o);
  }

  function newRoom(id, name) {
    const seat = seatOf(MAIN_DESK);
    const room = {
      id, name,
      claude: newActor({ uid: 'claude', name: 'Claude', kind: 'main', palette: 'claude', x: seat.x, y: seat.y, seat, dir: 'up' }),
      helpers: new Map(),
      deskOwner: new Array(HELPER_DESKS.length).fill(null),
    };
    rooms.set(id, room);
    return room;
  }

  const IDLE_ROOM = '__idle__';
  newRoom(IDLE_ROOM, 'office');
  Object.assign(rooms.get(IDLE_ROOM).claude, { status: 'idle', text: 'Waiting for Claude Code…' });
  currentId = IDLE_ROOM;

  function room() { return rooms.get(currentId) || rooms.get(IDLE_ROOM); }

  function setPath(a, pts) { a.path = pts.map((p) => ({ x: p.x, y: p.y })); a.moving = a.path.length > 0; }

  function moveAlong(a, dt) {
    if (!a.path.length) { a.moving = false; return true; }
    let budget = a.speed * dt;
    while (budget > 0 && a.path.length) {
      const p = a.path[0];
      const dx = p.x - a.x, dy = p.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01) {
        if (Math.abs(dx) > Math.abs(dy)) { a.dir = dx > 0 ? 'right' : 'left'; a.face = dx > 0 ? 1 : -1; }
        else a.dir = dy > 0 ? 'down' : 'up';
      }
      if (d <= budget) { a.x = p.x; a.y = p.y; budget -= d; a.path.shift(); }
      else { a.x += (dx / d) * budget; a.y += (dy / d) * budget; budget = 0; }
    }
    a.moving = a.path.length > 0;
    return !a.moving;
  }

  // ---- helpers
  function addHelper(r, ag) {
    const h = newActor({ uid: ag.uid, name: ag.name, kind: 'helper', palette: ag.palette, x: DOOR_SPOT.x, y: DOOR_SPOT.y, dir: 'down', mode: 'entering' });
    const idx = r.deskOwner.indexOf(null);
    if (idx >= 0) {
      r.deskOwner[idx] = ag.uid;
      h.deskIndex = idx;
      const d = HELPER_DESKS[idx];
      h.seat = seatOf(d);
      setPath(h, [{ x: GUTTER_X, y: DOOR_SPOT.y }, { x: GUTTER_X, y: aisleOf(d) }, { x: h.seat.x, y: aisleOf(d) }, h.seat]);
    } else {
      // overflow: stand in the free area near the door
      const n = r.helpers.size;
      h.seat = { x: 30 + (n % 5) * 14, y: 88 };
      setPath(h, [{ x: GUTTER_X, y: DOOR_SPOT.y }, { x: GUTTER_X, y: 88 }, h.seat]);
    }
    r.helpers.set(ag.uid, h);
    return h;
  }

  function sendHelperHome(r, h) {
    if (h.mode === 'leaving') return;
    h.mode = 'leaving';
    const pts = [];
    if (h.deskIndex >= 0) {
      const d = HELPER_DESKS[h.deskIndex];
      pts.push({ x: h.x, y: aisleOf(d) }, { x: GUTTER_X, y: aisleOf(d) });
    } else pts.push({ x: GUTTER_X, y: h.y });
    pts.push({ x: GUTTER_X, y: DOOR_SPOT.y }, { x: DOOR_SPOT.x, y: DOOR_SPOT.y - 2 });
    setPath(h, pts);
  }

  function updateHelpers(r, dt) {
    for (const h of [...r.helpers.values()]) {
      h.anim += dt;
      const arrived = moveAlong(h, dt);
      if (h.mode === 'entering' && arrived) { h.mode = 'seated'; h.dir = 'up'; }
      if (h.mode === 'leaving' && arrived) {
        if (h.deskIndex >= 0 && r.deskOwner[h.deskIndex] === h.uid) r.deskOwner[h.deskIndex] = null;
        r.helpers.delete(h.uid);
      }
    }
  }

  // ---------------------------------------------------------------- Claude's free time
  const FUN = {
    exercise: { spot: { x: 56, y: 76 }, dir: 'down', dur: 8, lines: ['Jumping jacks! 1, 2…', 'Feel the burn!', 'Hup! Hup! Hup!'] },
    clean: { spot: { x: 160, y: 90 }, dir: 'right', dur: 9, lines: ['Sweep sweep~', 'Tidy desk, tidy mind!', 'Dust bunnies, begone!'] },
    play: { spot: { x: 72, y: 90 }, dir: 'down', dur: 8, lines: ['Catch!', 'Boing, boing!', 'Keepy-uppy!'] },
    meditate: { spot: { x: 34, y: 66 }, dir: 'down', dur: 10, lines: ['Ommm…', 'Inner peace…', 'Breathe in… and out…'] },
    read: { spot: { x: 206, y: 50 }, dir: 'up', dur: 10, lines: ['Ooh, a good book!', 'Just one more chapter…', 'Plot twist!'] },
    water: { spot: { x: 212, y: 70 }, dir: 'right', dur: 7, lines: ['Drink up, little plant!', 'Grow, buddy, grow!'] },
    pet: { cat: true, dur: 7, lines: ['Who\'s a good kitty?', 'Pat pat pat~', 'So fluffy!'] },
    wand: { cat: true, dur: 10, lines: ['Get the feather!', 'Swish swish!', 'Catch it, catch it!'] },
    feed: { cat: true, dur: 5, lines: ['Dinner is served!', 'Nom time, kitties!', 'Who\'s hungry?'] },
  };
  const WALK_LINES = ['Break time!', 'Stretch my legs~', 'Time for fun!', 'Ooh, what to do…'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function claudeReach(x, y) {
    if (x < 10 || x > 230 || y < 46 || y > 94) return false;
    if (y < 84 && x > 92 && x < 146) return false;               // main desk block
    if (x > PLANT.x - 6 && y > PLANT.y - 2 && y < PLANT.y + 18) return false; // plant
    return true;
  }

  function claudeRoute(a, t) {
    return [{ x: a.x, y: CLAUDE_AISLE }, { x: t.x, y: CLAUDE_AISLE }, { x: t.x, y: t.y }];
  }

  function startFun(r) {
    const c = r.claude;
    const wants = Cats.wants();
    const weights = { exercise: 1, clean: 1, play: 1, meditate: 1, read: 1, water: 1, pet: wants.pet, wand: wants.wand, feed: wants.feed };
    if (c.lastFun) weights[c.lastFun] *= 0.15;
    for (let tries = 0; tries < 6; tries++) {
      let total = 0;
      for (const k in weights) total += weights[k];
      let rnd = Math.random() * total, kind = 'exercise';
      for (const k in weights) { rnd -= weights[k]; if (rnd <= 0) { kind = k; break; } }
      const def = FUN[kind];
      let spot = def.spot, cat = null, face = def.dir === 'right' ? 1 : -1, dir = def.dir;
      if (def.cat) {
        if (Cats.claudeBusy()) { weights[kind] = 0; continue; }
        const plan = Cats.planClaude(kind, claudeReach);
        if (!plan) { weights[kind] = 0; continue; }
        spot = { x: plan.x, y: plan.y }; cat = plan.cat; face = plan.face; dir = face > 0 ? 'right' : 'left';
        Cats.reserve(kind, cat);
      }
      c.fun = { kind, spot, cat, face, dir, t: 0, dur: def.dur * (0.8 + Math.random() * 0.5), line: pick(def.lines) };
      c.lastFun = kind;
      c.mode = 'wandering';
      c.funText = pick(WALK_LINES);
      setPath(c, claudeRoute(c, spot));
      return true;
    }
    return false;
  }

  function endFun(r) {
    const c = r.claude;
    if (c.fun && FUN[c.fun.kind].cat) Cats.claudeEnd();
    c.fun = null;
    c.wand = null;
    if (c.mode === 'seated') return;
    c.mode = 'returning';
    setPath(c, [{ x: c.x, y: CLAUDE_AISLE }, { x: c.seat.x, y: CLAUDE_AISLE }, c.seat]);
  }

  function snapClaudeHome(r) {
    const c = r.claude;
    if (c.fun && FUN[c.fun.kind].cat) Cats.claudeEnd();
    c.fun = null; c.wand = null; c.path = []; c.moving = false;
    c.x = c.seat.x; c.y = c.seat.y; c.mode = 'seated'; c.dir = 'up'; c.idleT = 0;
  }

  const isBusy = (s) => s === 'working' || s === 'permission';

  function updateClaude(r, dt, active) {
    const c = r.claude;
    c.anim += dt;
    const helpersHere = r.helpers.size > 0;
    if (!active) { if (c.mode !== 'seated') snapClaudeHome(r); return; }
    const wantsDesk = isBusy(c.status) || helpersHere;

    if ((c.mode === 'wandering' || c.mode === 'activity') && wantsDesk) endFun(r);

    switch (c.mode) {
      case 'seated':
        c.dir = 'up';
        if (!wantsDesk) {
          c.idleT += dt;
          if (c.idleT > IDLE_BEFORE_FUN) { c.idleT = -6 - Math.random() * 8; if (!startFun(r)) c.idleT = 0; }
        } else c.idleT = 0;
        break;
      case 'wandering':
        if (moveAlong(c, dt)) {
          c.mode = 'activity';
          c.fun.t = 0;
          c.dir = c.fun.dir; c.face = c.fun.face;
          if (FUN[c.fun.kind].cat) Cats.claudeBegin(c.fun.kind);
        }
        break;
      case 'activity': {
        const f = c.fun;
        f.t += dt;
        if (f.kind === 'clean') {
          const nx = f.spot.x + Math.sin(f.t * 1.4) * 14;
          c.face = nx >= c.x ? 1 : -1; c.dir = c.face > 0 ? 'right' : 'left';
          c.x = nx;
        }
        if (f.kind === 'wand') {
          c.wand = {
            x: c.x + c.face * (16 + Math.sin(f.t * 2.1) * 9),
            y: c.y - 1 + Math.sin(f.t * 4.3) * 5,
          };
        }
        if (f.t > f.dur) endFun(r);
        break;
      }
      case 'returning':
        if (moveAlong(c, dt)) { c.mode = 'seated'; c.dir = 'up'; c.idleT = Math.min(c.idleT, 0); }
        break;
    }
  }

  // ---------------------------------------------------------------- SSE sync
  const connDot = $('conn');
  const tabsEl = $('tabs');
  const logEl = $('log');
  let es = null;

  function connect() {
    try { es = new EventSource('/stream'); } catch (_) { return; }
    es.onopen = () => { connDot.classList.add('on'); connDot.title = 'Connected'; };
    es.onerror = () => { connDot.classList.remove('on'); connDot.title = 'Disconnected (retrying…)'; };
    es.addEventListener('state', (e) => { try { applyState(JSON.parse(e.data)); } catch (err) { console.error(err); } });
    es.addEventListener('log', (e) => { try { addLog(JSON.parse(e.data)); } catch (_) { /* ignore */ } });
  }

  function applyState(snap) {
    sessionsList = snap.sessions || [];
    const seen = new Set();
    for (const s of sessionsList) {
      seen.add(s.id);
      const r = rooms.get(s.id) || newRoom(s.id, s.name);
      r.name = s.name;
      r.lastSeen = s.lastSeen;
      const present = new Set();
      for (const ag of s.agents) {
        if (ag.kind === 'main') {
          r.claude.status = ag.status; r.claude.text = ag.text;
          continue;
        }
        present.add(ag.uid);
        let h = r.helpers.get(ag.uid);
        if (!h) h = addHelper(r, ag);
        h.status = ag.status; h.text = ag.text; h.name = ag.name;
        if (ag.leaving || ag.status === 'done') {
          if (!h.leaveAt) h.leaveAt = simTime + 1.6;
        }
      }
      for (const h of r.helpers.values()) {
        if (!present.has(h.uid)) { if (h.mode !== 'leaving') { h.status = 'done'; sendHelperHome(r, h); } }
      }
    }
    for (const id of [...rooms.keys()]) if (id !== IDLE_ROOM && !seen.has(id)) rooms.delete(id);
    chooseRoom();
    renderTabs();
  }

  function chooseRoom() {
    const prev = currentId;
    if (pinnedId && rooms.has(pinnedId)) currentId = pinnedId;
    else {
      pinnedId = null;
      const real = sessionsList.slice().sort((a, b) => b.lastSeen - a.lastSeen);
      currentId = real.length ? real[0].id : IDLE_ROOM;
    }
    if (prev !== currentId && rooms.has(prev)) snapClaudeHome(rooms.get(prev));
  }

  function renderTabs() {
    const sig = sessionsList.map((s) => s.id + ':' + s.name).join('|') + '#' + currentId;
    if (tabsEl.dataset.sig === sig) return;
    tabsEl.dataset.sig = sig;
    tabsEl.innerHTML = '';
    if (!sessionsList.length) {
      const span = document.createElement('span');
      span.className = 'tab empty'; span.textContent = 'no sessions';
      tabsEl.appendChild(span);
      return;
    }
    const seenNames = {};
    for (const s of sessionsList) {
      const b = document.createElement('button');
      b.className = 'tab' + (s.id === currentId ? ' active' : '');
      const base = s.name || 'session';
      seenNames[base] = (seenNames[base] || 0) + 1;
      b.textContent = seenNames[base] > 1 ? `${base} #${seenNames[base]}` : base;
      b.title = 'Session ' + s.id;
      b.onclick = () => { pinnedId = s.id; chooseRoom(); renderTabs(); };
      tabsEl.appendChild(b);
    }
  }

  const logFmt = (() => {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
    catch (_) { return null; }
  })();
  function addLog(line) {
    const li = document.createElement('li');
    const t = logFmt ? logFmt.format(new Date(line.t + clockOffset)) : '';
    const who = line.who || '';
    li.innerHTML = '';
    const ts = document.createElement('span'); ts.className = 'lt'; ts.textContent = t;
    const wh = document.createElement('span'); wh.className = 'lw'; wh.textContent = who;
    const tx = document.createElement('span'); tx.className = 'lx'; tx.textContent = line.text;
    li.append(ts, wh, tx);
    if (sessionsList.length > 1 && line.sessionName) li.title = line.sessionName;
    logEl.prepend(li);
    while (logEl.children.length > 60) logEl.lastChild.remove();
  }

  // ---------------------------------------------------------------- simulation
  function simulate(dt) {
    simTime += dt;
    const cur = room();
    for (const r of rooms.values()) {
      for (const h of r.helpers.values()) {
        if (h.leaveAt && simTime >= h.leaveAt && h.mode !== 'leaving' && h.mode !== 'entering') sendHelperHome(r, h);
        if (h.leaveAt && simTime >= h.leaveAt + 6 && h.mode === 'entering') sendHelperHome(r, h);
      }
      updateHelpers(r, dt);
      updateClaude(r, dt, r === cur);
    }
    const c = cur.claude;
    const clk = nowClock();
    Cats.update(dt, simTime, {
      desks: ALL_DESKS, hour: clk.frac, lamp: lampLevel(clk.frac),
      wand: c.mode === 'activity' && c.fun && c.fun.kind === 'wand' ? c.wand : null,
      claude: { x: c.x, y: c.y, moving: c.moving, face: c.face },
    });
  }

  // ---------------------------------------------------------------- world rendering
  function deskScreen(r, i) {
    const blink = Math.floor(simTime * 3) % 2 === 0;
    if (i === -1) {
      const c = r.claude;
      if (c.status === 'permission') return blink ? 'alert' : 'alert2';
      if (c.mode === 'seated' && c.status === 'working') return 'on';
      return 'idle';
    }
    const uid = r.deskOwner[i];
    const h = uid != null ? r.helpers.get(uid) : null;
    if (!h || h.mode !== 'seated') return 'off';
    if (h.status === 'permission') return blink ? 'alert' : 'alert2';
    return 'on';
  }

  function frameFor(a, set) {
    const walkIdx = [1, 0, 2, 0][Math.floor(a.anim * 8) % 4];
    const i = a.moving ? walkIdx : 0;
    switch (a.dir) {
      case 'up': return set.back[i];
      case 'left': return set.sideL[i];
      case 'right': return set.side[i];
      default: return set.front[i];
    }
  }

  function drawActor(g, a) {
    const set = Sprites.character(a.palette);
    const x = Math.round(a.x) - 6, y = Math.round(a.y) - 16;
    const R = (px, py, w, h, col) => { g.fillStyle = col; g.fillRect(px, py, w, h); };
    // shadow
    R(x + 2, Math.round(a.y) - 1, 8, 2, 'rgba(0,0,0,0.18)');
    if (a.mode === 'seated' && a.kind !== 'overflow' && a.seat && a.x === a.seat.x && a.y === a.seat.y && (a.kind === 'main' || a.deskIndex >= 0)) {
      g.drawImage(set.back[0], x, y + 1);
      g.drawImage(Sprites.chair, x + 1, y + 9);
      if (a.status === 'working' && Math.floor(a.anim * 6) % 2) R(x + 1, y + 10, 1, 1, set.palette.skin); // typing elbows
      return;
    }
    if (a.mode === 'activity' && a.fun) return drawActivity(g, a, set, x, y);
    g.drawImage(frameFor(a, set), x, y);
  }

  function drawActivity(g, a, set, x, y) {
    const f = a.fun, t = f.t;
    const R = (px, py, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(px), Math.round(py), w, h); };
    const side = a.face > 0 ? set.side[0] : set.sideL[0];
    switch (f.kind) {
      case 'exercise': {
        const up = Math.floor(t * 3.2) % 2 === 1;
        g.drawImage(up ? set.armsUp : set.front[0], x, y - (up ? 2 : 0));
        break;
      }
      case 'clean': {
        g.drawImage(a.face > 0 ? set.side[Math.floor(t * 6) % 2 ? 1 : 2] : set.sideL[Math.floor(t * 6) % 2 ? 1 : 2], x, y);
        const hx = Math.round(a.x) + a.face * 3, sw = Math.round(Math.sin(t * 9) * 2);
        Sprites.pixelLine(g, hx, y + 8, hx + a.face * 6 + sw, y + 15, '#8a5a32');
        R(hx + a.face * 6 + sw - 2, y + 15, 5, 2, '#e0c040');
        if (Math.floor(t * 4) % 3 === 0) R(hx + a.face * 10 + sw, y + 13 - (Math.floor(t * 8) % 3), 1, 1, '#c8b8a0');
        break;
      }
      case 'play': {
        g.drawImage(set.armsUp, x, y);
        const by = y - 4 - Math.abs(Math.sin(t * 4.5)) * 10;
        R(x + 4, by - 1, 4, 4, '#241c22'); R(x + 5, by, 2, 2, '#5b8dd9');
        break;
      }
      case 'meditate': {
        const bob = Math.round(Math.sin(t * 2) * 1.2) - 2;
        g.drawImage(set.frontCalm, x, y + bob);
        R(x + 1, y + 17, 10, 1, 'rgba(0,0,0,0.15)');
        if (Math.floor(t * 2) % 2) { R(x - 3, y + 2 + bob, 1, 1, '#fff6a0'); R(x + 14, y + 5 + bob, 1, 1, '#fff6a0'); }
        else { R(x - 2, y + 6 + bob, 1, 1, '#ffffff'); R(x + 13, y + 1 + bob, 1, 1, '#ffffff'); }
        break;
      }
      case 'read': {
        if (t < 1.4) { g.drawImage(set.back[0], x, y); R(x + 9, y + 9, 2, 3, '#5b8dd9'); }
        else {
          g.drawImage(set.front[0], x, y);
          R(x + 2, y + 9, 8, 5, '#241c22'); R(x + 3, y + 10, 3, 3, '#f4efe6'); R(x + 6, y + 10, 3, 3, '#ece4d4');
          if (Math.floor(t * 0.7) % 2) R(x + 6, y + 10, 1, 3, '#d97757');
        }
        break;
      }
      case 'water': {
        g.drawImage(side, x, y);
        R(x + 8, y + 8, 5, 4, '#241c22'); R(x + 9, y + 9, 3, 2, '#7a8a9a'); R(x + 13, y + 8, 2, 1, '#7a8a9a');
        for (let i = 0; i < 3; i++) {
          const ph = (t * 1.6 + i / 3) % 1;
          R(x + 15 + ph * 2, y + 9 + ph * 6, 1, 1, '#5fb0f0');
        }
        break;
      }
      case 'pet': {
        g.drawImage(side, x, y + 1);
        const bob = Math.round(Math.sin(t * 6));
        R(Math.round(a.x) + a.face * 6, y + 10 + bob, 2, 2, set.palette.skin);
        break;
      }
      case 'wand': {
        g.drawImage(side, x, y);
        const hx = Math.round(a.x) + a.face * 5, hy = y + 9;
        const w = a.wand || { x: hx, y: hy };
        Sprites.pixelLine(g, hx, hy, w.x, w.y - 4, '#8a5a32');
        R(w.x - 1, w.y - 4, 3, 2, '#d95b8d'); R(w.x, w.y - 2, 1, 2, '#f0a0c0'); R(w.x + (Math.floor(t * 8) % 2 ? 1 : -1), w.y - 5, 1, 1, '#ffd84a');
        break;
      }
      case 'feed': {
        g.drawImage(side, x, y + 1);
        if (t < 2) {
          R(Math.round(a.x) + a.face * 5 - 1, y + 7, 4, 5, '#e0c040'); R(Math.round(a.x) + a.face * 5, y + 8, 2, 2, '#d97757');
          for (let i = 0; i < 2; i++) R(Math.round(a.x) + a.face * 8, y + 13 + ((t * 6 + i * 2) % 3), 1, 1, '#a0603a');
        }
        break;
      }
      default:
        g.drawImage(frameFor(a, set), x, y);
    }
  }

  function drawSky(g, win, clk) {
    const h = clk.frac;
    const ix = win.x + 2, iy = win.y + 2, iw = win.w - 4, ih = win.h - 4;
    g.save();
    g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
    const grad = g.createLinearGradient(0, iy, 0, iy + ih);
    grad.addColorStop(0, keyframe(SKY, h, 1)); grad.addColorStop(1, keyframe(SKY, h, 2));
    g.fillStyle = grad; g.fillRect(ix, iy, iw, ih);
    const span0 = WINDOWS[0].x, span1 = WINDOWS[WINDOWS.length - 1].x + WINDOWS[WINDOWS.length - 1].w;
    // stars
    const sl = starLevel(h);
    if (sl > 0) {
      for (let i = 0; i < 18; i++) {
        const sx = span0 + ((i * 73) % (span1 - span0)), sy = iy + ((i * 37) % (ih - 4));
        const tw = 0.5 + 0.5 * Math.sin(simTime * 2 + i * 1.7);
        g.fillStyle = `rgba(255,255,230,${(sl * (0.4 + tw * 0.6)).toFixed(2)})`;
        g.fillRect(sx, sy, 1, 1);
      }
    }
    // sun (06:00–18:40) and moon (18:40–06:00), travelling across both windows
    const arc = (f) => ({ x: span0 + f * (span1 - span0), y: iy + ih - 2 - Math.sin(f * Math.PI) * (ih - 6) });
    if (h >= 6 && h < 18.66) {
      const p = arc((h - 6) / 12.66);
      g.fillStyle = 'rgba(255,230,140,0.35)'; g.beginPath(); g.arc(p.x, p.y, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = h > 17 || h < 7 ? '#ffb060' : '#fff2a0'; g.beginPath(); g.arc(p.x, p.y, 3, 0, Math.PI * 2); g.fill();
    } else {
      const mh = h >= 18.66 ? h - 18.66 : h + 24 - 18.66;
      const p = arc(mh / 11.34);
      g.fillStyle = '#f4f0dc'; g.beginPath(); g.arc(p.x, p.y, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = keyframe(SKY, h, 1); g.beginPath(); g.arc(p.x + 1.5, p.y - 1, 2.5, 0, Math.PI * 2); g.fill();
    }
    // clouds
    const day = 1 - sl;
    for (let i = 0; i < 4; i++) {
      const cx = span0 - 20 + ((simTime * (1.5 + i * 0.4) + i * 61) % (span1 - span0 + 40));
      const cy = iy + 3 + i * 4;
      g.fillStyle = `rgba(${day > 0.5 ? '255,255,255' : '150,150,190'},${(0.45 + day * 0.4).toFixed(2)})`;
      g.fillRect(Math.round(cx), cy, 9, 2); g.fillRect(Math.round(cx) + 2, cy - 1, 5, 1);
    }
    g.restore();
    // frame
    g.fillStyle = '#241c22'; g.fillRect(win.x - 1, win.y - 1, win.w + 2, 1); g.fillRect(win.x - 1, win.y + win.h, win.w + 2, 1);
    g.fillRect(win.x - 1, win.y, 1, win.h); g.fillRect(win.x + win.w, win.y, 1, win.h);
    g.fillStyle = '#f4efe6';
    g.fillRect(win.x, win.y, win.w, 2); g.fillRect(win.x, win.y + win.h - 2, win.w, 2);
    g.fillRect(win.x, win.y, 2, win.h); g.fillRect(win.x + win.w - 2, win.y, 2, win.h);
    g.fillRect(win.x + (win.w >> 1) - 1, win.y, 2, win.h); g.fillRect(win.x, win.y + (win.h >> 1) - 1, win.w, 1);
    g.fillStyle = '#c9b8a0'; g.fillRect(win.x - 2, win.y + win.h, win.w + 4, 2);
  }

  function drawLampGlow(g, lamp) {
    if (lamp <= 0.01) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const d of ALL_DESKS) {
      const cx = d.x + 27, cy = d.y + 20;
      g.save();
      g.translate(cx, cy); g.scale(1, 0.45);
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, 30);
      gr.addColorStop(0, `rgba(255,200,110,${(0.42 * lamp).toFixed(3)})`);
      gr.addColorStop(0.6, `rgba(255,170,80,${(0.16 * lamp).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(255,160,60,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
      g.restore();
      const b = g.createRadialGradient(d.x + 27, d.y + 6, 0, d.x + 27, d.y + 6, 7);
      b.addColorStop(0, `rgba(255,240,180,${(0.6 * lamp).toFixed(3)})`); b.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = b; g.fillRect(d.x + 19, d.y - 1, 16, 14);
    }
    g.restore();
  }

  function renderWorld(r, clk) {
    const g = wg;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(BG, 0, 0);
    Sprites.drawRack(g, RACK.x, RACK.y, simTime);
    Cats.drawFloor(g);
    const lamp = lampLevel(clk.frac);
    const items = [];
    items.push({ y: MAIN_DESK.y + 22, draw: () => g.drawImage(Sprites.desk(deskScreen(r, -1), lamp > 0.4), MAIN_DESK.x, MAIN_DESK.y) });
    HELPER_DESKS.forEach((d, i) => items.push({ y: d.y + 22, draw: () => g.drawImage(Sprites.desk(deskScreen(r, i), lamp > 0.4), d.x, d.y) }));
    items.push({ y: PLANT.y + 14, draw: () => g.drawImage(Sprites.plant, PLANT.x, PLANT.y) });
    items.push({ y: r.claude.y, draw: () => drawActor(g, r.claude) });
    for (const h of r.helpers.values()) items.push({ y: h.y, draw: () => drawActor(g, h) });
    for (const d of Cats.drawables()) items.push(d);
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw(g);

    // time-of-day tint over the whole scene
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = keyframe(TINT, clk.frac, 1);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';

    for (const w of WINDOWS) drawSky(g, w, clk);
    Sprites.drawClock(g, CLOCK.x, CLOCK.y, CLOCK.r, clk.h, clk.m, clk.s);
    drawLampGlow(g, lamp);
    Cats.drawTop(g, simTime);
  }

  // ---------------------------------------------------------------- display (bubbles, tags)
  let S = 2;          // backing pixels per world pixel
  let dpr = 1;
  const FONT = '"Press Start 2P", ui-monospace, monospace';
  const STYLE = {
    working: { bg: '#fffaf0', fg: '#2b2233', bd: '#2b2233' },
    done: { bg: '#effbe8', fg: '#22401f', bd: '#2f6a2a' },
    waiting: { bg: '#eef3ff', fg: '#23305a', bd: '#3f5aa8' },
    permission: { bg: '#fff1dc', fg: '#5a2a00', bd: '#e8862a' },
    fun: { bg: '#ffe0ef', fg: '#6a1840', bd: '#d95b8d' },
    idle: { bg: '#f2eef6', fg: '#4a4060', bd: '#6a5a8a' },
  };

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = stage.getBoundingClientRect();
    const availW = Math.max(100, rect.width), availH = Math.max(100, rect.height);
    S = Math.max(2, Math.floor(Math.min((availW * dpr) / W, (availH * dpr) / H)));
    display.width = W * S; display.height = H * S;
    display.style.width = (W * S) / dpr + 'px';
    display.style.height = (H * S) / dpr + 'px';
    dg.imageSmoothingEnabled = false;
  }
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  resize();

  function wrap(g, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (g.measureText(test).width <= maxW || !cur) cur = test;
      else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    // hard-break very long words
    return lines.flatMap((l) => {
      if (g.measureText(l).width <= maxW) return [l];
      const out = []; let s = '';
      for (const ch of l) { if (g.measureText(s + ch).width > maxW && s) { out.push(s); s = ch; } else s += ch; }
      if (s) out.push(s);
      return out;
    });
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function drawBadge(g, kind, x, y, s, t) {
    g.save();
    switch (kind) {
      case 'working': {
        g.translate(x + s / 2, y + s / 2); g.rotate(t * 3);
        g.fillStyle = '#6a6a7a';
        for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-s * 0.1, -s * 0.5, s * 0.2, s * 0.25); }
        g.beginPath(); g.arc(0, 0, s * 0.32, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(0, 0, s * 0.13, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'done':
        g.strokeStyle = '#2f9a2a'; g.lineWidth = Math.max(2, s * 0.2); g.lineCap = 'square';
        g.beginPath(); g.moveTo(x + s * 0.12, y + s * 0.55); g.lineTo(x + s * 0.4, y + s * 0.82); g.lineTo(x + s * 0.9, y + s * 0.2); g.stroke();
        break;
      case 'waiting': {
        g.fillStyle = '#3f5aa8';
        for (let i = 0; i < 3; i++) {
          const on = Math.floor(t * 3) % 3 === i;
          g.globalAlpha = on ? 1 : 0.35;
          g.fillRect(x + i * s * 0.36, y + s * 0.4, s * 0.24, s * 0.24);
        }
        break;
      }
      case 'permission':
        g.fillStyle = '#e8862a'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.font = `${Math.round(s * 0.7)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('?', x + s / 2 + 1, y + s / 2 + 1);
        break;
      case 'fun': {
        g.fillStyle = '#e8487a';
        const u = s / 5;
        const m = ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (m[r][c] === 'r') g.fillRect(x + c * u, y + r * u, Math.ceil(u), Math.ceil(u));
        break;
      }
      case 'idle':
        g.fillStyle = '#6a5a8a'; g.font = `${Math.round(s * 0.8)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('z', x + s / 2, y + s / 2 + Math.sin(t * 2) * s * 0.1);
        break;
    }
    g.restore();
  }

  function drawBubble(g, wx, wy, text, kind, opts = {}) {
    if (!text) return;
    const fs = opts.small ? Math.max(7, Math.round(S * 2.1)) : Math.max(9, Math.round(S * 2.9));
    const pad = Math.round(fs * 0.6);
    const badge = opts.badge === false ? 0 : Math.round(fs * 1.15);
    g.font = `${fs}px ${FONT}`;
    const maxW = (opts.small ? 60 : 84) * S - pad * 2 - (badge ? badge + pad * 0.6 : 0);
    const lines = wrap(g, text, maxW);
    const lineH = Math.round(fs * 1.45);
    const textW = Math.max(...lines.map((l) => g.measureText(l).width));
    const bw = Math.round(textW + pad * 2 + (badge ? badge + pad * 0.6 : 0));
    const bh = Math.round(Math.max(lines.length * lineH, badge) + pad * 1.6);
    const st = opts.style || STYLE[kind] || STYLE.working;
    const bob = kind === 'permission' ? Math.round(Math.sin(simTime * 6) * S * 1.2) : 0;
    const tipX = wx * S, tipY = wy * S + bob;
    let bx = Math.round(tipX - bw / 2), by = Math.round(tipY - bh - S * 3);
    bx = Math.max(S, Math.min(display.width - bw - S, bx));
    by = Math.max(S, by);
    const bw2 = Math.max(2, Math.round(S * 0.6));
    // body + tail
    g.fillStyle = st.bd;
    roundRect(g, bx - bw2, by - bw2, bw + bw2 * 2, bh + bw2 * 2, S * 2 + bw2); g.fill();
    const tx = Math.max(bx + S * 3, Math.min(bx + bw - S * 3, tipX));
    g.beginPath(); g.moveTo(tx - S * 2.4, by + bh); g.lineTo(tx + S * 2.4, by + bh); g.lineTo(tx, by + bh + S * 3.2); g.closePath(); g.fill();
    g.fillStyle = st.bg;
    roundRect(g, bx, by, bw, bh, S * 2); g.fill();
    g.beginPath(); g.moveTo(tx - S * 1.5, by + bh - 1); g.lineTo(tx + S * 1.5, by + bh - 1); g.lineTo(tx, by + bh + S * 1.8); g.closePath(); g.fill();
    // badge + text
    let textX = bx + pad;
    if (badge) {
      drawBadge(g, kind, bx + pad, by + (bh - badge) / 2, badge, simTime);
      textX += badge + pad * 0.6;
    }
    g.fillStyle = st.fg; g.textAlign = 'left'; g.textBaseline = 'top';
    g.font = `${fs}px ${FONT}`;
    const ty0 = by + (bh - lines.length * lineH) / 2 + (lineH - fs) / 2;
    lines.forEach((l, i) => g.fillText(l, textX, Math.round(ty0 + i * lineH)));
  }

  function drawTag(g, wx, wy, text, color) {
    const fs = Math.max(7, Math.round(S * 1.9));
    g.font = `${fs}px ${FONT}`;
    const w = g.measureText(text).width + fs;
    const h = fs * 1.6;
    let x = Math.round(wx * S - w / 2);
    x = Math.max(2, Math.min(display.width - w - 2, x));
    const y = Math.round(Math.min(wy * S, display.height - h - 2));
    g.fillStyle = 'rgba(36,28,34,0.82)';
    roundRect(g, x, y, w, h, fs * 0.4); g.fill();
    if (color) { g.fillStyle = color; g.fillRect(x + fs * 0.3, y + h / 2 - fs * 0.2, fs * 0.4, fs * 0.4); }
    g.fillStyle = '#fbf6ec'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(text, x + fs * (color ? 0.9 : 0.5), y + h / 2 + 1);
  }

  function bubbleFor(a) {
    if (a.kind === 'main' && (a.mode === 'wandering' || a.mode === 'activity') && a.fun) {
      return { text: a.mode === 'activity' ? a.fun.line : a.funText, kind: 'fun' };
    }
    const kind = STYLE[a.status] ? a.status : 'working';
    return { text: a.text, kind };
  }

  let hoverCat = null;

  function renderDisplay(r) {
    const g = dg;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, display.width, display.height);
    g.drawImage(world, 0, 0, W * S, H * S);

    // name tags
    const actors = [r.claude, ...r.helpers.values()];
    for (const a of actors) drawTag(g, a.x, a.y + 1, a.name, a.kind === 'main' ? '#d97757' : Sprites.HELPER_PALETTES[a.palette % 6].shirt);
    // agent bubbles (helpers first, Claude on top)
    for (const a of [...r.helpers.values(), r.claude]) {
      const b = bubbleFor(a);
      const headY = a.y - 17 - (a.mode === 'seated' ? -1 : 0);
      drawBubble(g, a.x, headY, b.text, b.kind);
    }
    // cat bubbles
    for (const b of Cats.bubbles()) {
      drawBubble(g, b.x, b.y, b.text, 'cat', { small: true, badge: false, style: { bg: '#fffdf6', fg: '#3a2a2a', bd: b.color } });
    }
    if (hoverCat) {
      const c = Cats.get(hoverCat);
      if (c && !c.hidden) drawTag(g, c.x, c.y - 24, c.name, c.def.color);
    }
  }

  // ---------------------------------------------------------------- header + panel UI
  const clockEl = $('clock'), phaseEl = $('phase');
  let lastClockText = '';
  function updateHeader(clk) {
    const txt = `${String(clk.h).padStart(2, '0')}:${String(clk.m).padStart(2, '0')}:${String(clk.s).padStart(2, '0')}`;
    if (txt !== lastClockText) {
      lastClockText = txt;
      clockEl.textContent = txt;
      const ph = phaseOf(clk.frac);
      if (phaseEl.dataset.p !== ph) { phaseEl.dataset.p = ph; phaseEl.textContent = ph; phaseEl.className = 'pill ' + ph; }
    }
  }
  $('tz').textContent = TZ.split('/').pop().replace(/_/g, ' ');

  // Roster: built only after Cats.init (done above).
  const rosterEl = $('roster');
  const rosterRows = Cats.roster().map((c) => {
    const li = document.createElement('li');
    li.className = 'cat';
    li.innerHTML = `
      <div class="cat-head"><span class="dot" style="background:${c.color}"></span><b></b><i></i></div>
      <div class="cat-act"></div>
      <div class="bars">
        <label>NRG<span class="bar"><span class="fill e"></span></span></label>
        <label>TUM<span class="bar"><span class="fill h"></span></span></label>
        <label>LUV<span class="bar"><span class="fill l"></span></span></label>
      </div>`;
    li.querySelector('b').textContent = c.name;
    li.querySelector('i').textContent = c.trait;
    li.onclick = () => Cats.pet(c.name, 'user');
    li.title = 'Click to pet ' + c.name;
    rosterEl.appendChild(li);
    return { li, act: li.querySelector('.cat-act'), e: li.querySelector('.e'), h: li.querySelector('.h'), l: li.querySelector('.l') };
  });
  function updateRoster() {
    Cats.roster().forEach((c, i) => {
      const row = rosterRows[i];
      if (row.act.textContent !== c.activity) row.act.textContent = c.activity;
      row.e.style.width = Math.round(c.energy * 100) + '%';
      row.h.style.width = Math.round(c.tummy * 100) + '%';
      row.l.style.width = Math.round(c.love * 100) + '%';
    });
  }

  let tool = 'pet';
  const toolBtns = [...document.querySelectorAll('[data-tool]')];
  function setTool(t) {
    tool = t;
    toolBtns.forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    display.dataset.tool = t;
    $('toolhint').textContent = { pet: 'Click a cat to pet it.', feed: 'Click the floor to drop a food bowl.', toy: 'Click the floor to toss the ball.' }[t];
  }
  toolBtns.forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  setTool('pet');

  function toWorld(ev) {
    const rect = display.getBoundingClientRect();
    return { x: ((ev.clientX - rect.left) / rect.width) * W, y: ((ev.clientY - rect.top) / rect.height) * H };
  }
  display.addEventListener('pointermove', (ev) => {
    const p = toWorld(ev);
    hoverCat = Cats.hitTest(p.x, p.y);
    display.style.cursor = hoverCat || tool !== 'pet' ? 'pointer' : 'default';
  });
  display.addEventListener('pointerleave', () => { hoverCat = null; });
  display.addEventListener('pointerdown', (ev) => {
    const p = toWorld(ev);
    if (tool === 'pet') {
      const name = Cats.hitTest(p.x, p.y);
      if (name) Cats.pet(name, 'user');
    } else if (tool === 'feed') {
      if (p.y > 42) { Cats.dropFood(p.x, p.y); setTool('pet'); }
    } else if (tool === 'toy') {
      if (p.y > 42) { Cats.tossToy(p.x, p.y); setTool('pet'); }
    }
  });

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let rosterT = 0;
  function frame(ts) {
    const dt = Math.min(MAX_DT, Math.max(0, (ts - last) / 1000));
    last = ts;
    simulate(dt);
    draw();
    rosterT += dt;
    if (rosterT > 0.5) { rosterT = 0; updateRoster(); }
    requestAnimationFrame(frame);
  }

  function draw() {
    const clk = nowClock();
    const r = room();
    renderWorld(r, clk);
    renderDisplay(r);
    updateHeader(clk);
  }

  // Debug / test hook
  window.__office = {
    get actors() { const r = room(); return [r.claude, ...r.helpers.values()]; },
    rooms,
    cats: Cats,
    get room() { return room(); },
    clock: nowClock,
    simTime: () => simTime,
    ff(seconds, step = 0.1, onStep) {
      const n = Math.ceil(seconds / step);
      for (let i = 0; i < n; i++) {
        clockOffset += step * 1000;
        simulate(step);
        if (onStep) onStep(i * step);
      }
      draw(); updateRoster();
    },
    constants: { W, H, MAIN_DESK, HELPER_DESKS, DOOR, WINDOWS },
  };

  connect();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastClockText = ''; });
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
