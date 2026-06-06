'use strict';

const assert = require('assert');
const pkg = require('../package.json');
const inbox = require('../tools/kosame-command-inbox');

let passed = 0;
function pass(msg) {
  passed += 1;
  console.log(`  PASS: ${msg}`);
}

console.log('=== v110.15 command inbox auto runner smoke ===');

assert.strictEqual(pkg.version, '110.15.0');
pass('package version is 110.15.0');

assert.ok(pkg.scripts.inbox);
pass('inbox script exists');

assert.ok(pkg.scripts['smoke:v110-15-command-inbox-auto-runner']);
pass('v110.15 smoke script exists');

assert.strictEqual(inbox.TOOL_META.version, '110.15.0');
pass('tool meta version is 110.15.0');

const args = inbox.parseArgs(['--input=ANESTY Board v87.0.15を進めて', '--yes', '--run']);
assert.strictEqual(args.input, 'ANESTY Board v87.0.15を進めて');
assert.strictEqual(args.yes, true);
assert.strictEqual(args.run, true);
pass('parseArgs supports --run');

const plan = inbox.buildInboxPlan({ input: args.input });
assert.strictEqual(plan.repo.id, 'anesty-board');
assert.ok(plan.nextCommand.includes('npm run route'));
pass('plan generates route nextCommand');

const noRun = inbox.runNextCommand(plan, { run: false, yes: true });
assert.strictEqual(noRun.executed, false);
assert.strictEqual(noRun.reason, 'run flag not set');
pass('runNextCommand does nothing without --run');

const noYes = inbox.runNextCommand(plan, { run: true, yes: false });
assert.strictEqual(noYes.executed, false);
assert.strictEqual(noYes.reason, '--yes required for --run');
pass('runNextCommand blocks without --yes');

assert.strictEqual(plan.safety.dryRun, true);
assert.strictEqual(plan.safety.realProductActionsExecuted, false);
assert.strictEqual(plan.safety.dangerousActionsDenied, true);
pass('safety flags preserved');

console.log(`PASS: v110.15 command inbox auto runner smoke (${passed} checks)`);
