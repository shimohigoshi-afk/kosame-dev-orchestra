#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.19 Autopilot (Command Inbox full pipeline)
 *
 * Verifies that the inbox entry point wires through to the full pipeline:
 *   npm run inbox -- --input="..." --yes --run
 *   → Inbox → Route → Patch → Verify → Commit Candidate (human gate = commit only)
 */

const assert = require('node:assert');
const pkg = require('../package.json');
const inbox = require('../tools/kosame-command-inbox');

let passed = 0;
function pass(msg) {
  passed += 1;
  console.log(`  PASS: ${msg}`);
}

async function runTests() {
  console.log('=== v110.19 autopilot smoke ===');

  // Version
  assert.ok(pkg.version >= '110.19.0');
  pass('package version is 110.19.0 or later');

  assert.strictEqual(inbox.TOOL_META.version, '110.19.0');
  pass('tool meta version is 110.19.0');

  assert.strictEqual(inbox.TOOL_META.feature, 'v110-19-autopilot');
  pass('tool meta feature is v110-19-autopilot');

  // Scripts exist
  assert.ok(pkg.scripts.inbox, 'npm run inbox script must exist');
  pass('npm run inbox script exists');

  assert.ok(pkg.scripts['smoke:v110-19-autopilot'], 'smoke:v110-19-autopilot script must exist');
  pass('smoke:v110-19-autopilot script exists');

  // parseArgs supports --run
  const args = inbox.parseArgs(['--input=ANESTYを修正して', '--yes', '--run', '--live']);
  assert.strictEqual(args.input, 'ANESTYを修正して');
  assert.strictEqual(args.yes, true);
  assert.strictEqual(args.run, true);
  assert.strictEqual(args.live, true);
  pass('parseArgs supports --run and --live');

  // dryRun default: no --yes → dryRun stays true
  const dryArgs = inbox.parseArgs(['--input=テスト']);
  assert.strictEqual(dryArgs.yes, false);
  assert.strictEqual(dryArgs.run, false);
  pass('dryRun is default (no --yes --run)');

  // runFullPipeline gate: run=false → executed:false
  const noRun = await inbox.runFullPipeline({ run: false, yes: true, input: 'test' });
  assert.strictEqual(noRun.executed, false);
  assert.strictEqual(noRun.reason, 'run flag not set');
  pass('runFullPipeline: run=false → executed:false');

  // runFullPipeline gate: yes=false → executed:false
  const noYes = await inbox.runFullPipeline({ run: true, yes: false, input: 'test' });
  assert.strictEqual(noYes.executed, false);
  assert.strictEqual(noYes.reason, '--yes required for --run');
  pass('runFullPipeline: yes=false → executed:false');

  // runFullPipeline gate: input missing → executed:false
  const noInput = await inbox.runFullPipeline({ run: true, yes: true, input: '' });
  assert.strictEqual(noInput.executed, false);
  assert.strictEqual(noInput.reason, '--input is required');
  pass('runFullPipeline: missing input → executed:false');

  // buildNextCommand uses pipeline (not raw route + patch-executor chain)
  const plan = inbox.buildInboxPlan({ input: 'ANESTY Board v87.0.14を実装して' });
  assert.ok(typeof plan.nextCommand === 'string', 'nextCommand must be a string');
  assert.ok(
    plan.nextCommand.includes('inbox-patch-pipeline'),
    `nextCommand must reference inbox-patch-pipeline, got: ${plan.nextCommand}`
  );
  pass('buildNextCommand references inbox-patch-pipeline (full autopilot)');

  // Safety flags
  assert.strictEqual(plan.safety.dryRun, true);
  assert.strictEqual(plan.safety.realProductActionsExecuted, false);
  assert.strictEqual(plan.safety.dangerousActionsDenied, true);
  assert.strictEqual(plan.safety.commitTagPushRequiresYes, true);
  pass('safety flags: dryRun=true, realProductActionsExecuted=false, dangerousActionsDenied=true');

  // Human approval only for commit/tag/push
  const commitPlan = inbox.buildInboxPlan({ input: 'commitして' });
  assert.strictEqual(commitPlan.humanApprovalRequired, true);
  pass('humanApprovalRequired=true for commit-type input');

  const implPlan = inbox.buildInboxPlan({ input: 'ANESTY Board v87を実装して' });
  assert.strictEqual(implPlan.humanApprovalRequired, false);
  pass('humanApprovalRequired=false for normal implementation input');

  // runNextCommand backward compat still works (used by v110.15 tests)
  const legacyNoRun = inbox.runNextCommand(plan, { run: false, yes: true });
  assert.strictEqual(legacyNoRun.executed, false);
  pass('runNextCommand (legacy) backward compat preserved');

  console.log(`\n✅ v110.19 autopilot smoke PASSED (${passed} checks)`);
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('FAIL:', err.message);
    process.exit(1);
  });
}
