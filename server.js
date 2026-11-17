#!/usr/bin/env node
// Pixel Office server: receives Claude Code hook events, keeps per-session state,
// streams it to the browser with Server-Sent Events, and serves public/. No dependencies.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PIXEL_OFFICE_PORT) || 4321;
const HOST = '127.0.0.1';
const DEBUG = process.env.DEBUG === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_FILE = path.join(__dirname, 'events.log');
const STALE_MS = 10 * 60 * 1000;
const HELPER_LINGER_MS = 4000;
const NAP_DELAY_MS = 20000;
const PERM_SUPPRESS_MS = 10000;
const MAX_TEXT = 40;

// ---------------------------------------------------------------- text helpers
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function clip(s, n = MAX_TEXT) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// "C:\\work\\app\\src\\login.php" -> "src/login.php"
function folderFile(p) {
  if (!p) return 'something';
  const parts = String(p).split(/[\\/]+/).filter(Boolean);
  return parts.slice(-2).join('/') || String(p);
}

function lastSeg(p) {
  const parts = String(p).split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

// Drop a leading `cd X &&`, shorten absolute paths to their last segment, keep the first line.
function cleanCmd(cmd) {
  let c = String(cmd || '').split('\n')[0].trim();
  c = c.replace(/^cd\s+("[^"]*"|'[^']*'|\S+)\s*&&\s*/, '');
  c = c.replace(/(["']?)((?:[A-Za-z]:)?[\\/](?:[^\s"'\\/]+[\\/])*[^\s"'\\/]+)\1/g, (m, q, p) => q + lastSeg(p) + q);
  c = c.replace(/(["']?)~[\\/](?:[^\s"'\\/]+[\\/])*([^\s"'\\/]+)\1/g, (m, q, last) => q + last + q);
  return c;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return 'the web'; }
}

function shortToolName(name) {
  const n = String(name || 'a tool');
  const m = n.match(/^mcp__[^_]+(?:_[^_]+)*?__(.+)$/);
  return (m ? m[1] : n).replace(/_/g, ' ');
}

function describeTool(name, input) {
  input = input || {};
  const file = folderFile(input.file_path || input.notebook_path || input.path);
  switch (name) {
    case 'Read':
      return clip(pick(['Peeking at ', 'Reading ', 'Skimming ', 'Studying ']) + file);
    case 'Edit':
    case 'MultiEdit':
      return clip(pick(['Tinkering with ', 'Tweaking ', 'Polishing ', 'Fixing up ']) + file);
    case 'Write':
      return clip(pick(['Writing ', 'Crafting ', 'Tinkering with ', 'Conjuring ']) + file);
    case 'NotebookEdit':
      return clip('Scribbling in ' + file);
    case 'Bash': {
      const c = cleanCmd(input.command);
      return clip(c ? pick(['Running ', 'Typing ', 'Launching ']) + c : 'Poking the terminal');
    }
    case 'BashOutput':
      return pick(['Checking the terminal', 'Peeking at output']);
    case 'KillShell':
    case 'KillBash':
      return 'Stopping a process';
    case 'Grep':
      return clip(pick(['Hunting for ', 'Searching for ', 'Sniffing out ']) + (input.pattern || 'clues'));
    case 'Glob':
      return clip(pick(['Hunting for ', 'Rummaging for ']) + (input.pattern || 'files'));
    case 'LS':
      return clip('Looking around ' + file);
    case 'WebSearch':
      return clip(pick(['Googling ', 'Searching the web for ']) + (input.query || 'stuff'));
    case 'WebFetch':
      return clip(pick(['Googling… ', 'Browsing ', 'Visiting ']) + hostOf(input.url));
    case 'Agent':
    case 'Task':
      return pick(['Summoning a helper!', 'Calling in backup!', 'Hiring a sidekick!']);
    case 'TodoWrite':
      return pick(['Updating my quest log', 'Making a to-do list', 'Planning the quest']);
    case 'ExitPlanMode':
      return 'Here is my master plan!';
    case 'AskUserQuestion':
      return 'Got a question for you!';
    case 'Skill':
      return clip('Using a skill: ' + (input.skill || '?'));
    default:
      return clip(pick(['Using ', 'Fiddling with ']) + shortToolName(name));
  }
}

function permissionLine(name, input) {
  input = input || {};
  switch (name) {
    case 'Bash': return clip('Can I run ' + (cleanCmd(input.command) || 'this') + '?');
    case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit':
      return clip('May I edit ' + folderFile(input.file_path || input.notebook_path) + '?');
    case 'WebFetch': return clip('May I visit ' + hostOf(input.url) + '?');
    case 'WebSearch': return 'May I search the web?';
    case 'Agent': case 'Task': return 'May I summon a helper?';
    default: return clip('May I use ' + shortToolName(name) + '?');
  }
}

const PROMPT_LINES = ['On it, boss!', 'Ooh, a new quest!', 'Challenge accepted!', 'Let me cook…',
  'Roger that!', 'Leave it to me!', 'Hmm, interesting!', 'Rolling up my sleeves!'];
const DONE_LINES = ['All done! Yay!', 'Quest complete!', 'Ta-da! Finished!', 'Nailed it!', 'Done and dusted!'];
const WAIT_LINES = ['Waiting for you…', 'Your move, boss!', 'Psst… still here!', 'Ready when you are!'];
const THINK_LINES = ['Thinking…', 'Hmm, let me see…', 'Mulling it over…', 'Next step…'];
const HELPER_HELLO = ['Reporting for duty!', 'Helper here!', 'Sidekick ready!', 'Let me help!'];
const HELPER_DONE = ['Job done! Bye!', 'Mission complete!', 'Back to base!', 'Done! See ya!'];

// ---------------------------------------------------------------- state
let nextUid = 1;
const sessions = new Map();
const recentLog = [];
const clients = new Set();

function newAgent(kind, name) {
  const uid = nextUid++;
  return {
    uid, kind, name,
    status: kind === 'main' ? 'idle' : 'working',
    text: '', since: Date.now(), palette: (uid - 1) % 6,
    key: null, agentId: null, agentType: null, adopted: false,
    permAt: 0, napTimer: null, removeAt: 0,
  };
}

function getSession(p) {
  const id = String(p.session_id || 'default');
  let s = sessions.get(id);
  if (!s) {
    const main = newAgent('main', 'Claude');
    s = { id, name: p.cwd ? lastSeg(p.cwd) : 'session', cwd: p.cwd || '', main, helpers: [], lastSeen: Date.now(), started: Date.now() };
    sessions.set(id, s);
  }
  if (p.cwd && !s.cwd) { s.cwd = p.cwd; s.name = lastSeg(p.cwd); }
  s.lastSeen = Date.now();
  return s;
}

function setAgent(a, status, text) {
  if (a.napTimer) { clearTimeout(a.napTimer); a.napTimer = null; }
  a.status = status;
  if (text != null) a.text = text;
  a.since = Date.now();
}

function log(s, a, text) {
  const line = { t: Date.now(), session: s.id, sessionName: s.name, who: a ? a.name : '', status: a ? a.status : '', text };
  recentLog.push(line);
  if (recentLog.length > 100) recentLog.shift();
  send('log', line);
}

function findHelperForPayload(s, p) {
  if (p.agent_id) return s.helpers.find((h) => h.agentId === p.agent_id) || null;
  return null;
}

function scheduleRemoval(s, h) {
  h.removeAt = Date.now() + HELPER_LINGER_MS;
  setTimeout(() => {
    const i = s.helpers.indexOf(h);
    if (i >= 0) { s.helpers.splice(i, 1); broadcastState(); }
  }, HELPER_LINGER_MS + 20);
}

function helperName(type) {
  if (!type || type === 'general-purpose') return 'Helper';
  return clip(String(type).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()), 14);
}

function handleEvent(p) {
  const ev = p.hook_event_name;
  if (!ev) return;
  const s = getSession(p);
  const main = s.main;
  const tool = p.tool_name;
  const input = p.tool_input || {};
  const target = findHelperForPayload(s, p) || main;

  switch (ev) {
    case 'SessionStart':
      setAgent(main, 'idle', 'Ready! Let\'s go!');
      log(s, main, 'Session started');
      break;

    case 'UserPromptSubmit':
      setAgent(main, 'working', pick(PROMPT_LINES));
      log(s, main, 'New prompt received');
      break;

    case 'PreToolUse': {
      const line = describeTool(tool, input);
      setAgent(target, 'working', line);
      if ((tool === 'Agent' || tool === 'Task') && target === main) {
        const h = newAgent('helper', helperName(input.subagent_type));
        h.key = 'tu:' + (p.tool_use_id || h.uid);
        h.agentType = input.subagent_type || null;
        h.text = pick(HELPER_HELLO);
        s.helpers.push(h);
        log(s, h, 'Helper summoned');
      }
      log(s, target, line);
      break;
    }

    case 'PostToolUse': {
      if (target.status === 'permission' || target.status === 'working') setAgent(target, 'working', pick(THINK_LINES));
      if ((tool === 'Agent' || tool === 'Task') && p.tool_use_id) {
        const h = s.helpers.find((x) => x.key === 'tu:' + p.tool_use_id);
        if (h && !h.removeAt) {
          setAgent(h, 'done', pick(HELPER_DONE));
          scheduleRemoval(s, h);
          log(s, h, 'Helper finished');
        }
      }
      break;
    }

    case 'PermissionRequest': {
      setAgent(target, 'permission', permissionLine(tool, input));
      target.permAt = Date.now();
      log(s, target, 'Asking permission: ' + target.text);
      break;
    }

    case 'Notification': {
      const msg = String(p.message || '');
      const isPerm = p.notification_type === 'permission_prompt' || /permission/i.test(msg);
      if (isPerm) {
        if (main.status === 'permission' && Date.now() - main.permAt < PERM_SUPPRESS_MS) break;
        const m = msg.match(/permission to use (\S+)/i);
        setAgent(main, 'permission', m ? permissionLine(m[1], {}) : 'Psst! Need your OK!');
        main.permAt = Date.now();
        log(s, main, 'Needs permission');
      } else {
        setAgent(main, 'waiting', pick(WAIT_LINES));
        log(s, main, 'Waiting for input');
      }
      break;
    }

    case 'SubagentStart': {
      let h = findHelperForPayload(s, p);
      if (!h) {
        const free = s.helpers.filter((x) => !x.adopted && !x.removeAt);
        h = free.find((x) => p.agent_type && x.agentType === p.agent_type) || free[0] || null;
      }
      if (!h) {
        h = newAgent('helper', helperName(p.agent_type));
        h.text = pick(HELPER_HELLO);
        s.helpers.push(h);
      }
      h.adopted = true;
      if (p.agent_id) h.agentId = p.agent_id;
      if (p.agent_type) { h.agentType = p.agent_type; h.name = helperName(p.agent_type); }
      setAgent(h, 'working', h.text || pick(HELPER_HELLO));
      log(s, h, 'Helper started');
      break;
    }

    case 'SubagentStop': {
      let h = findHelperForPayload(s, p);
      if (!h) h = s.helpers.find((x) => x.adopted && !x.removeAt) || s.helpers.find((x) => !x.removeAt);
      if (h && !h.removeAt) {
        setAgent(h, 'done', pick(HELPER_DONE));
        scheduleRemoval(s, h);
        log(s, h, 'Helper finished');
      }
      break;
    }

    case 'Stop': {
      setAgent(main, 'done', pick(DONE_LINES));
      log(s, main, 'Finished the turn');
      const stamp = main.since;
      main.napTimer = setTimeout(() => {
        main.napTimer = null;
        if (main.status === 'done' && main.since === stamp) {
          setAgent(main, 'idle', 'Zzz… nap time');
          broadcastState();
        }
      }, NAP_DELAY_MS);
      break;
    }

    case 'SessionEnd':
      log(s, main, 'Session ended');
      for (const a of [main, ...s.helpers]) if (a.napTimer) clearTimeout(a.napTimer);
      sessions.delete(s.id);
      break;

    default:
      return;
  }
  broadcastState();
}

function snapshot() {
  const out = [];
  for (const s of sessions.values()) {
    out.push({
      id: s.id, name: s.name, started: s.started, lastSeen: s.lastSeen,
      agents: [s.main, ...s.helpers].map((a) => ({
        id: a.uid, uid: a.uid, kind: a.kind, name: a.name, status: a.status, text: a.text,
        since: a.since, palette: a.palette, leaving: !!a.removeAt,
      })),
    });
  }
  out.sort((a, b) => a.started - b.started);
  return { now: Date.now(), sessions: out };
}

// ---------------------------------------------------------------- SSE
function send(type, data, only) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of only ? [only] : clients) {
    try { res.write(msg); } catch (_) { clients.delete(res); }
  }
}
let stateQueued = false;
function broadcastState() {
  if (stateQueued) return;
  stateQueued = true;
  setImmediate(() => { stateQueued = false; send('state', snapshot()); });
}

setInterval(() => {
  const cutoff = Date.now() - STALE_MS;
  let changed = false;
  for (const [id, s] of sessions) {
    if (s.lastSeen < cutoff) { sessions.delete(id); changed = true; }
  }
  if (changed) broadcastState();
  for (const res of clients) { try { res.write(': ping\n\n'); } catch (_) { clients.delete(res); } }
}, 25000).unref();

// ---------------------------------------------------------------- HTTP
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serveStatic(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch (_) { res.writeHead(400); return res.end(); }
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (req.method === 'POST' && urlPath === '/event') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      res.writeHead(204); res.end();
      let p;
      try { p = JSON.parse(body); } catch (_) { return; }
      if (DEBUG) fs.appendFile(LOG_FILE, new Date().toISOString() + ' ' + body.replace(/\n/g, ' ') + '\n', () => {});
      try { handleEvent(p); } catch (e) { console.error('[pixel-office] event error:', e.message); }
    });
    return;
  }

  if (req.method === 'GET' && urlPath === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    clients.add(res);
    send('state', snapshot(), res);
    for (const line of recentLog.slice(-30)) send('log', line, res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'GET' && urlPath === '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(snapshot()));
  }

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, urlPath);
  res.writeHead(405); res.end();
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Pixel Office running at http://localhost:${PORT}`);
  });
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use (set PIXEL_OFFICE_PORT).` : e.message);
    process.exit(1);
  });
}

module.exports = { describeTool, permissionLine, cleanCmd, folderFile, handleEvent, snapshot, sessions };
