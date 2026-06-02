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
const tool         = require('../tools/first-real-product-repo-execution-prompt-pack.js');
const dispatchTool = require('../tools/first-real-product-repo-dispatch-plan-pack.js');
const safetyTool   = require('../tools/product-repo-safety-gate-review-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-product-repo-execution-prompt-pack smoke ===');

assert.ok(compareVersion(pkg.version, '24.0.0') >= 0, `pkg version must be >= 24.0.0, got ${pkg.version}`);
console.log('  PASS: package version 24.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-product-repo-execution-prompt-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-product-repo-execution-prompt-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v24.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-real-product-repo-execution-prompt-pack.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '24.0.0', 'tool version must be 24.0.0');
console.log('  PASS: tool meta version 24.0.0');

const dispatchPlan = dispatchTool.buildDispatchPlan({
  targetProduct: 'sales_dx', taskTitle: 'テスト機能', taskGoal: 'テスト目的', businessContext: 'context'
});
const safetyReview = safetyTool.buildSafetyGateReview({ targetProduct: 'sales_dx', dispatchPlan });

const pack = tool.buildExecutionPromptPack({
  targetProduct:    'sales_dx',
  targetRepo:       'kosame-sales-dx',
  taskScope:        '営業DXにリード向けメール一括返信機能を追加する',
  filesAllowedToTouch:   ['src/leads/**', 'tests/**', 'docs/**'],
  filesForbiddenToTouch: ['.env*', 'secrets/**'],
  dispatchPlan,
  safetyReview,
  safetyGatePassed: true
});

assert.strictEqual(pack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(pack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(pack.executionPromptPackId, 'executionPromptPackId must be present');
console.log('  PASS: executionPromptPackId present');

assert.ok(pack.targetProduct, 'targetProduct must be present');
assert.ok(pack.targetRepo, 'targetRepo must be present');
console.log('  PASS: targetProduct and targetRepo present');

assert.ok(pack.claudeRole, 'claudeRole must be present');
console.log('  PASS: claudeRole present');

assert.ok(pack.taskScope, 'taskScope must be present');
console.log('  PASS: taskScope present');

assert.ok(Array.isArray(pack.implementationSteps) && pack.implementationSteps.length > 0, 'implementationSteps must be non-empty');
assert.ok(pack.implementationSteps.some(s => s.includes('STOP')), 'implementationSteps must include STOP instruction');
console.log('  PASS: implementationSteps includes STOP instruction');

assert.ok(Array.isArray(pack.filesAllowedToTouch) && pack.filesAllowedToTouch.length > 0, 'filesAllowedToTouch must be non-empty');
assert.ok(Array.isArray(pack.filesForbiddenToTouch) && pack.filesForbiddenToTouch.length > 0, 'filesForbiddenToTouch must be non-empty');
console.log('  PASS: file zone arrays present');

assert.ok(Array.isArray(pack.commandsAllowed) && pack.commandsAllowed.length > 0, 'commandsAllowed must be non-empty');
assert.ok(pack.commandsAllowed.some(c => c.includes('node --check')), 'commandsAllowed must include node --check');
assert.ok(pack.commandsAllowed.some(c => c.includes('git status')), 'commandsAllowed must include git status');
console.log('  PASS: commandsAllowed valid');

assert.ok(Array.isArray(pack.commandsForbidden) && pack.commandsForbidden.length > 0, 'commandsForbidden must be non-empty');
assert.ok(pack.commandsForbidden.some(c => c.includes('git add')),    'commandsForbidden must include git add');
assert.ok(pack.commandsForbidden.some(c => c.includes('git commit')), 'commandsForbidden must include git commit');
assert.ok(pack.commandsForbidden.some(c => c.includes('git push')),   'commandsForbidden must include git push');
assert.ok(pack.commandsForbidden.some(c => c.includes('git tag')),    'commandsForbidden must include git tag');
assert.ok(pack.commandsForbidden.some(c => c.includes('deploy')),     'commandsForbidden must include deploy');
assert.ok(pack.commandsForbidden.some(c => c.includes('.env')),       'commandsForbidden must include .env');
console.log('  PASS: commandsForbidden valid');

assert.ok(Array.isArray(pack.verificationCommands), 'verificationCommands must be array');
console.log('  PASS: verificationCommands present');

assert.ok(pack.reportFormat, 'reportFormat must be present');
assert.ok(Array.isArray(pack.reportFormat.requiredFields), 'reportFormat.requiredFields must be array');
assert.ok(pack.reportFormat.requiredFields.includes('editedFiles'),  'must include editedFiles');
assert.ok(pack.reportFormat.requiredFields.includes('diffSummary'),  'must include diffSummary');
assert.ok(pack.reportFormat.requiredFields.includes('rollbackNote'), 'must include rollbackNote');
console.log('  PASS: reportFormat valid');

assert.ok(pack.rollbackInstruction, 'rollbackInstruction must be present');
console.log('  PASS: rollbackInstruction present');

assert.strictEqual(pack.promptReady, true, 'promptReady must be true for valid input');
assert.ok(Array.isArray(pack.promptBlockedReasons) && pack.promptBlockedReasons.length === 0, 'promptBlockedReasons must be empty');
console.log('  PASS: promptReady true, no blockers');

assert.ok(typeof pack.exportedExecutionPrompt === 'string' && pack.exportedExecutionPrompt.length > 0, 'exportedExecutionPrompt must be non-empty string');
// Critical safety rule checks in prompt
assert.ok(pack.exportedExecutionPrompt.includes('Claude Code Execution Prompt'), 'prompt must include title');
assert.ok(pack.exportedExecutionPrompt.includes('Files Allowed to Touch'),       'prompt must include allowed files');
assert.ok(pack.exportedExecutionPrompt.includes('Files Forbidden to Touch'),     'prompt must include forbidden files');
assert.ok(pack.exportedExecutionPrompt.includes('Commands Forbidden'),           'prompt must include forbidden commands');
assert.ok(pack.exportedExecutionPrompt.includes('CRITICAL SAFETY RULES'),       'prompt must include CRITICAL SAFETY RULES');
assert.ok(pack.exportedExecutionPrompt.includes('git add'),                      'prompt must mention git add prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('git commit'),                   'prompt must mention git commit prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('git push'),                     'prompt must mention git push prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('git tag'),                      'prompt must mention git tag prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('deploy'),                       'prompt must mention deploy prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('.env'),                         'prompt must mention .env prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('customer PII'),                 'prompt must mention customer PII prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('insurance'),                    'prompt must mention insurance prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('health'),                       'prompt must mention health records prohibition');
assert.ok(pack.exportedExecutionPrompt.includes('じゅんやさん'),                  'prompt must include じゅんやさん YES requirement');
assert.ok(pack.exportedExecutionPrompt.includes('humanApprovalRequired'),        'prompt must include humanApprovalRequired');
assert.ok(pack.exportedExecutionPrompt.includes('commit candidate'),             'prompt must mention commit candidate stop');
console.log('  PASS: exportedExecutionPrompt well-formed with all safety rules');

assert.ok(pack.handoffToKosame, 'handoffToKosame must be present');
assert.ok(pack.handoffToKosame.target, 'handoffToKosame.target must be present');
assert.ok(pack.handoffToKosame.status, 'handoffToKosame.status must be present');
console.log('  PASS: handoffToKosame present');

// blocked: safety gate not passed
const blockedPack = tool.buildExecutionPromptPack({
  targetProduct:       'sales_dx',
  taskScope:           'test',
  filesAllowedToTouch: ['src/**'],
  safetyGatePassed:    false
});
assert.strictEqual(blockedPack.promptReady, false, 'promptReady must be false when safety gate not passed');
assert.ok(blockedPack.promptBlockedReasons.some(r => r.includes('Safety gate')), 'blocked reasons must mention safety gate');
assert.ok(blockedPack.exportedExecutionPrompt.includes('BLOCKED'), 'exportedExecutionPrompt must indicate BLOCKED');
console.log('  PASS: safety gate block handled correctly');

// blocked: empty taskScope
const noScopePack = tool.buildExecutionPromptPack({
  targetProduct:       'sales_dx',
  filesAllowedToTouch: ['src/**'],
  safetyGatePassed:    true,
  taskScope:           ''
});
assert.strictEqual(noScopePack.promptReady, false, 'promptReady must be false for empty taskScope');
console.log('  PASS: empty taskScope block handled correctly');

// all 5 products produce valid prompt when safety gate passed
for (const p of tool.SUPPORTED_PRODUCTS) {
  const pPack = tool.buildExecutionPromptPack({
    targetProduct:       p,
    targetRepo:          `kosame-${p}`,
    taskScope:           `Test task for ${p}`,
    filesAllowedToTouch: ['src/**'],
    filesForbiddenToTouch: ['.env*'],
    safetyGatePassed:    true
  });
  assert.strictEqual(pPack.promptReady, true, `promptReady must be true for ${p}`);
  assert.ok(pPack.exportedExecutionPrompt.includes('CRITICAL SAFETY RULES'), `prompt must include safety rules for ${p}`);
}
console.log('  PASS: all 5 product types produce valid execution prompt pack');

assert.strictEqual(pack.noRealRepoEdit,  true, 'noRealRepoEdit must be true');
assert.strictEqual(pack.noRealExecution, true, 'noRealExecution must be true');
console.log('  PASS: no real execution flags');

console.log('PASS: first-real-product-repo-execution-prompt-pack');
