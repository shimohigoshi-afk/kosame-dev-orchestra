'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-executive-dashboard-snapshot-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-executive-dashboard-snapshot-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 76, `pkg version must be >= 76.0.0, got ${pkg.version}`);
console.log('  PASS: package version 76.0.0 or later');

assert.ok(pkg.scripts['smoke:executive-dashboard-snapshot'],   'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:executive-dashboard-snapshot'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:executive-dashboard-snapshot exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-executive-dashboard-snapshot-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '76.0.0');
console.log('  PASS: tool meta version 76.0.0');

const result = tool.buildExecutiveDashboardSnapshot({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.latestStableVersion, 'latestStableVersion must exist');
console.log('  PASS: latestStableVersion exists');

// completedMilestones includes v44/v47/v50/v55/v60/v65/v70/v75
const milestoneVersions = tool.COMPLETED_MILESTONES.map(m => m.version);
const requiredVersions  = ['v44.0.0', 'v47.0.0', 'v50.0.0', 'v55.0.0', 'v60.0.0', 'v65.0.0', 'v70.0.0', 'v75.0.0'];
for (const v of requiredVersions) {
  assert.ok(milestoneVersions.includes(v), `COMPLETED_MILESTONES must include ${v}`);
}
console.log('  PASS: completedMilestones includes v44/v47/v50/v55/v60/v65/v70/v75');

assert.ok(Array.isArray(result.completedMilestones) && result.completedMilestones.length >= 8, 'completedMilestones must have 8+ items');
console.log('  PASS: completedMilestones has 8+ items');

assert.ok(result.productSummary   && result.productSummary.total   >= 5, 'productSummary must exist');
console.log('  PASS: productSummary exists');

assert.ok(result.guardianSummary  && result.guardianSummary.overallStatus, 'guardianSummary must exist');
console.log('  PASS: guardianSummary exists');

assert.ok(result.revenueSummary   && result.revenueSummary.overallStatus, 'revenueSummary must exist');
console.log('  PASS: revenueSummary exists');

assert.ok(result.humanYesSummary  && result.humanYesSummary.pendingCount >= 0, 'humanYesSummary must exist');
console.log('  PASS: humanYesSummary exists');

assert.ok(result.riskSummary && typeof result.riskSummary.critical === 'number', 'riskSummary must exist');
console.log('  PASS: riskSummary exists');

assert.ok(result.nextRecommendedAction, 'nextRecommendedAction must exist');
console.log('  PASS: nextRecommendedAction exists');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('secret read')), 'must deny secret read');
assert.ok(denied.some(d => d.includes('deploy')),      'must deny deploy');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-executive-dashboard-snapshot-pack smoke PASSED ===');
