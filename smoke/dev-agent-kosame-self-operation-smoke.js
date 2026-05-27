'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tool = require('../tools/kosame-self-operation-smoke.js');

console.log('=== kosame-self-operation-smoke smoke ===');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v4.1.0-release-record.md');
const fixturePath = path.join(__dirname, '../fixtures/kosame-self-operation-smoke.sample.json');

assert.strictEqual(pkg.version, '4.5.0', 'package version 4.5.0');
console.log('  PASS: package version 4.5.0');

assert.ok(pkg.scripts['smoke:kosame-self-operation-smoke'], 'script exists: smoke:kosame-self-operation-smoke');
console.log('  PASS: script exists');

assert.ok(fs.existsSync(docPath), 'release record exists');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(fixturePath), 'fixture exists');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '4.1.0', 'tool meta version');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({
  status: 'clean',
  actionsStatus: 'success',
  verifyStatus: 'success',
  claudeAvailable: false,
  geminiAvailable: false
});

assert.strictEqual(packet.dryRun, true, 'dryRun true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'human approval required');
console.log('  PASS: human approval required');

assert.ok(packet.forbiddenActions.includes('rm -rf'), 'forbidden rm -rf');
console.log('  PASS: forbidden rm-rf');

assert.ok(packet.safeCommandSuggestion.includes('npm run verify'), 'safe verify suggestion');
console.log('  PASS: safe verify suggestion');

assert.ok(packet.providerRoute.includes('kosame'), 'kosame self operation route');
console.log('  PASS: provider route');

console.log('PASS: kosame-self-operation-smoke');

