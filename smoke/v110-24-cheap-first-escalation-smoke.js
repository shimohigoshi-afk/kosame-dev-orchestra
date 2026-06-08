#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.24 Cheap First Escalation + Cost Guard + Learning Log
 *
 * Verifies:
 *   - router: ESCALATION_CHAIN, DIFFICULTY_KEYWORDS, classifyDifficulty, buildEscalationPlan, autoRoute
 *   - cost guard: PRICE_TABLE, estimateCost, checkBudget (dryRun)
 *   - learning log: appendLog (dryRun), buildEntry
 *   - npm scripts: cost:config, cost:show, learning:log
 */

const assert = require('node:assert');
const pkg    = require('../package.json');
const router = require('../tools/kosame-difficulty-model-router');
const guard  = require('../tools/kosame-cost-guard');
const log    = require('../tools/kosame-learning-log');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.24 cheap-first-escalation smoke ===');

assert.ok(pkg.version >= '110.24.0');
pass('package version >= 110.24.0');

// ── Escalation Chain ──────────────────────────────────────────────────────────

assert.ok(router.ESCALATION_CHAIN, 'ESCALATION_CHAIN must exist');
for (const tier of ['light', 'medium', 'high']) {
  const chain = router.ESCALATION_CHAIN[tier];
  assert.ok(chain, `ESCALATION_CHAIN.${tier} must exist`);
  assert.ok(typeof chain.humanGate === 'boolean', `${tier} must have humanGate boolean`);
  assert.ok(Array.isArray(chain.steps), `${tier} must have steps array`);
  assert.ok(chain.steps.length >= 1, `${tier} must have at least 1 step`);
  pass(`ESCALATION_CHAIN.${tier} has humanGate and steps`);
}

// high must have humanGate=true
assert.strictEqual(router.ESCALATION_CHAIN.high.humanGate, true, 'high chain must require human gate');
pass('ESCALATION_CHAIN.high.humanGate is true');

// ── Keyword Classifier ────────────────────────────────────────────────────────

assert.ok(router.DIFFICULTY_KEYWORDS, 'DIFFICULTY_KEYWORDS must exist');
assert.ok(Array.isArray(router.DIFFICULTY_KEYWORDS.high), 'DIFFICULTY_KEYWORDS.high must be array');
assert.ok(Array.isArray(router.DIFFICULTY_KEYWORDS.medium), 'DIFFICULTY_KEYWORDS.medium must be array');
assert.ok(Array.isArray(router.DIFFICULTY_KEYWORDS.light), 'DIFFICULTY_KEYWORDS.light must be array');
pass('DIFFICULTY_KEYWORDS has high/medium/light arrays');

const highResult = router.classifyDifficulty('deploy to production server');
assert.strictEqual(highResult.difficulty, 'high', 'deploy/production must classify as high');
assert.ok(highResult.matchedKeywords.length > 0, 'must match keywords');
pass('classifyDifficulty("deploy to production") → high');

const lightResult = router.classifyDifficulty('fix typo in readme docs');
assert.ok(['light', 'medium'].includes(lightResult.difficulty), 'docs/fix must be light or medium');
pass(`classifyDifficulty("fix typo in readme") → ${lightResult.difficulty}`);

// ── buildEscalationPlan ───────────────────────────────────────────────────────

const lightPlan = router.buildEscalationPlan('light', { dryRun: true });
assert.ok(lightPlan.steps, 'light plan must have steps');
assert.strictEqual(lightPlan.humanGate, false, 'light plan must not require human gate');
pass('buildEscalationPlan(light) has steps, humanGate=false');

const highPlan = router.buildEscalationPlan('high', { dryRun: true });
assert.strictEqual(highPlan.humanGate, true, 'high plan must require human gate');
pass('buildEscalationPlan(high) humanGate=true');

// ── autoRoute ─────────────────────────────────────────────────────────────────

const arResult = router.autoRoute('add new feature to the dashboard', { dryRun: true });
assert.ok(arResult.classification, 'autoRoute must return classification');
assert.ok(arResult.plan, 'autoRoute must return plan');
pass('autoRoute returns classification and plan');

// ── Cost Guard ────────────────────────────────────────────────────────────────

assert.strictEqual(guard.TOOL_META.version, '110.24.0');
pass('kosame-cost-guard TOOL_META.version is 110.24.0');

assert.ok(guard.PRICE_TABLE, 'PRICE_TABLE must exist');
assert.ok(guard.PRICE_TABLE['gemini-2.5-flash'], 'PRICE_TABLE must include gemini-2.5-flash');
assert.ok(guard.PRICE_TABLE['claude-sonnet-4-6'], 'PRICE_TABLE must include claude-sonnet-4-6');
pass('PRICE_TABLE has gemini-2.5-flash and claude-sonnet-4-6');

const costEst = guard.estimateCost('gemini-2.5-flash', 2000, 500);
assert.ok(typeof costEst.totalUsd === 'number', 'estimateCost must return totalUsd');
assert.ok(costEst.totalUsd >= 0, 'totalUsd must be non-negative');
pass(`estimateCost(gemini-2.5-flash, 2000, 500) → $${costEst.totalUsd.toFixed(6)}`);

const budgetResult = guard.checkBudget(0.001, { dryRun: true, silent: true });
assert.ok(typeof budgetResult.ok === 'boolean', 'checkBudget must return ok boolean');
assert.ok(typeof budgetResult.projectedUsd === 'number', 'checkBudget must return projectedUsd');
pass('checkBudget(0.001, dryRun=true) returns ok and projectedUsd');

// ── Learning Log ──────────────────────────────────────────────────────────────

assert.strictEqual(log.TOOL_META.version, '110.24.0');
pass('kosame-learning-log TOOL_META.version is 110.24.0');

const entry = log.buildEntry({
  taskInput: 'add feature x',
  taskType: 'implement',
  difficulty: 'medium',
  model: 'gemini-2.5-pro',
  provider: 'google',
  costUsd: 0.0012,
  durationMs: 3200,
  success: true,
  dryRun: true,
});
assert.ok(typeof entry.ts === 'string', 'entry must have ts');
assert.strictEqual(entry.taskType, 'implement', 'entry.taskType must be implement');
assert.strictEqual(entry.difficulty, 'medium', 'entry.difficulty must be medium');
assert.strictEqual(entry.dryRun, true, 'entry.dryRun must be true');
pass('buildEntry returns valid schema');

const appendResult = log.appendLog({ taskInput: 'smoke test', dryRun: true }, { dryRun: true });
assert.strictEqual(appendResult.ok, true, 'appendLog must return ok=true');
assert.strictEqual(appendResult.dryRun, true, 'appendLog must return dryRun=true');
assert.strictEqual(appendResult.realProductActionsExecuted, false, 'dryRun: realProductActionsExecuted=false');
pass('appendLog(dryRun=true) returns ok=true, realProductActionsExecuted=false');

// npm scripts
assert.ok(pkg.scripts['cost:config'], 'npm run cost:config must exist');
pass('npm run cost:config exists');
assert.ok(pkg.scripts['cost:show'], 'npm run cost:show must exist');
pass('npm run cost:show exists');
assert.ok(pkg.scripts['learning:log'], 'npm run learning:log must exist');
pass('npm run learning:log exists');

console.log(`\n✅ v110.24 cheap-first-escalation smoke PASSED (${passed} checks)`);
