'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-provider-health-check-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-provider-health-check-pack smoke ===');

// 1. package version
assert.ok(pkg.version >= '110.3.0', 'package version must be 110.3.0 or later');
console.log('  PASS: package version >= 110.3.0');

// 2. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.3.0');
console.log('  PASS: tool meta version is 110.3.0');

// 3. claude_code: HEALTHY for implementation, context load guarded
const cc = tool.checkHealth({ provider: 'claude_code' });
assert.strictEqual(cc.status, tool.STATUSES.HEALTHY);
assert.ok(cc.recommendedUse.includes('local_tool_creation'));
assert.ok(cc.blockedUse.includes('receive_full_logs'));
assert.strictEqual(cc.dryRun, true);
assert.strictEqual(cc.realProductActionsExecuted, false);
console.log('  PASS: claude_code HEALTHY, context load guarded');

// 4. gemini: HEALTHY for long preprocessing
const gm = tool.checkHealth({ provider: 'gemini' });
assert.strictEqual(gm.status, tool.STATUSES.HEALTHY);
assert.ok(gm.recommendedUse.includes('bulk_preprocessing'));
console.log('  PASS: gemini HEALTHY for long preprocessing');

// 5. gpt: DEGRADED, PM role blocked
const gp = tool.checkHealth({ provider: 'gpt' });
assert.strictEqual(gp.status, tool.STATUSES.DEGRADED);
assert.ok(gp.blockedUse.includes('decide_task_order'));
assert.ok(gp.blockedUse.includes('act_as_pm'));
console.log('  PASS: gpt DEGRADED, PM/court/judge role blocked');

// 6. gpt: execution assistant allowed
assert.ok(gp.recommendedUse.includes('summarize_logs'));
assert.ok(gp.recommendedUse.includes('format_commands'));
console.log('  PASS: gpt execution assistant roles allowed');

// 7. deepseek/kimi: HOLD unless sanitized
const ds = tool.checkHealth({ provider: 'deepseek' });
assert.strictEqual(ds.status, tool.STATUSES.HOLD);
assert.strictEqual(ds.requiresHumanApproval, true);
assert.ok(ds.blockedUse.includes('final_decision'));
console.log('  PASS: deepseek HOLD, requiresHumanApproval true');

const ki = tool.checkHealth({ provider: 'kimi' });
assert.strictEqual(ki.status, tool.STATUSES.HOLD);
console.log('  PASS: kimi HOLD');

// 8. human: HUMAN_GATE_ONLY
const hu = tool.checkHealth({ provider: 'human' });
assert.strictEqual(hu.status, tool.STATUSES.HUMAN_GATE_ONLY);
assert.strictEqual(hu.requiresHumanApproval, true);
console.log('  PASS: human is HUMAN_GATE_ONLY');

// 9. dryRun / realProductActionsExecuted
assert.strictEqual(gm.dryRun, true);
assert.strictEqual(gm.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, realProductActionsExecuted false');

// fixture exists
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-provider-health-check-pack.fixture.json')));
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-provider-health-check-pack');
