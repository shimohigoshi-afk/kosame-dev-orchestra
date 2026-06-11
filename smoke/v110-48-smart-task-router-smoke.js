#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.48 Smart Task Router
 *
 * Verifies:
 *   - ROUTING_TABLE: structure (light/medium/high/quality × variants)
 *   - classifyTask: isSalesDx, isConfidential, isMultiRepo, hasProdImpact
 *   - gptArbiterNeeded: trigger conditions
 *   - assignWorkerByRules: routing policy enforcement
 *   - assignWorker: dryRun (no API calls), all 3 modes
 *   - salesDx: DeepSeek blocked
 *   - kosame-auto-dev: executeWithWorker export, routeMode param
 *   - Dashboard display (smoke, no crash)
 */

const assert = require('node:assert');
const pkg    = require('../package.json');

const router  = require('../tools/kosame-smart-task-router');
const autoDev = require('../tools/kosame-auto-dev');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.48 smart-task-router smoke ===');

// ── Package version ───────────────────────────────────────────────────────────

assert.ok(pkg.version >= '110.48.0', `version must be >= 110.48.0 (got ${pkg.version})`);
pass('package version >= 110.48.0');

// ── TOOL_META ─────────────────────────────────────────────────────────────────

assert.strictEqual(router.TOOL_META.slug, 'kosame-smart-task-router');
assert.ok(router.TOOL_META.version.startsWith('110.48'));
pass('TOOL_META slug and version');

// ── ROUTING_TABLE structure ───────────────────────────────────────────────────

for (const tier of ['light', 'medium', 'high', 'quality']) {
  assert.ok(router.ROUTING_TABLE[tier], `ROUTING_TABLE.${tier} must exist`);
  assert.ok(router.ROUTING_TABLE[tier].default, `ROUTING_TABLE.${tier}.default must exist`);
  const d = router.ROUTING_TABLE[tier].default;
  assert.ok(d.primary,  `${tier}.default.primary must exist`);
  assert.ok(d.fallback, `${tier}.default.fallback must exist`);
  assert.ok(d.reason,   `${tier}.default.reason must exist`);
  pass(`ROUTING_TABLE.${tier}.default has primary/fallback/reason`);
}

// salesDx variant exists for light/medium/high
for (const tier of ['light', 'medium', 'high']) {
  assert.ok(router.ROUTING_TABLE[tier].salesDx, `ROUTING_TABLE.${tier}.salesDx must exist`);
  const sd = router.ROUTING_TABLE[tier].salesDx;
  assert.notStrictEqual(sd.primary, 'cheap_code_worker', `${tier}.salesDx must not use DeepSeek`);
  pass(`ROUTING_TABLE.${tier}.salesDx is not DeepSeek`);
}

// ── classifyTask ──────────────────────────────────────────────────────────────

const baseTask = { id: 'T001', title: 'UIコンポーネント実装', difficulty: 'light' };

const classified = router.classifyTask(baseTask, {});
assert.ok(typeof classified.isSalesDx      === 'boolean', 'isSalesDx must be boolean');
assert.ok(typeof classified.isConfidential === 'boolean', 'isConfidential must be boolean');
assert.ok(typeof classified.isMultiRepo    === 'boolean', 'isMultiRepo must be boolean');
assert.ok(typeof classified.hasProdImpact  === 'boolean', 'hasProdImpact must be boolean');
assert.ok(typeof classified.isAmbiguous    === 'boolean', 'isAmbiguous must be boolean');
assert.strictEqual(classified.isSalesDx, false, 'UI component is not salesDx');
pass('classifyTask adds boolean attributes');

// salesDx detection via project
const salesTask = router.classifyTask(baseTask, { project: 'transcriber' });
assert.strictEqual(salesTask.isSalesDx, true, 'transcriber project must flag salesDx');
pass('classifyTask: transcriber project → isSalesDx=true');

// salesDx detection via keyword
const salesKw = router.classifyTask({ ...baseTask, title: '営業リスト生成機能' }, {});
assert.strictEqual(salesKw.isSalesDx, true, '営業 keyword → isSalesDx=true');
pass('classifyTask: 営業 keyword → isSalesDx=true');

// confidential detection
const confTask = router.classifyTask({ ...baseTask, title: 'JWT token validation' }, {});
assert.strictEqual(confTask.isConfidential, true, 'JWT → isConfidential=true');
pass('classifyTask: JWT keyword → isConfidential=true');

// multi-repo detection
const multiTask = router.classifyTask({ ...baseTask, title: 'cross-repo migration script' }, {});
assert.strictEqual(multiTask.isMultiRepo, true, 'cross-repo → isMultiRepo=true');
pass('classifyTask: cross-repo → isMultiRepo=true');

// prod impact
const prodTask = router.classifyTask({ ...baseTask, title: 'deploy to production' }, {});
assert.strictEqual(prodTask.hasProdImpact, true, 'deploy to production → hasProdImpact=true');
pass('classifyTask: deploy to production → hasProdImpact=true');

// ── gptArbiterNeeded ──────────────────────────────────────────────────────────

const normalTask = router.classifyTask({ id: 'T1', title: 'fix button color', difficulty: 'light' }, {});
const normalArbiter = router.gptArbiterNeeded(normalTask);
assert.strictEqual(normalArbiter.needed, false, 'simple task → gptArbiterNeeded=false');
assert.deepStrictEqual(normalArbiter.reasons, []);
pass('gptArbiterNeeded: simple task → not needed');

const highRiskTask = router.classifyTask({
  id: 'T2', title: 'deploy to production', difficulty: 'high', description: 'cross-repo migration',
}, { project: 'transcriber' });
const highArbiter = router.gptArbiterNeeded(highRiskTask);
assert.strictEqual(highArbiter.needed, true, 'high-risk task → gptArbiterNeeded=true');
assert.ok(highArbiter.reasons.length >= 3, `must have at least 3 reasons (got ${highArbiter.reasons.length})`);
pass(`gptArbiterNeeded: high-risk task → needed, reasons=${highArbiter.reasons.length}`);

// failure count threshold
const failTask = router.classifyTask({ id: 'T3', title: 'fix form validation', difficulty: 'light' }, { failureCount: 2 });
const failArbiter = router.gptArbiterNeeded(failTask);
assert.strictEqual(failArbiter.needed, true, '2 failures → gptArbiterNeeded=true');
assert.ok(failArbiter.reasons.some(r => r.includes('連続失敗')));
pass('gptArbiterNeeded: 2+ failures → needed');

// ── assignWorkerByRules ───────────────────────────────────────────────────────

// light/default → cheap_code_worker
const lightTask = router.classifyTask({ id: 'T4', title: 'add helper function', difficulty: 'light' }, {});
const lightRules = router.assignWorkerByRules(lightTask);
assert.strictEqual(lightRules.primary, 'cheap_code_worker', 'light/default → cheap_code_worker');
assert.strictEqual(lightRules.deepseekBlocked, false);
pass('assignWorkerByRules: light/default → cheap_code_worker');

// medium/default → general_worker
const medTask = router.classifyTask({ id: 'T5', title: 'implement search feature', difficulty: 'medium' }, {});
const medRules = router.assignWorkerByRules(medTask);
assert.strictEqual(medRules.primary, 'general_worker', 'medium/default → general_worker');
pass('assignWorkerByRules: medium/default → general_worker');

// high/default → gpt_upper
const highTask = router.classifyTask({ id: 'T6', title: 'system architecture design', difficulty: 'high' }, {});
const highRules = router.assignWorkerByRules(highTask);
assert.strictEqual(highRules.primary, 'gpt_upper', 'high/default → gpt_upper');
pass('assignWorkerByRules: high/default → gpt_upper');

// salesDx → no cheap_code_worker
const sdxTask = router.classifyTask({ id: 'T7', title: '顧客リスト整理', difficulty: 'light' }, {});
const sdxRules = router.assignWorkerByRules(sdxTask);
assert.notStrictEqual(sdxRules.primary, 'cheap_code_worker', 'salesDx must not use cheap_code_worker');
assert.ok(sdxRules.deepseekBlocked || sdxRules.primary !== 'cheap_code_worker');
pass('assignWorkerByRules: salesDx light → not cheap_code_worker');

// confidential → no cheap_code_worker
const confRules = router.assignWorkerByRules(confTask);
assert.notStrictEqual(confRules.primary, 'cheap_code_worker', 'confidential must not use cheap_code_worker');
pass('assignWorkerByRules: confidential → not cheap_code_worker');

// quality type → claude_sonnet
const qualTask = { id: 'T8', title: 'final quality review', difficulty: 'light', isQualityCheck: true, isSalesDx: false, isConfidential: false };
const qualRules = router.assignWorkerByRules(qualTask);
assert.strictEqual(qualRules.primary, 'claude_sonnet', 'quality task → claude_sonnet');
pass('assignWorkerByRules: quality task → claude_sonnet');

// ── assignWorker (dryRun, all modes) ─────────────────────────────────────────

async function runAssignWorkerTests() {
  // simple mode — no API
  const simpleResult = await router.assignWorker(lightTask, { mode: 'simple', dryRun: true });
  assert.ok(simpleResult.primary, 'simple mode must return primary');
  assert.strictEqual(simpleResult.method, 'rule_simple');
  assert.strictEqual(simpleResult.needsGptArbiter, false);
  pass('assignWorker: simple mode, dryRun');

  // smart mode, low-risk task → rule (no arbiter)
  const smartLow = await router.assignWorker(lightTask, { mode: 'smart', dryRun: true });
  assert.ok(smartLow.primary, 'smart mode must return primary');
  assert.strictEqual(smartLow.needsGptArbiter, false, 'simple light task → no arbiter');
  pass('assignWorker: smart mode, simple task → no arbiter');

  // smart mode, high-risk task → arbiter triggered (dryRun skips API)
  const smartHigh = await router.assignWorker(highRiskTask, { mode: 'smart', dryRun: true });
  assert.ok(smartHigh.primary, 'smart mode high-risk must return primary');
  assert.strictEqual(smartHigh.needsGptArbiter, true, 'high-risk → arbiter needed');
  assert.ok(smartHigh.arbiterReasons.length > 0, 'must have arbiter reasons');
  assert.ok(smartHigh.reason.includes('DRY-RUN') || smartHigh.reason.length > 0);
  pass('assignWorker: smart mode, high-risk → arbiter=true, dryRun skips API');

  // council mode (dryRun skips API)
  const councilResult = await router.assignWorker(medTask, { mode: 'council', dryRun: true });
  assert.ok(councilResult.primary, 'council mode must return primary');
  assert.strictEqual(councilResult.needsGptArbiter, true);
  assert.ok(councilResult.reason.includes('DRY-RUN'));
  pass('assignWorker: council mode, dryRun');
}

// ── routeSpec ─────────────────────────────────────────────────────────────────

async function runRouteSpecTests() {
  const tasks = [
    { id: 'T001', title: 'fix button style',            difficulty: 'light'  },
    { id: 'T002', title: 'implement search API',         difficulty: 'medium' },
    { id: 'T003', title: 'system architecture design',   difficulty: 'high'   },
    { id: 'T004', title: '営業メール自動送信',            difficulty: 'medium' },
  ];

  const routed = await router.routeSpec(tasks, { mode: 'simple', dryRun: true });
  assert.strictEqual(routed.length, 4, 'must route all 4 tasks');

  for (const t of routed) {
    assert.ok(t.assignment,           `${t.id} must have assignment`);
    assert.ok(t.assignment.primary,   `${t.id} must have primary worker`);
    assert.ok(t.assignment.reason,    `${t.id} must have reason`);
    assert.ok(typeof t.isSalesDx === 'boolean', `${t.id} must have isSalesDx`);
  }
  pass('routeSpec: all 4 tasks routed with assignment + attributes');

  // salesDx task (T004) must not use cheap_code_worker
  const salesRouted = routed.find(t => t.id === 'T004');
  assert.ok(salesRouted.isSalesDx, 'T004 must be classified as salesDx');
  assert.notStrictEqual(salesRouted.assignment.primary, 'cheap_code_worker', 'salesDx must not use cheap_code_worker');
  pass('routeSpec: salesDx task avoids DeepSeek');

  // high task should get gpt_upper
  const highRouted = routed.find(t => t.id === 'T003');
  assert.strictEqual(highRouted.assignment.primary, 'gpt_upper', 'high task → gpt_upper');
  pass('routeSpec: high task → gpt_upper');
}

// ── Dashboard display (smoke) ─────────────────────────────────────────────────

async function runDashboardSmoke() {
  const tasks = [
    { id: 'T001', title: 'fix typo',               difficulty: 'light'  },
    { id: 'T002', title: 'API endpoint migration',  difficulty: 'medium', description: 'deploy to production' },
    { id: 'T003', title: '営業DX機能追加',           difficulty: 'medium' },
  ];
  const routed = await router.routeSpec(tasks, { mode: 'simple', dryRun: true });

  // Should not throw
  let thrown = false;
  try {
    const origLog = console.log;
    const captured = [];
    console.log = (...args) => captured.push(args.join(' '));
    router.printDashboard(routed, { mode: 'simple', dryRun: true });
    console.log = origLog;

    assert.ok(captured.length > 3, 'dashboard must produce output');
    assert.ok(captured.some(l => l.includes('Smart Task Router')), 'must include header');
  } catch (e) {
    thrown = true;
    console.log = console.log; // restore
    throw e;
  }
  pass('printDashboard: renders without crash');
}

// ── kosame-auto-dev integration ───────────────────────────────────────────────

assert.ok(typeof autoDev.executeWithWorker === 'function', 'executeWithWorker must be exported');
pass('kosame-auto-dev exports executeWithWorker');

assert.ok(typeof autoDev.runAutoDev === 'function',      'runAutoDev must be exported');
assert.ok(typeof autoDev.runTask === 'function',          'runTask must be exported');
pass('kosame-auto-dev exports runAutoDev and runTask');

// ── workerLabel ───────────────────────────────────────────────────────────────

const label = router.workerLabel('cheap_code_worker');
assert.ok(typeof label === 'string', 'workerLabel must return string');
assert.ok(label.length > 0, 'workerLabel must be non-empty');
pass('workerLabel returns non-empty string');

const unknownLabel = router.workerLabel('unknown_worker');
assert.ok(typeof unknownLabel === 'string', 'workerLabel handles unknown worker');
pass('workerLabel handles unknown worker gracefully');

// ── Run async tests ───────────────────────────────────────────────────────────

(async () => {
  try {
    await runAssignWorkerTests();
    await runRouteSpecTests();
    await runDashboardSmoke();

    console.log(`\n✓ All ${passed} checks passed\n`);
  } catch (e) {
    console.error('\nFAIL:', e.message);
    process.exit(1);
  }
})();
