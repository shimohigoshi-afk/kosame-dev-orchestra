'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-offer-pricing-test-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-offer-pricing-test-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 72, `pkg version must be >= 72.0.0, got ${pkg.version}`);
console.log('  PASS: package version 72.0.0 or later');

assert.ok(pkg.scripts['smoke:offer-pricing-test'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:offer-pricing-test'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:offer-pricing-test exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-offer-pricing-test-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '72.0.0', 'tool version must be 72.0.0');
console.log('  PASS: tool meta version 72.0.0');

const result = tool.buildOfferPricingTest({ productIdea: 'AI議事録自動化ツール' });

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.offerVariants) && result.offerVariants.length >= 2, 'offerVariants must have 2+ items');
for (const v of result.offerVariants) {
  assert.ok(v.variantId && v.name && v.cta && v.hypothesis, `offerVariant ${v.variantId} must have required fields`);
}
console.log('  PASS: offerVariants[] has 2+ items with required fields');

assert.ok(result.pricingMatrix, 'pricingMatrix must exist');
assert.strictEqual(result.pricingMatrix.hardGuarantee, false, 'pricingMatrix.hardGuarantee must be false');
assert.ok(Array.isArray(result.pricingMatrix.pricingPrinciples) && result.pricingMatrix.pricingPrinciples.length > 0, 'pricingPrinciples must exist');
console.log('  PASS: pricingMatrix exists (not a hard guarantee)');

assert.ok(Array.isArray(result.testMethodology) && result.testMethodology.length > 0, 'testMethodology must exist');
assert.ok(Array.isArray(result.successMetrics)  && result.successMetrics.length  > 0, 'successMetrics must exist');
console.log('  PASS: testMethodology and successMetrics exist');

assert.strictEqual(result.realBillingExecuted, false, 'realBillingExecuted must be false');
console.log('  PASS: realBillingExecuted false');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real payment')),   'must deny real payment');
assert.ok(denied.some(d => d.includes('real billing')),   'must deny real billing');
assert.ok(denied.some(d => d.includes('real contract')),  'must deny real contract');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-offer-pricing-test-pack smoke PASSED ===');
