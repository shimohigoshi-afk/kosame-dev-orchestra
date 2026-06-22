#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ALLOWED_EXECUTION_HOSTS,
  BLOCKED_EXECUTION_HOSTS,
  OFFICIAL_ROUTE,
  MANUAL_CODE_UI_ALLOWED,
  classifyExecutionHost,
} = require('../tools/kosame-execution-host-guard');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.33 execution host isolation smoke =====');

for (const host of ALLOWED_EXECUTION_HOSTS) {
  const info = classifyExecutionHost({ executionHost: host, executionSource: host, safeSpawn: host === 'safe-spawn', interactive: false });
  assert.equal(info.executionHost, host, `allowed host should stay as ${host}`);
  assert.equal(info.executionHostAllowed, true, `${host} should be allowed`);
  assert.equal(info.interactiveHostBlocked, false, `${host} should not be blocked`);
}

for (const host of BLOCKED_EXECUTION_HOSTS) {
  const info = classifyExecutionHost({ executionHost: host, executionSource: host, interactive: true });
  assert.equal(info.executionHost, host, `blocked host should stay as ${host}`);
  assert.equal(info.executionHostAllowed, false, `${host} should not be allowed`);
  assert.equal(info.interactiveHostBlocked, true, `${host} should be blocked`);
  assert.ok(String(info.blockedReason || '').includes('blocked_interactive_host'), `${host} should be tagged blocked_interactive_host`);
}

const consoleInfo = classifyExecutionHost({ executionHost: 'kosame-console', executionSource: 'kosame-console', console: true });
assert.equal(consoleInfo.officialRoute, OFFICIAL_ROUTE, 'official route should be shared');
assert.equal(consoleInfo.manualCodeUiAllowed, MANUAL_CODE_UI_ALLOWED, 'manual code UI must be disabled');
assert.equal(consoleInfo.noYesGateRuntime, true, 'console route should remain no-yes runtime');

const watcherSource = read('tools/kosame-codex-dispatch-watcher.js');
assert.ok(/safeSpawn\s*\(/.test(watcherSource), 'watcher must use safeSpawn');
assert.ok(/evaluateNoYesGate\s*\(/.test(watcherSource), 'watcher must use No-YES gate');
assert.ok(/blocked_interactive_host/.test(watcherSource), 'watcher must record blocked interactive host');
assert.ok(/blocked_by_interactive_prompt/.test(watcherSource), 'watcher must record blocked interactive prompt');

const serverSource = read('tools/kosame-live-cockpit-server.js');
assert.ok(/executionHost: .*kosame-api-runner|kosame-api-runner/.test(serverSource), 'live server should classify api runner');
assert.ok(/evaluateNoYesGate\s*\(/.test(serverSource), 'live server should use No-YES gate');

console.log('  PASS: allowed and blocked execution hosts classified correctly');
console.log('  PASS: official route =', OFFICIAL_ROUTE);
