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
const tool   = require('../tools/kosame-dev-orchestra-operating-manual-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== kosame-dev-orchestra-operating-manual-pack smoke ===');

assert.ok(compareVersion(pkg.version, '39.0.0') >= 0, `pkg version must be >= 39.0.0, got ${pkg.version}`);
console.log('  PASS: package version 39.0.0 or later');

assert.ok(pkg.scripts['smoke:kosame-dev-orchestra-operating-manual-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:kosame-dev-orchestra-operating-manual-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v39.0.0-release-record.md')), 'v39 release record must exist');
console.log('  PASS: v39 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/kosame-dev-orchestra-operating-manual.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '39.0.0', 'tool version must be 39.0.0');
console.log('  PASS: tool meta version 39.0.0');

const manual = tool.buildOperatingManual({});

assert.strictEqual(manual.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(manual.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(manual.operatingManualId, 'operatingManualId must be present');
console.log('  PASS: operatingManualId present');

assert.ok(manual.overview, 'overview must be present');
assert.ok(manual.overview.safetyFirst, 'overview.safetyFirst must be present');
assert.ok(manual.overview.noAutoOps, 'overview.noAutoOps must be present');
console.log('  PASS: overview with safety info present');

assert.ok(Array.isArray(manual.supportedProductTypes) && manual.supportedProductTypes.length === 5, 'supportedProductTypes must have 5 products');
console.log('  PASS: supportedProductTypes has 5 products');

assert.ok(manual.providerRoleMap, 'providerRoleMap must be present');
const requiredProviders = ['じゅんやさん (Human)', 'Kosame/GPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Kimi', 'Cloud Shell'];
for (const provider of requiredProviders) {
  assert.ok(manual.providerRoleMap[provider], `providerRoleMap must include ${provider}`);
}
console.log('  PASS: providerRoleMap has all 8 providers');

assert.ok(Array.isArray(manual.standardOperationFlow) && manual.standardOperationFlow.length > 0, 'standardOperationFlow must be non-empty');
assert.ok(manual.standardOperationFlow.length >= 15, 'standardOperationFlow must have at least 15 steps');
console.log('  PASS: standardOperationFlow has 15+ steps');

assert.ok(Array.isArray(manual.versionMilestones) && manual.versionMilestones.length > 0, 'versionMilestones must be non-empty');
assert.ok(manual.versionMilestones.some(m => m.range.includes('v36')), 'versionMilestones must include v36-v40 range');
console.log('  PASS: versionMilestones covers v36–v40');

assert.ok(Array.isArray(manual.humanApprovalGates) && manual.humanApprovalGates.length > 0, 'humanApprovalGates must be non-empty');
assert.ok(manual.humanApprovalGates.some(g => g.approver && g.approver.includes('じゅんやさん')), 'humanApprovalGates must mention じゅんやさん');
console.log('  PASS: humanApprovalGates correct');

assert.ok(Array.isArray(manual.forbiddenActions) && manual.forbiddenActions.length > 0, 'forbiddenActions must be non-empty');
assert.ok(manual.forbiddenActions.some(a => a.includes('deploy')), 'deploy must be forbidden');
assert.ok(manual.forbiddenActions.some(a => a.includes('secret')), 'secret read must be forbidden');
console.log('  PASS: forbiddenActions correct');

assert.ok(manual.safeCommandPolicy, 'safeCommandPolicy must be present');
assert.ok(Array.isArray(manual.safeCommandPolicy.alwaysAllowed), 'safeCommandPolicy.alwaysAllowed must be array');
assert.ok(Array.isArray(manual.safeCommandPolicy.requiresHumanYes), 'safeCommandPolicy.requiresHumanYes must be array');
assert.ok(Array.isArray(manual.safeCommandPolicy.alwaysBlocked), 'safeCommandPolicy.alwaysBlocked must be array');
assert.ok(manual.safeCommandPolicy.requiresHumanYes.some(c => c.includes('git commit')), 'git commit must require human YES');
console.log('  PASS: safeCommandPolicy correct');

assert.ok(manual.firstProductRepoTaskProcedure, 'firstProductRepoTaskProcedure must be present');
assert.ok(manual.resultImportProcedure, 'resultImportProcedure must be present');
assert.ok(manual.commitCandidateProcedure, 'commitCandidateProcedure must be present');
assert.ok(manual.rollbackProcedure, 'rollbackProcedure must be present');
console.log('  PASS: procedure sections present');

assert.ok(Array.isArray(manual.troubleshootingNotes) && manual.troubleshootingNotes.length > 0, 'troubleshootingNotes must be non-empty');
console.log('  PASS: troubleshootingNotes present');

assert.ok(Array.isArray(manual.nextVersionCandidates) && manual.nextVersionCandidates.length > 0, 'nextVersionCandidates must be non-empty');
console.log('  PASS: nextVersionCandidates present');

assert.strictEqual(manual.manualReady, true, 'manualReady must be true');
console.log('  PASS: manualReady true');

assert.strictEqual(manual.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(manual.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

console.log('PASS: kosame-dev-orchestra-operating-manual-pack');
