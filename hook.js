#!/usr/bin/env node
// Pixel Office hook: forwards the Claude Code hook payload (stdin JSON) to the local server.
// Must never disturb Claude Code: prints nothing, always exits 0, gives up after 800 ms.
'use strict';
const http = require('http');

const PORT = Number(process.env.PIXEL_OFFICE_PORT) || 4321;
const done = () => process.exit(0);
setTimeout(done, 800).unref();

try {
  let body = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { body += c; });
  process.stdin.on('error', done);
  process.stdin.on('end', () => {
    try {
      if (!body.trim()) return done();
      const req = http.request({
        host: '127.0.0.1', port: PORT, path: '/event', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 800,
      }, (res) => { res.resume(); res.on('end', done); res.on('error', done); });
      req.on('error', done);
      req.on('timeout', () => { req.destroy(); done(); });
      req.end(body);
    } catch (_) { done(); }
  });
} catch (_) { done(); }
