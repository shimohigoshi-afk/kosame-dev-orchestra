#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const pkg = require('../package.json');
const { runStartupAudit } = require('../tools/kosame-startup-audit');

console.log('=== v113.3.0 startup audit smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:startup'], 'package wiring');

const audit = runStartupAudit();
assert.equal(audit.batExists, true, 'KOSAME.bat must exist');
assert.equal(audit.pass, true, `startup audit must pass: ${JSON.stringify(audit.violations)}`);
assert.ok(audit.scripts['cockpit:server'], 'cockpit:server script required');
assert.ok(audit.scripts['codex:watch'], 'codex:watch script required');

console.log('✅ v113.3.0 startup audit smoke PASSED');
