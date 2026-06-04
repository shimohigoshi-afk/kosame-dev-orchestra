'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-mvp-pmf-metrics-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-mvp-pmf-metrics-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 64, `pkg version must be >= 64.0.0, got ${pkg.version}`);
console.log('  PASS: package version 64.0.0 or later');

assert.ok(pkg.scripts['smoke:mvp-pmf-metrics'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:mvp-pmf-metrics'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:mvp-pmf-metrics exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-mvp-pmf-metrics-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '64.0.0', 'tool version must be 64.0.0');
console.log('  PASS: tool meta version 64.0.0');

const result = tool.buildMvpPmfMetrics({ productIdea: 'AI議事録自動化ツール', cvr: 0.015, retention30d: 0.20, ltv: 3000, cac: 500 });

assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// requiredAnalytics exists
assert.ok(Array.isArray(result.requiredAnalytics) && result.requiredAnalytics.length > 0, 'requiredAnalytics must exist');
console.log('  PASS: requiredAnalytics exists');

// CVR threshold includes 1%
const thresholds = tool.THRESHOLDS;
assert.ok(thresholds.cvr.signal.value === 0.01, 'CVR threshold must include 1% signal');
assert.ok(thresholds.cvr.strong.value === 0.02, 'CVR threshold must include 2% strong signal');
assert.strictEqual(result.cvrStatus, 'signal', `CVR 1.5% should be 'signal', got ${result.cvrStatus}`);
console.log('  PASS: CVR threshold includes 1% / CVR 1.5% → signal');

// retention30d threshold includes 15%
assert.ok(thresholds.retention30d.pmf.value === 0.15, 'retention30d PMF threshold must be 15%');
assert.strictEqual(result.retentionStatus, 'pmf_candidate', `retention 20% should be pmf_candidate, got ${result.retentionStatus}`);
console.log('  PASS: retention30d threshold includes 15% / 20% → pmf_candidate');

// LTV/CAC status exists
assert.ok(result.ltvCacStatus && result.ltvCacStatus.status, 'ltvCacStatus must exist');
assert.ok(['healthy', 'marginal', 'unsustainable', 'organic', 'unknown'].includes(result.ltvCacStatus.status), 'ltvCacStatus must have valid status');
console.log('  PASS: LTV/CAC status exists');

// LTV=3000, CAC=500 → ratio=6 → healthy
assert.strictEqual(result.ltvCacStatus.status, 'healthy', `LTV/CAC=6 should be healthy, got ${result.ltvCacStatus.status}`);
console.log('  PASS: LTV/CAC=6 → healthy');

// PMF signals exist
assert.ok(Array.isArray(result.pmfSignals) && result.pmfSignals.length > 0, 'pmfSignals must exist');
console.log('  PASS: PMF signals exist');

// pivotSignals exist
assert.ok(Array.isArray(result.pivotSignals) && result.pivotSignals.length > 0, 'pivotSignals must exist');
console.log('  PASS: pivotSignals exist');

// AI/infrastructure cost consideration
assert.ok(Array.isArray(result.aiInfrastructureCostNote) && result.aiInfrastructureCostNote.length > 0, 'aiInfrastructureCostNote must exist');
assert.ok(result.aiInfrastructureCostNote.some(n => n.includes('AI') || n.includes('インフラ')), 'aiInfrastructureCostNote must mention AI/infra');
console.log('  PASS: AI/infrastructure cost consideration exists');

// dangerousActionsDenied correct
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real ad launch')),    'must deny real ad launch');
assert.ok(denied.some(d => d.includes('real payment')),      'must deny real payment');
assert.ok(denied.some(d => d.includes('deploy')),            'must deny deploy');
assert.ok(denied.some(d => d.includes('secret read')),       'must deny secret read');
console.log('  PASS: dangerousActionsDenied correct');

// classifyLtvCac export
assert.ok(typeof tool.classifyLtvCac === 'function', 'classifyLtvCac must be exported');
assert.strictEqual(tool.classifyLtvCac(3000, 500).status, 'healthy',      'LTV/CAC=6 should be healthy');
assert.strictEqual(tool.classifyLtvCac(500, 500).status,  'marginal',     'LTV/CAC=1 should be marginal');
assert.strictEqual(tool.classifyLtvCac(100, 500).status,  'unsustainable','LTV/CAC=0.2 should be unsustainable');
assert.strictEqual(tool.classifyLtvCac(null, null).status, 'unknown',     'null should be unknown');
console.log('  PASS: classifyLtvCac exported and correct');

// updateLoopPlan
assert.ok(Array.isArray(result.updateLoopPlan) && result.updateLoopPlan.length > 0, 'updateLoopPlan must exist');
console.log('  PASS: updateLoopPlan exists');

console.log('=== dev-agent-mvp-pmf-metrics-pack smoke PASSED ===');
