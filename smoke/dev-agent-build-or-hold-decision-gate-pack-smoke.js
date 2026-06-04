'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-build-or-hold-decision-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-build-or-hold-decision-gate-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 65, `pkg version must be >= 65.0.0, got ${pkg.version}`);
console.log('  PASS: package version 65.0.0 or later');

assert.ok(pkg.scripts['smoke:build-or-hold-decision-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:build-or-hold-decision-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:build-or-hold-decision-gate exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-build-or-hold-decision-gate-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '65.0.0', 'tool version must be 65.0.0');
console.log('  PASS: tool meta version 65.0.0');

const D = tool.DECISIONS;

// default pack (no data)
const pack = tool.buildDecisionGate({ productIdea: 'AI議事録自動化ツール', targetUser: '中小企業の営業担当者' });

assert.strictEqual(pack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(pack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// includes v61-v64
assert.ok(pack.ideaDiscovery         && pack.ideaDiscovery.ideaDiscoveryId,          'ideaDiscovery must exist');
assert.ok(pack.landingPageRequirement && pack.landingPageRequirement.landingPageRequirementId, 'landingPageRequirement must exist');
assert.ok(pack.demandValidation       && pack.demandValidation.demandValidationId,     'demandValidation must exist');
assert.ok(pack.mvpPmfMetrics          && pack.mvpPmfMetrics.mvpPmfMetricsId,          'mvpPmfMetrics must exist');
console.log('  PASS: includes v61 ideaDiscovery / v62 landingPageRequirement / v63 demandValidation / v64 mvpPmfMetrics');

// decisionOptions
const opts = pack.decisionOptions;
assert.ok(opts.includes('BUILD'),         'decisionOptions must include BUILD');
assert.ok(opts.includes('HOLD'),          'decisionOptions must include HOLD');
assert.ok(opts.includes('PIVOT'),         'decisionOptions must include PIVOT');
assert.ok(opts.includes('VALIDATE_MORE'), 'decisionOptions must include VALIDATE_MORE');
assert.ok(opts.includes('SCALE'),         'decisionOptions must include SCALE');
console.log('  PASS: decisionOptions include BUILD/HOLD/PIVOT/VALIDATE_MORE/SCALE');

// CPA 100-300 → BUILD
const build200 = tool.determineDecision({ targetUser: 'testuser', actualCpa: 200 });
assert.strictEqual(build200.decision, D.BUILD, `CPA 200 should route to BUILD, got ${build200.decision}`);
console.log('  PASS: CPA 100-300 routes to BUILD candidate');

// CPA 300-1000 → VALIDATE_MORE
const validate500 = tool.determineDecision({ targetUser: 'testuser', actualCpa: 500 });
assert.strictEqual(validate500.decision, D.VALIDATE_MORE, `CPA 500 should route to VALIDATE_MORE, got ${validate500.decision}`);
console.log('  PASS: CPA 300-1000 routes to VALIDATE_MORE');

// CPA 1000+ → PIVOT
const pivot1500 = tool.determineDecision({ targetUser: 'testuser', actualCpa: 1500 });
assert.strictEqual(pivot1500.decision, D.PIVOT, `CPA 1500 should route to PIVOT, got ${pivot1500.decision}`);
console.log('  PASS: CPA 1000+ routes to PIVOT candidate');

// insufficient data → VALIDATE_MORE
const noData = tool.determineDecision({ targetUser: 'testuser' });
assert.strictEqual(noData.decision, D.VALIDATE_MORE, `No data should route to VALIDATE_MORE, got ${noData.decision}`);
console.log('  PASS: insufficient data routes to VALIDATE_MORE');

// high retention + LTV>CAC → SCALE
const scale = tool.determineDecision({ targetUser: 'testuser', retention30d: 0.20, ltv: 3000, cac: 500 });
assert.strictEqual(scale.decision, D.SCALE, `High retention + LTV>CAC should route to SCALE, got ${scale.decision}`);
console.log('  PASS: high retention + LTV>CAC routes to SCALE candidate');

// target user undefined → HOLD
const noUser = tool.determineDecision({});
assert.strictEqual(noUser.decision, D.HOLD, `No targetUser should route to HOLD, got ${noUser.decision}`);
console.log('  PASS: target user undefined → HOLD');

// waitlist 0 → HOLD
const waitlistZero = tool.determineDecision({ targetUser: 'testuser', waitlistCount: 0 });
assert.strictEqual(waitlistZero.decision, D.HOLD, `waitlistCount=0 should route to HOLD, got ${waitlistZero.decision}`);
console.log('  PASS: waitlist 0 → HOLD');

// completePackReady
assert.strictEqual(pack.completePackReady, true, 'completePackReady must be true when no blockers');
const blocked = tool.buildDecisionGate({ productIdea: 'test', blockers: ['data boundary not defined'] });
assert.strictEqual(blocked.completePackReady, false, 'completePackReady must be false when blockers exist');
console.log('  PASS: completePackReady true/false based on blockers');

// humanApprovalPacket
assert.ok(pack.humanApprovalPacket && pack.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

// dangerousActionsDenied
const denied = pack.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real ad launch')),   'must deny real ad launch');
assert.ok(denied.some(d => d.includes('real LP publish')),  'must deny real LP publish');
assert.ok(denied.some(d => d.includes('deploy')),           'must deny deploy');
assert.ok(denied.some(d => d.includes('secret read')),      'must deny secret read');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-build-or-hold-decision-gate-pack smoke PASSED ===');
