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
const tool   = require('../tools/first-product-repo-claude-prompt-exporter-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-claude-prompt-exporter-pack smoke ===');

assert.ok(compareVersion(pkg.version, '22.0.0') >= 0, `pkg version must be >= 22.0.0, got ${pkg.version}`);
console.log('  PASS: package version 22.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-claude-prompt-exporter'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-claude-prompt-exporter'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v22.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-claude-prompt-exporter.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '22.0.0', 'tool version must be 22.0.0');
console.log('  PASS: tool meta version 22.0.0');

// standard case
const packet = tool.buildPromptExporter({
  targetProduct:        'sales_dx',
  targetRepo:           'kosame-sales-dx',
  taskScope:            '営業DXにリード向けメール一括返信機能を追加する',
  filesAllowedToTouch:  ['src/leads/**', 'tests/**', 'docs/**'],
  filesForbiddenToTouch: ['.env*', 'secrets/**'],
  implementationSteps:  ['Review task spec', 'Implement feature', 'Run verify', 'Report result'],
  verificationCommands: ['node --check src/leads/bulk-email-reply.js', 'npm run verify'],
  dataBoundary:         'No lead PII',
  secretBoundary:       'No API keys',
  rollbackInstruction:  'git checkout -- src/leads/bulk-email-reply.js'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.promptExporterId, 'promptExporterId must be present');
console.log('  PASS: promptExporterId present');

assert.ok(packet.targetProduct, 'targetProduct must be present');
assert.ok(packet.targetRepo, 'targetRepo must be present');
console.log('  PASS: targetProduct and targetRepo present');

assert.ok(packet.claudeRole, 'claudeRole must be present');
console.log('  PASS: claudeRole present');

assert.ok(packet.taskScope, 'taskScope must be present');
console.log('  PASS: taskScope present');

assert.ok(Array.isArray(packet.filesAllowedToTouch) && packet.filesAllowedToTouch.length > 0, 'filesAllowedToTouch must be non-empty');
console.log('  PASS: filesAllowedToTouch present');

assert.ok(Array.isArray(packet.filesForbiddenToTouch) && packet.filesForbiddenToTouch.length > 0, 'filesForbiddenToTouch must be non-empty');
console.log('  PASS: filesForbiddenToTouch present');

assert.ok(Array.isArray(packet.implementationSteps) && packet.implementationSteps.length > 0, 'implementationSteps must be non-empty');
console.log('  PASS: implementationSteps present');

assert.ok(Array.isArray(packet.verificationCommands), 'verificationCommands must be array');
console.log('  PASS: verificationCommands present');

assert.ok(packet.reportFormat, 'reportFormat must be present');
assert.ok(Array.isArray(packet.reportFormat.sections), 'reportFormat.sections must be array');
console.log('  PASS: reportFormat present');

assert.ok(Array.isArray(packet.forbiddenActions) && packet.forbiddenActions.length > 0, 'forbiddenActions must be non-empty');
assert.ok(packet.forbiddenActions.some(a => a.includes('git add')),    'forbiddenActions must include git add');
assert.ok(packet.forbiddenActions.some(a => a.includes('git commit')), 'forbiddenActions must include git commit');
assert.ok(packet.forbiddenActions.some(a => a.includes('git push')),   'forbiddenActions must include git push');
assert.ok(packet.forbiddenActions.some(a => a.includes('git tag')),    'forbiddenActions must include git tag');
assert.ok(packet.forbiddenActions.some(a => a.includes('deploy')),     'forbiddenActions must include deploy');
assert.ok(packet.forbiddenActions.some(a => a.includes('.env')),       'forbiddenActions must include .env');
console.log('  PASS: forbiddenActions valid');

assert.ok(packet.rollbackInstruction, 'rollbackInstruction must be present');
console.log('  PASS: rollbackInstruction present');

assert.strictEqual(packet.promptReady, true, 'promptReady must be true for valid input');
assert.ok(Array.isArray(packet.promptBlockedReasons) && packet.promptBlockedReasons.length === 0, 'promptBlockedReasons must be empty for valid input');
console.log('  PASS: promptReady true, no blockedReasons');

assert.ok(typeof packet.exportedPrompt === 'string' && packet.exportedPrompt.length > 0, 'exportedPrompt must be non-empty string');
assert.ok(packet.exportedPrompt.includes('Claude Code Implementation Prompt'), 'exportedPrompt must include title');
assert.ok(packet.exportedPrompt.includes('Target Repo'),        'exportedPrompt must include Target Repo');
assert.ok(packet.exportedPrompt.includes('Files Allowed'),      'exportedPrompt must include Files Allowed');
assert.ok(packet.exportedPrompt.includes('Files Forbidden'),    'exportedPrompt must include Files Forbidden');
assert.ok(packet.exportedPrompt.includes('Forbidden Actions'),  'exportedPrompt must include Forbidden Actions');
assert.ok(packet.exportedPrompt.includes('git add'),            'exportedPrompt must include git add prohibition');
assert.ok(packet.exportedPrompt.includes('git commit'),         'exportedPrompt must include git commit prohibition');
assert.ok(packet.exportedPrompt.includes('git push'),           'exportedPrompt must include git push prohibition');
assert.ok(packet.exportedPrompt.includes('git tag'),            'exportedPrompt must include git tag prohibition');
assert.ok(packet.exportedPrompt.includes('deploy'),             'exportedPrompt must include deploy prohibition');
assert.ok(packet.exportedPrompt.includes('じゅんやさん'),        'exportedPrompt must include じゅんやさん YES requirement');
assert.ok(packet.exportedPrompt.includes('humanApprovalRequired'), 'exportedPrompt must include humanApprovalRequired');
assert.ok(packet.exportedPrompt.includes('Critical Safety Rules'), 'exportedPrompt must include Critical Safety Rules');
console.log('  PASS: exportedPrompt well-formed with all safety rules');

assert.strictEqual(packet.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(packet.noRealExecution, true, 'noRealExecution must be true');
console.log('  PASS: no real execution flags');

// blocked case: empty taskScope
const blocked = tool.buildPromptExporter({
  targetProduct:       'sales_dx',
  filesAllowedToTouch: ['src/**'],
  taskScope:           ''
});
assert.strictEqual(blocked.promptReady, false, 'promptReady must be false when taskScope is empty');
assert.ok(blocked.promptBlockedReasons.length > 0, 'promptBlockedReasons must be populated when blocked');
assert.ok(blocked.exportedPrompt.includes('BLOCKED'), 'exportedPrompt must indicate BLOCKED');
console.log('  PASS: blocked case handled correctly');

// unknown product case
const unknownPkt = tool.buildPromptExporter({
  targetProduct:       'unknown_xyz',
  taskScope:           'some task',
  filesAllowedToTouch: ['src/**']
});
assert.strictEqual(unknownPkt.promptReady, false, 'promptReady must be false for unknown product');
console.log('  PASS: unknown product blocks export');

// all 5 products produce valid prompt
for (const p of tool.SUPPORTED_PRODUCTS) {
  const pkt = tool.buildPromptExporter({
    targetProduct:       p,
    targetRepo:          `kosame-${p}`,
    taskScope:           `Test task for ${p}`,
    filesAllowedToTouch: ['src/**'],
    filesForbiddenToTouch: ['.env*']
  });
  assert.strictEqual(pkt.promptReady, true, `promptReady must be true for ${p}`);
  assert.ok(pkt.exportedPrompt.includes(p), `exportedPrompt must include product name for ${p}`);
}
console.log('  PASS: all 5 product types produce valid prompt export');

console.log('PASS: first-product-repo-claude-prompt-exporter-pack');
