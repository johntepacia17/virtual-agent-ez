#!/usr/bin/env node
// Sends a scripted sequence of fake Claude Code hook events to the Pixel Office server
// so you can preview the whole scene without running Claude Code. Usage:
//   node scripts/demo.js          one run
//   node scripts/demo.js --loop   repeat forever
//   node scripts/demo.js --fast   half the delays
'use strict';
const http = require('http');

const PORT = Number(process.env.PIXEL_OFFICE_PORT) || 4321;
const LOOP = process.argv.includes('--loop');
const SPEED = process.argv.includes('--fast') ? 0.5 : 1;
const SID = 'demo-' + Math.random().toString(36).slice(2, 8);
const CWD = '/home/dev/projects/shop-app';
let tu = 0;

function post(payload) {
  const body = JSON.stringify({ session_id: SID, cwd: CWD, transcript_path: '/tmp/demo.jsonl', ...payload });
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/event', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', (e) => {
      console.error(`Cannot reach the server on port ${PORT} (${e.code}). Start it with: node server.js`);
      process.exit(1);
    });
    req.end(body);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));

async function tool(name, input, ms = 1800, extra = {}) {
  const id = 'toolu_demo_' + (++tu);
  await post({ hook_event_name: 'PreToolUse', tool_name: name, tool_input: input, tool_use_id: id, ...extra });
  await sleep(ms);
  await post({ hook_event_name: 'PostToolUse', tool_name: name, tool_input: input, tool_use_id: id,
    tool_response: {}, ...extra });
  return id;
}

async function run() {
  console.log('Session', SID);
  const step = (msg) => console.log('  ' + msg);

  step('SessionStart');
  await post({ hook_event_name: 'SessionStart', source: 'startup' });
  await sleep(2500);

  step('UserPromptSubmit');
  await post({ hook_event_name: 'UserPromptSubmit', prompt: '(demo prompt, never shown in the office)' });
  await sleep(1800);

  step('Read / Grep / Edit / Bash');
  await tool('Read', { file_path: CWD + '/src/login.php' });
  await tool('Grep', { pattern: 'sessionToken', path: CWD });
  await tool('Edit', { file_path: CWD + '/src/auth/session.js', old_string: 'a', new_string: 'b' });
  await tool('Bash', { command: `cd ${CWD} && git status`, description: 'Show status' });

  step('Two helpers');
  const a1 = 'toolu_demo_agent_1';
  const a2 = 'toolu_demo_agent_2';
  await post({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: a1,
    tool_input: { description: 'Find auth code', prompt: '…', subagent_type: 'Explore' } });
  await sleep(600);
  await post({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: a2,
    tool_input: { description: 'Review tests', prompt: '…', subagent_type: 'general-purpose' } });
  await sleep(1500);
  await post({ hook_event_name: 'SubagentStart', agent_id: 'agent-a', agent_type: 'Explore' });
  await post({ hook_event_name: 'SubagentStart', agent_id: 'agent-b', agent_type: 'general-purpose' });
  await sleep(2500);
  await tool('Glob', { pattern: '**/*.test.js' }, 2500, { agent_id: 'agent-a', agent_type: 'Explore' });
  await tool('WebSearch', { query: 'php session fixation' }, 2500, { agent_id: 'agent-b', agent_type: 'general-purpose' });
  await tool('Read', { file_path: CWD + '/tests/login.test.js' }, 2500, { agent_id: 'agent-a', agent_type: 'Explore' });
  await sleep(2000);
  await post({ hook_event_name: 'SubagentStop', agent_id: 'agent-a', agent_type: 'Explore' });
  await post({ hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: a1, tool_input: {} });
  await sleep(3000);
  await post({ hook_event_name: 'SubagentStop', agent_id: 'agent-b', agent_type: 'general-purpose' });
  await post({ hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: a2, tool_input: {} });
  await sleep(5000);

  step('Permission request');
  const pid = 'toolu_demo_perm';
  const pin = { command: `cd ${CWD} && npm test -- --coverage` };
  await post({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: pid, tool_input: pin });
  await sleep(300);
  await post({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: pin });
  await sleep(1500);
  await post({ hook_event_name: 'Notification', notification_type: 'permission_prompt',
    message: 'Claude needs your permission to use Bash' });
  await sleep(5000);
  await post({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: pid, tool_input: pin });
  await sleep(1500);
  await tool('Write', { file_path: CWD + '/docs/CHANGELOG.md', content: '…' });
  await tool('WebFetch', { url: 'https://www.php.net/manual/en/function.session-regenerate-id.php' });

  step('Stop (then idle free time)');
  await post({ hook_event_name: 'Stop' });
  await sleep(30000);

  if (LOOP) {
    step('Notification (waiting)');
    await post({ hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'Claude is waiting for your input' });
    await sleep(15000);
  } else {
    console.log('Done. The session stays visible; Claude now enjoys some free time.');
  }
}

(async () => {
  do { await run(); } while (LOOP);
})();
