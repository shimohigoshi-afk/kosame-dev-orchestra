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
const tool = require('../tools/product-specific-generator-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-specific-generator-pack smoke ===');

assert.ok(compareVersion(pkg.version, '6.3.0') >= 0);
console.log('  PASS: package version 6.3.0 or later');

assert.ok(pkg.scripts['smoke:product-specific-generator-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v6.3.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-specific-generator.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '6.3.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ productLine: 'backoffice', taskGoal: 'implement feature X' });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const config = tool.getProductConfig('anesty_board');
assert.strictEqual(config.primaryProvider, 'kosame');
assert.strictEqual(config.defaultRiskLevel, 'critical');
console.log('  PASS: anesty_board → kosame primary, critical risk');

const config2 = tool.getProductConfig('sales_dx');
assert.strictEqual(config2.primaryProvider, 'claude');
console.log('  PASS: sales_dx → claude primary');

const wb = tool.generateWorkBreakdown('ai_bot', 'implement chatbot');
const releasePhase = wb.phases.find(p => p.phase === 'release');
assert.strictEqual(releasePhase.owner, 'human');
assert.strictEqual(releasePhase.humanApprovalRequired, true);
console.log('  PASS: release phase owner = human');

const pa = tool.generateProviderAssignment('cloud_run_launch_pack');
assert.strictEqual(pa.execution, 'cloudShell');
assert.strictEqual(pa.approval, 'human');
console.log('  PASS: cloud_run_launch_pack provider assignment correct');

const vp = tool.generateVerificationPlan('backoffice');
assert.ok(vp.steps.length > 0);
assert.strictEqual(vp.humanApprovalRequired, true);
console.log('  PASS: verification plan has steps');

const supportedLines = packet.supportedProductLines;
assert.ok(supportedLines.includes('anesty_board'));
assert.ok(supportedLines.includes('email_reply'));
console.log('  PASS: supported product lines complete');

console.log('PASS: product-specific-generator-pack');
