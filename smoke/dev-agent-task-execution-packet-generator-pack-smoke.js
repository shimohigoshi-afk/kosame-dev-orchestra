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
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/task-execution-packet-generator-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== task-execution-packet-generator-pack smoke ===');

assert.ok(compareVersion(pkg.version, '7.2.0') >= 0, `package version must be 7.2.0+, got ${pkg.version}`);
console.log('  PASS: package version 7.2.0 or later');

assert.ok(pkg.scripts['smoke:task-execution-packet-generator-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v7.2.0-release-record.md')),
  'release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/task-execution-packet-generator.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '7.2.0', 'tool meta version must be 7.2.0');
console.log('  PASS: tool meta version 7.2.0');

const packet = tool.buildPacket({
  taskGoal:    'implement release note generator',
  taskType:    'implementation',
  productLine: 'backoffice',
  riskLevel:   'low',
  dataLevel:   'A',
  provider:    'claude',
  repoPath:    '.'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// allowedFiles
assert.ok(Array.isArray(packet.allowedFiles), 'allowedFiles must be an array');
assert.ok(packet.allowedFiles.length > 0, 'allowedFiles must not be empty');
console.log('  PASS: allowedFiles present');

// deniedFiles
assert.ok(Array.isArray(packet.deniedFiles), 'deniedFiles must be an array');
assert.ok(packet.deniedFiles.length > 0, 'deniedFiles must not be empty');
const deniedStr = JSON.stringify(packet.deniedFiles);
assert.ok(deniedStr.includes('.env'), 'deniedFiles must include .env');
console.log('  PASS: deniedFiles present and includes .env');

// verifyCommands
assert.ok(Array.isArray(packet.verifyCommands), 'verifyCommands must be an array');
assert.ok(packet.verifyCommands.length > 0, 'verifyCommands must not be empty');
const vcStr = JSON.stringify(packet.verifyCommands);
assert.ok(vcStr.includes('node --check'), 'verifyCommands must include node --check');
assert.ok(vcStr.includes('npm run verify'), 'verifyCommands must include npm run verify');
console.log('  PASS: verifyCommands include node --check and npm run verify');

// doneCriteria
assert.ok(Array.isArray(packet.doneCriteria), 'doneCriteria must be an array');
assert.ok(packet.doneCriteria.length > 0, 'doneCriteria must not be empty');
console.log('  PASS: doneCriteria present');

// forbiddenActions
assert.ok(Array.isArray(packet.forbiddenActions), 'forbiddenActions must be an array');
assert.ok(packet.forbiddenActions.length > 0, 'forbiddenActions must not be empty');
assert.ok(packet.forbiddenActions.includes('git push'), 'forbiddenActions must include git push');
assert.ok(packet.forbiddenActions.includes('git tag'), 'forbiddenActions must include git tag');
assert.ok(packet.forbiddenActions.includes('deploy'), 'forbiddenActions must include deploy');
assert.ok(packet.forbiddenActions.includes('Secret value read'), 'forbiddenActions must include secret');
console.log('  PASS: forbiddenActions includes git push / git tag / deploy / secret');

// reportFormat
assert.ok(packet.reportFormat, 'reportFormat must be present');
assert.ok(packet.reportFormat.requiredFields, 'reportFormat.requiredFields must be present');
assert.ok(Array.isArray(packet.reportFormat.requiredFields), 'reportFormat.requiredFields must be an array');
assert.ok(packet.reportFormat.requiredFields.includes('status'), 'reportFormat must include status field');
assert.ok(packet.reportFormat.requiredFields.includes('filesChanged'), 'reportFormat must include filesChanged field');
console.log('  PASS: reportFormat includes required fields');

// packetId
assert.ok(packet.packetId, 'packetId must be present');
console.log('  PASS: packetId present');

// Level C check
const levelCPacket = tool.buildPacket({
  taskGoal: 'process health data', taskType: 'implementation',
  productLine: 'anesty_board', riskLevel: 'low', dataLevel: 'C',
  provider: 'kosame', repoPath: '.'
});
assert.ok(levelCPacket.dataLevelNote.includes('Level C'), 'Level C data note must be present');
const levelCForbidden = JSON.stringify(levelCPacket.forbiddenActions);
assert.ok(levelCForbidden.includes('external AI provider'), 'Level C must forbid external AI provider dispatch');
console.log('  PASS: Level C blocks external provider dispatch');

// anesty_board
assert.ok(tool.PRODUCT_LINES.includes('sales_dx'),    'sales_dx must be in PRODUCT_LINES');
assert.ok(tool.PRODUCT_LINES.includes('anesty_board'), 'anesty_board must be in PRODUCT_LINES');
console.log('  PASS: product lines include sales_dx and anesty_board');

assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be a string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: task-execution-packet-generator-pack');
