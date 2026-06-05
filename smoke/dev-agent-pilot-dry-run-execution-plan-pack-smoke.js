'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-pilot-dry-run-execution-plan-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-pilot-dry-run-execution-plan-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 98, `pkg version must be >= 98.0.0, got ${pkg.version}`);
console.log('  PASS: package version 98.0.0 or later');

assert.ok(pkg.scripts['smoke:pilot-dry-run-execution-plan'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:pilot-dry-run-execution-plan'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:pilot-dry-run-execution-plan exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-pilot-dry-run-execution-plan-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '98.0.0');
console.log('  PASS: tool meta version 98.0.0');

const result = tool.buildPilotDryRunExecutionPlan({});
assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted false');

assert.strictEqual(result.decision, tool.DRY_RUN_DECISIONS.DRY_RUN_READY);
console.log('  PASS: default decision is DRY_RUN_READY');

// guardian not ready → HOLD
const noGuardian = tool.buildPilotDryRunExecutionPlan({ guardianReady: false });
assert.strictEqual(noGuardian.decision, tool.DRY_RUN_DECISIONS.HOLD);
console.log('  PASS: guardianReady=false → HOLD');

// blockers → BLOCKED
const withBlockers = tool.buildPilotDryRunExecutionPlan({ blockers: ['x'] });
assert.strictEqual(withBlockers.decision, tool.DRY_RUN_DECISIONS.BLOCKED);
console.log('  PASS: blockers → BLOCKED');

// anesty_board eligible
assert.ok(result.dryRunPlans.anesty_board, 'anesty_board plan must exist');
assert.strictEqual(result.dryRunPlans.anesty_board.eligible, true);
console.log('  PASS: anesty_board eligible for dry-run');

// email_reply_bot eligible (draft-only)
assert.ok(result.dryRunPlans.email_reply_bot, 'email_reply_bot plan must exist');
assert.strictEqual(result.dryRunPlans.email_reply_bot.eligible, true);
console.log('  PASS: email_reply_bot eligible (draft-only)');

// safety checklist
assert.ok(Array.isArray(result.safetyChecklist) && result.safetyChecklist.length > 0);
assert.ok(result.safetyChecklist.every(c => c.enforced === true), 'all safety checks must be enforced');
console.log('  PASS: safetyChecklist all enforced');

// dangerousActionsDenied
assert.ok(result.dangerousActionsDenied.some(d => d.includes('real send')));
assert.ok(result.dangerousActionsDenied.some(d => d.includes('real billing')));
assert.ok(result.dangerousActionsDenied.some(d => d.includes('real deploy')));
console.log('  PASS: dangerousActionsDenied includes real send/billing/deploy');

console.log('=== dev-agent-pilot-dry-run-execution-plan-pack smoke PASSED ===');
