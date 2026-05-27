/**
 * Smoke Test: Session Repair Checkpoint v2.4.0
 */
const { createRepairCheckpoint } = require('../tools/session-repair-checkpoint.js');

function runSmokeTest() {
  console.log('Running smoke test: Session Repair Checkpoint v2.4.0');

  const chk = createRepairCheckpoint({
    session_id: 'test-session-001',
    trigger: 'verify_failure',
    verify_error_detail: 'smoke/dev-agent-foo-smoke.js: assertion failed at line 15',
    failed_smoke_tests: ['smoke/dev-agent-foo-smoke.js'],
    failed_files: ['tools/foo.js'],
    repair_agent: 'claude',
    repair_scope: 'minimal',
    repair_instructions: ['特定のassertionを修正してください']
  });

  if (chk.checkpoint_type !== 'session_repair_checkpoint') throw new Error('Wrong checkpoint_type');
  if (chk.trigger !== 'verify_failure') throw new Error('trigger mismatch');
  if (chk.failure_context.failed_smoke_tests.length !== 1) throw new Error('Should have 1 failed smoke test');
  if (!Array.isArray(chk.repair_plan.instructions)) throw new Error('instructions must be array');
  if (chk.repair_plan.instructions.length < 5) throw new Error('Should have at least 5 instructions (5 defaults)');
  if (!chk.repair_plan.instructions.some(i => i.includes('node --check'))) throw new Error('Missing node --check instruction');
  if (!Array.isArray(chk.safety_constraints)) throw new Error('safety_constraints must be array');
  if (!chk.safety_constraints.some(c => c.includes('大規模リファクタ'))) throw new Error('Missing refactor safety constraint');
  if (chk.completion_criteria.verify !== 'pass') throw new Error('completion_criteria.verify should be pass');
  if (chk.version !== '2.4.0') throw new Error('Version mismatch');
  if (!chk.dryRun) throw new Error('dryRun missing');

  console.log('Smoke test PASSED');
  return { version: '2.4.0', purpose: 'Session Repair Checkpoint Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
