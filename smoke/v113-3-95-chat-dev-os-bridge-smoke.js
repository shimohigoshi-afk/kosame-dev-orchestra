'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.95 chat → Dev OS bridge smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 95),
  `package version must be >= 113.3.95 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-95'], 'smoke:v113-3-95 must exist in package.json');
assert.ok(
  pkg.scripts['verify:dev-os'] && pkg.scripts['verify:dev-os'].includes('smoke:v113-3-95'),
  'verify:dev-os must include smoke:v113-3-95',
);

// ── cockpit server wiring ─────────────────────────────────────────────────────
const server = read('tools/kosame-live-cockpit-server.js');

// 1. _callDevOsRouter helper exists
assert.ok(
  server.includes('_callDevOsRouter'),
  'kosame-live-cockpit-server.js must define _callDevOsRouter',
);

// 2. runner-dispatch calls _callDevOsRouter
assert.ok(
  /await _callDevOsRouter\(/.test(server),
  'runner-dispatch must await _callDevOsRouter',
);

// 3. DEV-OS SSE log emitted after routing
assert.ok(
  /agent:\s*'DEV-OS'/.test(server),
  "runner-dispatch must emit SSE with agent: 'DEV-OS'",
);

// 4. devOsRoute used as assigned_agent (not hardcoded 'Codex')
assert.ok(
  server.includes('assigned_agent: devOsRoute'),
  'runner-dispatch payload must use devOsRoute as assigned_agent',
);

// 5. devOsRoute used in pipeline telemetry route field
assert.ok(
  server.includes('route: devOsRoute'),
  'appendPipelineStageEvent must use devOsRoute for route field',
);

// 6. fallback: devOsWarning tracked when dev-os router is unavailable
assert.ok(
  server.includes('devOsWarning'),
  'must track devOsWarning for graceful fallback when dev-os router is down',
);

// 7. port 8091 used (or DEV_OS_PORT env)
assert.ok(
  server.includes('8091') || server.includes('DEV_OS_PORT'),
  'must reference port 8091 or DEV_OS_PORT for dev-os router',
);

// ── dev-os router HTTP server exists ─────────────────────────────────────────
const router = read('tools/kosame-dev-os-router.js');
assert.ok(router.includes('startDevOsServer'), 'dev-os router must export startDevOsServer');
assert.ok(router.includes('/api/dev-os'), 'dev-os router must handle POST /api/dev-os');
assert.ok(router.includes('8091') || router.includes('DEV_OS_PORT'), 'dev-os router must listen on 8091 or DEV_OS_PORT');

// ── HTML SSE wiring ───────────────────────────────────────────────────────────
const html = read('public/kosame-live-cockpit.html');
assert.ok(html.includes('/api/runner-stream'), 'HTML must subscribe to /api/runner-stream SSE');
assert.ok(html.includes('addAgentStreamLog'), 'HTML must pipe SSE log events to AGENT STREAM LOG');
assert.ok(html.includes('/api/runner-dispatch'), 'HTML sendChatMessage must fire /api/runner-dispatch');

console.log('  PASS: _callDevOsRouter wired in runner-dispatch');
console.log('  PASS: DEV-OS SSE log emitted with route label');
console.log('  PASS: devOsRoute used as assigned_agent + pipeline route');
console.log('  PASS: fallback handling when dev-os router is down');
console.log('  PASS: HTML /api/runner-stream → addAgentStreamLog pipeline intact');
console.log('\n✅ v113.3.95 chat → Dev OS bridge smoke PASSED');
