'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-cost-saving-internal-build-report-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-cost-saving-internal-build-report-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 54, `pkg version must be >= 54.0.0, got ${pkg.version}`);
console.log('  PASS: package version 54.0.0 or later');

assert.ok(pkg.scripts['smoke:cost-saving-internal-build-report'], 'smoke:cost-saving-internal-build-report must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:cost-saving-internal-build-report'], 'pm-agent:cost-saving-internal-build-report must exist');
console.log('  PASS: pm-agent:cost-saving-internal-build-report exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-cost-saving-internal-build-report-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '54.0.0', 'tool version must be 54.0.0');
console.log('  PASS: tool meta version 54.0.0');

const report = tool.buildCostSavingReport({});

assert.strictEqual(report.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(report.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// internalBuildItems exists
assert.ok(Array.isArray(report.internalBuildItems) && report.internalBuildItems.length > 0, 'internalBuildItems must exist');
console.log('  PASS: internalBuildItems exists');

// avoidedExternalSETasks exists
assert.ok(Array.isArray(report.avoidedExternalSETasks) && report.avoidedExternalSETasks.length > 0, 'avoidedExternalSETasks must exist');
console.log('  PASS: avoidedExternalSETasks exists');

// remainingExternalReviewTasks exists
assert.ok(Array.isArray(report.remainingExternalReviewTasks) && report.remainingExternalReviewTasks.length > 0, 'remainingExternalReviewTasks must exist');
console.log('  PASS: remainingExternalReviewTasks exists');

// estimatedCostSavingNote is non-binding
assert.ok(Array.isArray(report.estimatedCostSavingNote) || typeof report.estimatedCostSavingNote === 'string', 'estimatedCostSavingNote must exist');
assert.strictEqual(report.costSavingNoteIsNonBinding,  true, 'costSavingNoteIsNonBinding must be true');
assert.strictEqual(report.costSavingNoteIsExampleOnly, true, 'costSavingNoteIsExampleOnly must be true');
// note must not contain hard financial promise
const noteText = Array.isArray(report.estimatedCostSavingNote)
  ? report.estimatedCostSavingNote.join(' ')
  : String(report.estimatedCostSavingNote);
assert.ok(!noteText.match(/¥[\d,]+|円[\d,]+|saving.*\$[\d,]+/), 'estimatedCostSavingNote must not contain hard currency amounts');
console.log('  PASS: estimatedCostSavingNote is non-binding / not a hard financial promise');

// no hard financial promise in non-financial benefits
assert.ok(Array.isArray(report.nonFinancialBenefits) && report.nonFinancialBenefits.length > 0, 'nonFinancialBenefits must exist');
console.log('  PASS: nonFinancialBenefits exists');

// dangerousActionsDenied correct
const denied = report.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
console.log('  PASS: dangerousActionsDenied correct');

// reportId and period
assert.ok(report.reportId, 'reportId must exist');
assert.ok(report.period,   'period must exist');
console.log('  PASS: reportId and period exist');

// risksNotOutsourced
assert.ok(Array.isArray(report.risksNotOutsourced) && report.risksNotOutsourced.length > 0, 'risksNotOutsourced must exist');
console.log('  PASS: risksNotOutsourced exists');

console.log('=== dev-agent-cost-saving-internal-build-report-pack smoke PASSED ===');
