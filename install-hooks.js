#!/usr/bin/env node
// Adds (or removes, with --uninstall) the Pixel Office hook in the user-level Claude Code settings
// (~/.claude/settings.json). Idempotent, preserves every other setting and hook, and writes a
// timestamped backup (settings.json.bak-YYYYMMDD-HHMMSS) before changing anything.
//   node install-hooks.js                 install
//   node install-hooks.js --uninstall     remove
//   node install-hooks.js --settings PATH use another settings file (for testing)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'SubagentStart',
  'SubagentStop', 'PermissionRequest', 'Notification', 'Stop', 'SessionEnd'];
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'PermissionRequest']);

const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const si = args.indexOf('--settings');
const settingsPath = si >= 0 && args[si + 1] ? path.resolve(args[si + 1]) : path.join(os.homedir(), '.claude', 'settings.json');

const hookPath = path.resolve(__dirname, 'hook.js').replace(/\\/g, '/');
const command = `node "${hookPath}"`;
const isOurs = (h) => h && typeof h.command === 'string' && h.command.replace(/\\/g, '/').includes(hookPath);

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function main() {
  let settings = {};
  let raw = null;
  if (fs.existsSync(settingsPath)) {
    raw = fs.readFileSync(settingsPath, 'utf8');
    try { settings = raw.trim() ? JSON.parse(raw) : {}; }
    catch (e) {
      console.error(`Could not parse ${settingsPath}: ${e.message}\nNothing was changed.`);
      process.exit(1);
    }
  }
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    console.error(`${settingsPath} does not contain a JSON object. Nothing was changed.`);
    process.exit(1);
  }
  settings.hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};

  let added = 0, removed = 0;
  for (const ev of EVENTS) {
    const groups = Array.isArray(settings.hooks[ev]) ? settings.hooks[ev] : [];
    if (uninstall) {
      for (const g of groups) {
        if (!Array.isArray(g.hooks)) continue;
        const before = g.hooks.length;
        g.hooks = g.hooks.filter((h) => !isOurs(h));
        removed += before - g.hooks.length;
      }
      const kept = groups.filter((g) => !Array.isArray(g.hooks) || g.hooks.length > 0);
      if (kept.length) settings.hooks[ev] = kept; else delete settings.hooks[ev];
      continue;
    }
    const present = groups.some((g) => Array.isArray(g.hooks) && g.hooks.some(isOurs));
    if (present) continue;
    const entry = { hooks: [{ type: 'command', command }] };
    if (TOOL_EVENTS.has(ev)) entry.matcher = '*';
    groups.push(entry);
    settings.hooks[ev] = groups;
    added++;
  }
  if (uninstall && !Object.keys(settings.hooks).length) delete settings.hooks;

  if (!added && !removed) {
    console.log(uninstall ? 'Pixel Office hooks are not installed. Nothing to do.' : 'Pixel Office hooks are already installed. Nothing to do.');
    return;
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  if (raw !== null) {
    let backup = `${settingsPath}.bak-${stamp()}`;
    for (let n = 2; fs.existsSync(backup); n++) backup = `${settingsPath}.bak-${stamp()}-${n}`;
    fs.writeFileSync(backup, raw);
    console.log(`Backup written: ${backup}`);
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  if (uninstall) console.log(`Removed ${removed} Pixel Office hook(s) from ${settingsPath}`);
  else {
    console.log(`Added Pixel Office hook for ${added} event(s) in ${settingsPath}`);
    console.log(`Command: ${command}`);
    console.log('Restart any running Claude Code sessions so they pick up the hooks.');
  }
}

main();
