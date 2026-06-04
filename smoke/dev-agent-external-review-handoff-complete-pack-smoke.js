'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-external-review-handoff-complete-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-external-review-handoff-complete-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 55, `pkg version must be >= 55.0.0, got ${pkg.version}`);
console.log('  PASS: package version 55.0.0 or later');

assert.ok(pkg.scripts['smoke:external-review-handoff-complete'], 'smoke:external-review-handoff-complete must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:external-review-handoff-complete'], 'pm-agent:external-review-handoff-complete must exist');
console.log('  PASS: pm-agent:external-review-handoff-complete exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-external-review-handoff-complete-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '55.0.0', 'tool version must be 55.0.0');
console.log('  PASS: tool meta version 55.0.0');

const pack = tool.buildHandoffComplete({});

assert.strictEqual(pack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(pack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// v51 externalSEReviewPacket
assert.ok(pack.externalSEReviewPacket && pack.externalSEReviewPacket.reviewPacketId, 'externalSEReviewPacket must exist');
console.log('  PASS: includes v51 externalSEReviewPacket');

// v52 securityReviewChecklist
assert.ok(pack.securityReviewChecklist && Array.isArray(pack.securityReviewChecklist.checklist), 'securityReviewChecklist must exist');
console.log('  PASS: includes v52 securityReviewChecklist');

// v53 productionGoNoGoReview
assert.ok(pack.productionGoNoGoReview && pack.productionGoNoGoReview.reviewId, 'productionGoNoGoReview must exist');
assert.ok(pack.productionGoNoGoReview.decisionOptions, 'productionGoNoGoReview must have decisionOptions');
console.log('  PASS: includes v53 productionGoNoGoReview');

// v54 costSavingInternalBuildReport
assert.ok(pack.costSavingInternalBuildReport && pack.costSavingInternalBuildReport.reportId, 'costSavingInternalBuildReport must exist');
console.log('  PASS: includes v54 costSavingInternalBuildReport');

// handoffSummary
assert.ok(Array.isArray(pack.handoffSummary) && pack.handoffSummary.length > 0, 'handoffSummary must exist');
console.log('  PASS: handoffSummary exists');

// externalReviewerInstructions
const instr = pack.externalReviewerInstructions;
assert.ok(instr && instr.role,        'externalReviewerInstructions.role must exist');
assert.ok(instr.scopeIn,              'externalReviewerInstructions.scopeIn must exist');
assert.ok(instr.scopeOut,             'externalReviewerInstructions.scopeOut must exist');
assert.ok(instr.deliverables,         'externalReviewerInstructions.deliverables must exist');
assert.ok(instr.escalationPath,       'externalReviewerInstructions.escalationPath must exist');
console.log('  PASS: externalReviewerInstructions exists (role/scopeIn/scopeOut/deliverables/escalationPath)');

// humanApprovalPacket
const hap = pack.humanApprovalPacket;
assert.ok(hap && hap.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
assert.ok(Array.isArray(hap.deniedActionsForAI) && hap.deniedActionsForAI.length > 0, 'humanApprovalPacket.deniedActionsForAI must exist');
console.log('  PASS: humanApprovalPacket exists');

// nextAction
assert.ok(pack.nextAction, 'nextAction must exist');
console.log('  PASS: nextAction exists');

// dangerousActionsDenied correct
const denied = pack.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
assert.ok(denied.some(d => d.includes('git push')),    'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// completePackReady true when no blockers
assert.strictEqual(pack.completePackReady, true, 'completePackReady must be true when no blockers');
console.log('  PASS: completePackReady true when no blockers');

// blocked scenario
const blocked = tool.buildHandoffComplete({ blockers: ['external SE review not completed'] });
assert.strictEqual(blocked.completePackReady, false, 'completePackReady must be false when blockers exist');
assert.ok(blocked.blockers.length > 0, 'blockers must be populated');
console.log('  PASS: completePackReady false when blockers present');

// purposeStatements exported
assert.ok(Array.isArray(tool.PURPOSE_STATEMENTS) && tool.PURPOSE_STATEMENTS.length >= 5, 'PURPOSE_STATEMENTS must be exported');
assert.ok(tool.PURPOSE_STATEMENTS.some(p => p.includes('80') || p.includes('90') || p.includes('10%')), 'PURPOSE_STATEMENTS must mention internal build ratio');
console.log('  PASS: PURPOSE_STATEMENTS exported with correct content');

// orchestraVersion
assert.ok(pack.orchestraVersion === '55.0.0', 'orchestraVersion must be 55.0.0');
console.log('  PASS: orchestraVersion 55.0.0');

console.log('=== dev-agent-external-review-handoff-complete-pack smoke PASSED ===');
