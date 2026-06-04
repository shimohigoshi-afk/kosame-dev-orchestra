'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-guardian-customer-facing-operation-guard-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-guardian-customer-facing-operation-guard-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 67, `pkg version must be >= 67.0.0, got ${pkg.version}`);
console.log('  PASS: package version 67.0.0 or later');

assert.ok(pkg.scripts['smoke:guardian-customer-facing-operation-guard'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:guardian-customer-facing-operation-guard'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:guardian-customer-facing-operation-guard exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-guardian-customer-facing-operation-guard-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '67.0.0', 'tool version must be 67.0.0');
console.log('  PASS: tool meta version 67.0.0');

const result = tool.buildCustomerFacingGuard({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

// General guards
assert.ok(Array.isArray(result.operationGuards) && result.operationGuards.length >= 5, 'operationGuards must have 5+ items');
console.log('  PASS: operationGuards[] has 5+ items');

// Insurance sales risk notes
assert.ok(Array.isArray(result.insuranceSalesRiskNotes) && result.insuranceSalesRiskNotes.length >= 8, 'insuranceSalesRiskNotes must have 8+ items');
assert.ok(result.insuranceSalesRiskNotes.some(n => n.includes('告知義務')), 'insuranceSalesRiskNotes must include 告知義務');
assert.ok(result.insuranceSalesRiskNotes.some(n => n.includes('健康') || n.includes('病歴')), 'must include health info block');
assert.ok(result.insuranceSalesRiskNotes.some(n => n.includes('保険料') && n.includes('断定')), 'must include premium non-definitive');
assert.ok(result.insuranceSalesRiskNotes.some(n => n.includes('PDF')), 'must include PDF separation policy');
console.log('  PASS: insuranceSalesRiskNotes includes 告知義務/健康/保険料/PDF');

// Insurance-specific policy flags
assert.strictEqual(result.disclosureDutyRiskGuard,                   true, 'disclosureDutyRiskGuard must be true');
assert.strictEqual(result.healthInformationBodyBlock,                 true, 'healthInformationBodyBlock must be true');
assert.strictEqual(result.premiumEstimateNonDefinitivePolicy,         true, 'premiumEstimateNonDefinitivePolicy must be true');
assert.strictEqual(result.existingContractMixupGuard,                 true, 'existingContractMixupGuard must be true');
assert.strictEqual(result.policyholderInsuredBeneficiaryVerification, true, 'policyholderInsuredBeneficiaryVerification must be true');
assert.strictEqual(result.insurancePdfSeparationPolicy,               true, 'insurancePdfSeparationPolicy must be true');
console.log('  PASS: all insurance policy flags set (disclosureDutyRiskGuard/healthInfoBlock/premiumNonDefinitive/contractMixup/policyholderVerification/pdfSeparation)');

// Insurance-specific guards in operationGuards
const insGuards = result.operationGuards.filter(g => g.category === 'insurance_sales_dx');
assert.ok(insGuards.length >= 5, 'must have 5+ insurance_sales_dx guards');
assert.ok(insGuards.some(g => g.disclosureDutyRiskGuard), 'must have disclosureDutyRiskGuard guard');
assert.ok(insGuards.some(g => g.healthInformationBodyBlock), 'must have healthInformationBodyBlock guard');
assert.ok(insGuards.some(g => g.premiumEstimateNonDefinitivePolicy), 'must have premiumEstimateNonDefinitivePolicy guard');
assert.ok(insGuards.some(g => g.insurancePdfSeparationPolicy), 'must have insurancePdfSeparationPolicy guard');
console.log('  PASS: insurance-specific guards present in operationGuards');

// Failed guard → GUARD_FAILED
const failedResult = tool.buildCustomerFacingGuard({ overrideStatuses: { 'ins-001': 'failed' } });
assert.strictEqual(failedResult.overallStatus, 'GUARD_FAILED', 'critical failure must set GUARD_FAILED');
assert.ok(failedResult.criticalFailedCount > 0, 'criticalFailedCount must be > 0');
console.log('  PASS: failed critical guard → GUARD_FAILED');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real email send')),    'must deny real email send');
assert.ok(denied.some(d => d.includes('real customer data')), 'must deny real customer data');
assert.ok(denied.some(d => d.includes('real contract')),      'must deny real contract');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-guardian-customer-facing-operation-guard-pack smoke PASSED ===');
