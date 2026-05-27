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
const tool = require('../tools/project-template-applicator-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== project-template-applicator-pack smoke ===');

assert.ok(compareVersion(pkg.version, '6.2.0') >= 0);
console.log('  PASS: package version 6.2.0 or later');

assert.ok(pkg.scripts['smoke:project-template-applicator-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v6.2.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/project-template-applicator.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '6.2.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ projectName: 'test-project', version: '1.0.0', productLine: 'backoffice' });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

assert.ok(Array.isArray(packet.standardDirectories));
assert.ok(packet.standardDirectories.includes('docs/ai-dev-team'));
console.log('  PASS: standard directories include docs/ai-dev-team');

const dirPlan = tool.generateDirectoryPlan('my-project');
assert.strictEqual(dirPlan.length, tool.STANDARD_DIRECTORIES.length);
console.log('  PASS: directory plan length matches standard dirs');

const filePlan = tool.generateFilePlan('my-project', '1.0.0');
assert.ok(filePlan.length > 0);
assert.ok(filePlan.some(f => f.path.includes('my-project')));
console.log('  PASS: file plan contains project name');

const template = tool.applyTemplate({ projectName: 'sample', version: '2.0.0', productLine: 'ai_bot' });
assert.ok(template.approvalGates.commitGate.requiresHumanApproval);
assert.ok(template.approvalGates.deployGate.requiresHumanApproval);
console.log('  PASS: approval gates require human approval');

console.log('PASS: project-template-applicator-pack');
