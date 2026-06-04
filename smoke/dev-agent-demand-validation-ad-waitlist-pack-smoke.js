'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-demand-validation-ad-waitlist-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-demand-validation-ad-waitlist-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 63, `pkg version must be >= 63.0.0, got ${pkg.version}`);
console.log('  PASS: package version 63.0.0 or later');

assert.ok(pkg.scripts['smoke:demand-validation-ad-waitlist'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:demand-validation-ad-waitlist'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:demand-validation-ad-waitlist exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-demand-validation-ad-waitlist-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '63.0.0', 'tool version must be 63.0.0');
console.log('  PASS: tool meta version 63.0.0');

const result = tool.buildDemandValidation({ productIdea: 'AI議事録自動化ツール' });

assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// validationChannels include all required
const REQUIRED_CHANNELS = ['x_post', 'x_ads', 'meta_ads', 'organic_sns', 'existing_customer_interview'];
for (const ch of REQUIRED_CHANNELS) {
  assert.ok(result.validationChannels.includes(ch), `validationChannels must include ${ch}`);
}
console.log('  PASS: validationChannels include x_post/x_ads/meta_ads/organic_sns/existing_customer_interview');

// cpaCalculationMethod
assert.ok(result.cpaCalculationMethod, 'cpaCalculationMethod must exist');
console.log('  PASS: cpaCalculationMethod exists');

// cpaThreshold includes 100-300 strong signal
const thresholds = result.cpaThreshold;
assert.ok(thresholds.strong && thresholds.strong.max <= 300, 'strong CPA threshold must be ≤ 300');
assert.ok(thresholds.strong.note.includes('強い'), 'strong threshold note must mention strong signal');
assert.ok(thresholds.moderate, 'moderate threshold must exist');
assert.ok(thresholds.weak,     'weak threshold must exist');
console.log('  PASS: cpaThreshold includes 100-300 strong signal');

// passCondition / pivotCondition
assert.ok(Array.isArray(result.passCondition)  && result.passCondition.length  > 0, 'passCondition must exist');
assert.ok(Array.isArray(result.pivotCondition) && result.pivotCondition.length > 0, 'pivotCondition must exist');
console.log('  PASS: passCondition / pivotCondition exist');

// adBudgetPlan is exampleOnly / optional, not executed
const abp = result.adBudgetPlan;
assert.ok(abp.isExampleOnly === true,        'adBudgetPlan.isExampleOnly must be true');
assert.ok(abp.isOptional    === true,        'adBudgetPlan.isOptional must be true');
assert.ok(abp.executedInThisPack === false,  'adBudgetPlan.executedInThisPack must be false');
assert.ok(abp.hardGuarantee === false,       'adBudgetPlan.hardGuarantee must be false');
console.log('  PASS: adBudgetPlan is exampleOnly/optional/not executed');

// no real ads launched
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real ad launch')),   'must deny real ad launch');
assert.ok(denied.some(d => d.includes('real SNS post')),    'must deny real SNS post');
assert.ok(denied.some(d => d.includes('real LP publish')),  'must deny real LP publish');
console.log('  PASS: no real ads launched (dangerousActionsDenied correct)');

// classifyCpa export
assert.ok(typeof tool.classifyCpa === 'function', 'classifyCpa must be exported');
const strong   = tool.classifyCpa(200);
const moderate = tool.classifyCpa(500);
const weak     = tool.classifyCpa(1500);
assert.ok(strong.label   === 'strong_signal',    `CPA 200 should be strong_signal, got ${strong.label}`);
assert.ok(moderate.label === 'moderate_signal',  `CPA 500 should be moderate_signal, got ${moderate.label}`);
assert.ok(weak.label     === 'weak_or_no_signal', `CPA 1500 should be weak_or_no_signal, got ${weak.label}`);
console.log('  PASS: classifyCpa: 200→strong / 500→moderate / 1500→weak');

// resultReviewTemplate
assert.ok(result.resultReviewTemplate && Array.isArray(result.resultReviewTemplate.fields), 'resultReviewTemplate must exist');
console.log('  PASS: resultReviewTemplate exists');

console.log('=== dev-agent-demand-validation-ad-waitlist-pack smoke PASSED ===');
