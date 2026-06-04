'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-security-review-checklist-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-security-review-checklist-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 52, `pkg version must be >= 52.0.0, got ${pkg.version}`);
console.log('  PASS: package version 52.0.0 or later');

assert.ok(pkg.scripts['smoke:security-review-checklist'], 'smoke:security-review-checklist must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:security-review-checklist'], 'pm-agent:security-review-checklist must exist');
console.log('  PASS: pm-agent:security-review-checklist exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-security-review-checklist-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '52.0.0', 'tool version must be 52.0.0');
console.log('  PASS: tool meta version 52.0.0');

const result = tool.buildSecurityChecklist({});

assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// categories include required ones
const cats = result.checkCategories;
const catStr = cats.join(' ').toLowerCase();
assert.ok(catStr.includes('secret') || catStr.includes('.env'),  'categories must include Secret/.env');
assert.ok(catStr.includes('iam'),                                 'categories must include IAM');
assert.ok(catStr.includes('cloud run'),                           'categories must include Cloud Run');
assert.ok(catStr.includes('customer data') || catStr.includes('insurance'), 'categories must include customer/insurance data');
assert.ok(catStr.includes('log'),                                 'categories must include logs');
assert.ok(catStr.includes('database') || catStr.includes('storage'), 'categories must include database/storage');
assert.ok(catStr.includes('auth'),                                'categories must include auth');
assert.ok(catStr.includes('deploy') || catStr.includes('rollback'), 'categories must include deploy/rollback');
assert.ok(catStr.includes('backup') || catStr.includes('restore'), 'categories must include backup/restore');
assert.ok(catStr.includes('compliance') || catStr.includes('legal'), 'categories must include compliance/legal');
console.log('  PASS: checklist categories include Secret/IAM/Cloud Run/customer data/logs/database/auth/deploy/backup/compliance');

// each check item has required fields
const reqFields = ['checkId', 'category', 'title', 'severity', 'status', 'evidenceRequired', 'reviewer', 'blockerIfFailed'];
for (const item of result.checklist) {
  for (const f of reqFields) {
    assert.ok(item[f] !== undefined, `check item ${item.checkId} must have field: ${f}`);
  }
}
console.log('  PASS: each check item has severity/status/evidenceRequired/reviewer/blockerIfFailed');

// failed blocker item makes overallStatus not ready
const resultWithFailed = tool.buildSecurityChecklist({
  overrideStatuses: { 'sec-001': 'failed' }
});
assert.strictEqual(resultWithFailed.overallStatus, 'NOT_READY', 'overallStatus must be NOT_READY when blocker item failed');
console.log('  PASS: failed blocker item makes overallStatus NOT_READY');

// all pending blockers → PENDING_REVIEW
assert.strictEqual(result.overallStatus, 'PENDING_REVIEW', 'overallStatus must be PENDING_REVIEW when blocker items are pending');
console.log('  PASS: all pending blockers → overallStatus PENDING_REVIEW');

// dangerousActionsDenied correct
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-security-review-checklist-pack smoke PASSED ===');
