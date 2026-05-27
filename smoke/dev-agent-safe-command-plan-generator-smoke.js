'use strict';
const { generateSafeCommandPlan, classifyCommand } = require('../tools/safe-command-plan-generator');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== safe-command-plan-generator smoke ===');

// Test 1: all safe commands
const r1 = generateSafeCommandPlan({
  taskName: 'verify-run',
  commands: ['npm run verify', 'node --check tools/foo.js']
});
assert('generator field', r1.generator === 'safe-command-plan-generator');
assert('all safe: safeToAutoExecute', r1.safeToAutoExecute === true);
assert('all safe: humanApprovalRequired false', r1.humanApprovalRequired === false);
assert('all safe: dangerousStepCount 0', r1.dangerousStepCount === 0);
assert('all safe: safeStepCount 2', r1.safeStepCount === 2);
assert('version 2.8.0', r1.version === '2.8.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: mixed safe and dangerous
const r2 = generateSafeCommandPlan({
  taskName: 'release',
  commands: ['npm run verify', 'git push origin main', 'git tag v2.8.0']
});
assert('mixed: safeToAutoExecute false', r2.safeToAutoExecute === false);
assert('mixed: humanApprovalRequired true', r2.humanApprovalRequired === true);
assert('mixed: dangerousStepCount 2', r2.dangerousStepCount === 2);
assert('mixed: safeStepCount 1', r2.safeStepCount === 1);
assert('mixed: plan has 3 steps', r2.plan.length === 3);

// Test 3: classifyCommand
const safe = classifyCommand('npm run verify');
assert('classify: npm verify is safe', safe.safe === true);
assert('classify: npm verify no approval', safe.requiresHumanApproval === false);

const dangerous = classifyCommand('git push origin main');
assert('classify: git push is dangerous', dangerous.safe === false);
assert('classify: git push requires approval', dangerous.requiresHumanApproval === true);

const tag = classifyCommand('git tag v2.8.0');
assert('classify: git tag is dangerous', tag.safe === false);

// Test 4: empty commands
const r4 = generateSafeCommandPlan({ commands: [] });
assert('empty: totalSteps 0', r4.totalSteps === 0);
assert('empty: safeToAutoExecute true', r4.safeToAutoExecute === true);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
