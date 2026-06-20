#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const { runDirectSpawnAudit } = require('../tools/kosame-direct-spawn-audit');

console.log('=== v113.3.0 direct spawn audit smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:audit'], 'package wiring');

const pass = runDirectSpawnAudit();
assert.equal(pass.pass, true, `repo audit must pass: ${JSON.stringify(pass.violations)}`);

const tempDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'kosame-audit-'));
const sample = path.join(tempDir, 'sample.js');
fs.writeFileSync(sample, "const { spawn } = require('node:child_process');\nspawn('claude');\n", 'utf8');
const blocked = runDirectSpawnAudit({ files: [sample] });
assert.equal(blocked.pass, false);
assert.ok(blocked.violations.some((v) => v.label === 'raw executor'));

console.log('✅ v113.3.0 direct spawn audit smoke PASSED');
