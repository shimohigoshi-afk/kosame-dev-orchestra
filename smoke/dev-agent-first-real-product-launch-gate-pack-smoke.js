'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-first-real-product-launch-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-first-real-product-launch-gate-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 95, `pkg version must be >= 95.0.0, got ${pkg.version}`);
console.log('  PASS: package version 95.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-product-launch-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-product-launch-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:first-real-product-launch-gate exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-first-real-product-launch-gate-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '95.0.0');
console.log('  PASS: tool meta version 95.0.0');

const D = tool.LAUNCH_DECISIONS;

// default run
const result = tool.buildFirstRealProductLaunchGate({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

// candidateProducts includes all 4
assert.ok(result.candidateProducts.sales_dx,        'must include sales_dx');
assert.ok(result.candidateProducts.email_reply_bot, 'must include email_reply_bot');
assert.ok(result.candidateProducts.backoffice_agent,'must include backoffice_agent');
assert.ok(result.candidateProducts.anesty_board,    'must include anesty_board');
console.log('  PASS: candidateProducts includes sales_dx/email_reply_bot/backoffice_agent/anesty_board');

// launchDecision options exist
assert.ok(Array.isArray(result.decisionOptions) && result.decisionOptions.length >= 5, 'decisionOptions must exist');
assert.ok(result.decisionOptions.includes(D.PILOT_SALES_DX),        'must include PILOT_SALES_DX');
assert.ok(result.decisionOptions.includes(D.PILOT_EMAIL_REPLY_BOT), 'must include PILOT_EMAIL_REPLY_BOT');
assert.ok(result.decisionOptions.includes(D.PILOT_ANESTY_BOARD),    'must include PILOT_ANESTY_BOARD');
assert.ok(result.decisionOptions.includes(D.VALIDATE_MORE),         'must include VALIDATE_MORE');
assert.ok(result.decisionOptions.includes(D.HOLD),                  'must include HOLD');
console.log('  PASS: launchDecision options exist (PILOT_*/VALIDATE_MORE/HOLD)');

// Guardian not ready → HOLD
const noGuardian = tool.buildFirstRealProductLaunchGate({ guardianReady: false });
assert.strictEqual(noGuardian.launchDecision, D.HOLD, `guardianReady=false should be HOLD, got ${noGuardian.launchDecision}`);
console.log('  PASS: Guardian未確認 → HOLD');

// Revenue not ready → VALIDATE_MORE
const noRevenue = tool.buildFirstRealProductLaunchGate({ revenueReady: false });
assert.ok([D.VALIDATE_MORE, D.HOLD].includes(noRevenue.launchDecision), `revenueReady=false should be VALIDATE_MORE or HOLD, got ${noRevenue.launchDecision}`);
console.log('  PASS: Revenue未確認 → VALIDATE_MORE or HOLD');

// all ready → pilot candidate (not HOLD)
const allReady = tool.buildFirstRealProductLaunchGate({ guardianReady: true, revenueReady: true });
assert.ok(allReady.launchDecision !== D.HOLD, `all ready should not be HOLD, got ${allReady.launchDecision}`);
console.log('  PASS: all ready + no blockers → pilot candidate (not HOLD)');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

// guardianReadiness
assert.ok(result.guardianReadiness && result.guardianReadiness.status, 'guardianReadiness must exist');
console.log('  PASS: guardianReadiness exists');

assert.strictEqual(result.realProductActionsExecuted, false, 'realProductActionsExecuted must be false');
console.log('  PASS: realProductActionsExecuted false');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('customer data')),    'must deny customer data');
assert.ok(denied.some(d => d.includes('real send') || d.includes('real contract')), 'must deny real send/contract');
assert.ok(denied.some(d => d.includes('deploy')),           'must deny deploy');
assert.ok(denied.some(d => d.includes('secret read') || d.includes('api key')), 'must deny secret/API key');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-first-real-product-launch-gate-pack smoke PASSED ===');
