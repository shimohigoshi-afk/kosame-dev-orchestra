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
const tool   = require('../tools/claude-execution-prompt-exporter-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== claude-execution-prompt-exporter-pack smoke ===');

assert.ok(compareVersion(pkg.version, '13.0.0') >= 0, `package version must be 13.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 13.0.0 or later');

assert.ok(pkg.scripts['smoke:claude-execution-prompt-exporter-pack'], 'smoke:claude-execution-prompt-exporter-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:claude-execution-prompt-exporter'], 'pm-agent:claude-execution-prompt-exporter must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v12.5.0-release-record.md')),
  'v12.5.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/claude-execution-prompt-exporter.sample.json')),
  'fixture claude-execution-prompt-exporter.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '12.5.0', 'tool meta version must be 12.5.0');
console.log('  PASS: tool meta version 12.5.0');

const sampleDocsTask = {
  normalizedDocsTask: {
    taskGoal: 'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する'
  }
};

const packet = tool.buildExporter({
  docsTaskPacket:     sampleDocsTask,
  repoStatus:         'git clean, smoke passing',
  implementationMode: 'dry-run'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.exporterId, 'exporterId must be present');
console.log('  PASS: exporterId present');

assert.ok(typeof packet.claudePrompt === 'string' && packet.claudePrompt.length > 0, 'claudePrompt must be present');
console.log('  PASS: claudePrompt present');

assert.ok(packet.claudePrompt.includes('allowedFiles'),    'claudePrompt must include allowedFiles section');
assert.ok(packet.claudePrompt.includes('deniedFiles'),     'claudePrompt must include deniedFiles section');
assert.ok(packet.claudePrompt.includes('verifyCommands'),  'claudePrompt must include verifyCommands section');
assert.ok(packet.claudePrompt.includes('doneCriteria'),    'claudePrompt must include doneCriteria section');
assert.ok(packet.claudePrompt.includes('forbiddenActions'),'claudePrompt must include forbiddenActions section');
console.log('  PASS: claudePrompt includes allowedFiles / deniedFiles / verifyCommands / doneCriteria / forbiddenActions');

assert.ok(packet.claudePrompt.includes('git commit'), 'claudePrompt must mention git commit restriction');
assert.ok(packet.claudePrompt.includes('git push'),   'claudePrompt must mention git push restriction');
assert.ok(packet.claudePrompt.includes('git tag'),    'claudePrompt must mention git tag restriction');
console.log('  PASS: claudePrompt includes no git add / commit / push / tag');

assert.ok(packet.claudePrompt.includes('Secret'),  'claudePrompt must mention Secret restriction');
assert.ok(packet.claudePrompt.includes('.env'),     'claudePrompt must mention .env restriction');
assert.ok(packet.claudePrompt.includes('API key'),  'claudePrompt must mention API key restriction');
console.log('  PASS: claudePrompt includes no Secret / .env / API key reading');

assert.strictEqual(packet.exportPassed, true, 'exportPassed must be true');
console.log('  PASS: exportPassed true');

assert.ok(typeof packet.recommendedNextAction === 'string' && packet.recommendedNextAction.length > 0,
  'recommendedNextAction must be present');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: claude-execution-prompt-exporter-pack');
