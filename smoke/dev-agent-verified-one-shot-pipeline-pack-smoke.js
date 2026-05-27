'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tool = require('../tools/verified-one-shot-pipeline-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== verified-one-shot-pipeline-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.9.0') >= 0);
console.log('  PASS: package version 5.9.0 or later');

assert.ok(pkg.scripts['smoke:verified-one-shot-pipeline-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.9.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/verified-one-shot-pipeline.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.9.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ task: { description: 'implement feature', provider: 'claude', dataLevel: 'A' } });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const safeCheck = tool.runSafetyCheck({ description: 'implement feature X', dataLevel: 'A', provider: 'claude' });
assert.strictEqual(safeCheck.passed, true);
console.log('  PASS: safe task passes safety check');

const blockedCheck = tool.runSafetyCheck({ description: 'read API key value', dataLevel: 'A', provider: 'claude' });
assert.strictEqual(blockedCheck.passed, false);
console.log('  PASS: API key blocked in safety check');

const levelCCheck = tool.runSafetyCheck({ description: 'review feature', dataLevel: 'C', provider: 'claude' });
assert.strictEqual(levelCCheck.passed, false);
console.log('  PASS: level C blocked for external provider');

const pipeline = tool.runPipeline({ description: 'implement feature', dataLevel: 'A', provider: 'claude' });
assert.strictEqual(pipeline.ok, true);
assert.ok(pipeline.stages.safety_check);
console.log('  PASS: pipeline runs with safe task');

const aborted = tool.runPipeline({ description: 'read .env value', dataLevel: 'A', provider: 'claude' });
assert.strictEqual(aborted.ok, false);
assert.strictEqual(aborted.abortedAt, 'safety_check');
console.log('  PASS: pipeline aborts on safety failure');

const verified = tool.runVerification({ result: 'ok' });
assert.strictEqual(verified.passed, true);
console.log('  PASS: verification passes with result field');

console.log('PASS: verified-one-shot-pipeline-pack');
