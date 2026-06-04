'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-release-candidate-builder-pack.fixture.json');
const tool = require('../tools/dev-agent-release-candidate-builder-pack');

function pass(message) { console.log(`  PASS: ${message}`); }

console.log('=== dev-agent-release-candidate-builder-pack smoke ===');

assert.ok(pkg.version >= '89.0.0'); pass('package version 89.0.0 or later');
assert.ok(fs.existsSync(__filename)); pass('smoke script exists');
assert.ok(pkg.scripts['pm-agent:release-candidate-builder']); pass('pm-agent:release-candidate-builder exists');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-release-candidate-builder-pack.fixture.json'))); pass('fixture exists');
assert.strictEqual(tool.TOOL_META.version, '89.0.0'); pass('tool meta version 89.0.0');

const result = tool.buildReleaseCandidateBuilder(fixture);
assert.ok(Object.prototype.hasOwnProperty.call(result, 'commitCandidate')); pass('commitCandidate exists');
assert.ok(result.excludedFiles.includes('kosame-dev-orchestra@14.0.0')); pass('excludedFiles includes kosame-dev-orchestra@14.0.0');
assert.ok(result.excludedFiles.includes('node')); pass('excludedFiles includes node');
assert.ok(result.excludedFiles.includes('*.bak_v85_input_file')); pass('excludedFiles includes runner backups');
assert.strictEqual(result.backupPlan.sha256Required, true); pass('backupPlan includes SHA256');
assert.ok(result.dangerousActionsDenied.includes('secret read')); pass('dangerousActionsDenied correct');

console.log('=== dev-agent-release-candidate-builder-pack smoke PASSED ===');
