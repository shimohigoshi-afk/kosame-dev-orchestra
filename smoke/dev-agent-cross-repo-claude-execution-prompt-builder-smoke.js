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
const tool   = require('../tools/cross-repo-claude-execution-prompt-builder-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== cross-repo-claude-execution-prompt-builder-pack smoke ===');

assert.ok(compareVersion(pkg.version, '17.0.0') >= 0, `pkg version must be >= 17.0.0, got ${pkg.version}`);
console.log('  PASS: package version 17.0.0 or later');

assert.ok(pkg.scripts['smoke:cross-repo-claude-execution-prompt-builder'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:cross-repo-claude-execution-prompt-builder'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v17.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/cross-repo-claude-execution-prompt-builder.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '17.0.0', 'tool version must be 17.0.0');
console.log('  PASS: tool meta version 17.0.0');

const packet = tool.buildPrompt({
  targetRepo:   'kosame-sales-dx',
  productType:  'sales_dx',
  taskGoal:     'CSVエクスポート機能を追加する',
  implementationScope: 'src/leads/csv-export.js'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.promptId, 'promptId must be present');
console.log('  PASS: promptId present');

assert.ok(packet.targetRepo, 'targetRepo must be present');
console.log('  PASS: targetRepo present');

assert.ok(Array.isArray(packet.allowedFiles) && packet.allowedFiles.length > 0, 'allowedFiles must be non-empty');
console.log('  PASS: allowedFiles present');

assert.ok(Array.isArray(packet.deniedFiles) && packet.deniedFiles.length > 0, 'deniedFiles must be non-empty');
console.log('  PASS: deniedFiles present');

assert.ok(Array.isArray(packet.forbiddenActions) && packet.forbiddenActions.length > 0, 'forbiddenActions must be non-empty');
assert.ok(packet.forbiddenActions.includes('git commit'), 'must include git commit');
assert.ok(packet.forbiddenActions.includes('git push'),   'must include git push');
assert.ok(packet.forbiddenActions.includes('git tag'),    'must include git tag');
assert.ok(packet.forbiddenActions.includes('deploy'),     'must include deploy');
console.log('  PASS: forbiddenActions valid');

assert.ok(Array.isArray(packet.verifyCommands), 'verifyCommands must be array');
console.log('  PASS: verifyCommands present');

assert.ok(Array.isArray(packet.doneCriteria), 'doneCriteria must be array');
console.log('  PASS: doneCriteria present');

assert.ok(packet.reportFormat, 'reportFormat must be present');
console.log('  PASS: reportFormat present');

assert.ok(typeof packet.rollbackPolicy === 'string', 'rollbackPolicy must be string');
console.log('  PASS: rollbackPolicy present');

assert.ok(typeof packet.claudePrompt === 'string' && packet.claudePrompt.length > 0, 'claudePrompt must be non-empty string');
assert.ok(packet.claudePrompt.includes('Target Repo'),       'prompt must include Target Repo');
assert.ok(packet.claudePrompt.includes('Forbidden Actions'), 'prompt must include Forbidden Actions');
assert.ok(packet.claudePrompt.includes('git commit'),        'prompt must include git commit in forbidden');
console.log('  PASS: claudePrompt well-formed');

assert.strictEqual(packet.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(packet.noRealExecution, true, 'noRealExecution must be true');
console.log('  PASS: no real execution flags');

console.log('PASS: cross-repo-claude-execution-prompt-builder-pack');
