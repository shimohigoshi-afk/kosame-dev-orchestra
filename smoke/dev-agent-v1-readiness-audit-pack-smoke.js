'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-v1-readiness-audit-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-v1-readiness-audit-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 106, `pkg version must be >= 106.0.0, got ${pkg.version}`);
console.log('  PASS: package version 106.0.0 or later');

assert.ok(pkg.scripts['smoke:v1-readiness-audit'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:v1-readiness-audit'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:v1-readiness-audit exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-v1-readiness-audit-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '106.0.0');
console.log('  PASS: tool meta version 106.0.0');

const result = tool.buildV1ReadinessAudit({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.humanApprovalRequired, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, humanApprovalRequired true, realProductActionsExecuted false');

assert.strictEqual(result.auditDecision, 'ALL_COMPONENTS_CONFIRMED');
console.log('  PASS: default auditDecision ALL_COMPONENTS_CONFIRMED');

// 11 core OS components
assert.strictEqual(tool.CORE_OS_COMPONENTS.length, 11);
console.log('  PASS: 11 core OS components defined');

// all components confirmed by default
assert.strictEqual(result.auditScore.confirmed, 11);
assert.strictEqual(result.auditScore.scorePercent, 100);
console.log('  PASS: all 11 components confirmed, score 100%');

// check specific components
const compKeys = tool.CORE_OS_COMPONENTS.map(c => c.key);
assert.ok(compKeys.includes('guardian_class'));
assert.ok(compKeys.includes('revenue_launch'));
assert.ok(compKeys.includes('command_center'));
assert.ok(compKeys.includes('operation_memory'));
assert.ok(compKeys.includes('real_product_launch_integration'));
assert.ok(compKeys.includes('pilot_readiness'));
assert.ok(compKeys.includes('backup_handoff_standard'));
console.log('  PASS: all required core components present');

// partial confirmed
const partial = tool.buildV1ReadinessAudit({ componentStatus: { guardian_class: 'NOT_CONFIRMED' } });
assert.strictEqual(partial.auditDecision, 'PARTIAL_CONFIRMED');
assert.ok(partial.notConfirmed.includes('guardian_class'));
console.log('  PASS: missing guardian_class → PARTIAL_CONFIRMED');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

console.log('=== dev-agent-v1-readiness-audit-pack smoke PASSED ===');
