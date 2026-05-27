'use strict';
const { generateSafeCommands, GENERATOR_VERSION } = require('../tools/kosame-safe-command-generator');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-safe-command-generator smoke ===');

// commit operation
const r1 = generateSafeCommands({
  operation: 'commit',
  commitInput: { intendedFiles: ['tools/foo.js'], commitMessage: 'test commit', verifyStatus: 'passed' }
});
assert('generator field', r1.generator === 'kosame-safe-command-generator');
assert('generator_version 3.4.0', r1.generator_version === '3.4.0');
assert('dryRun true', r1.dryRun === true);
assert('commit: operation', r1.operation === 'commit');
assert('commit: canProceed', r1.canProceed === true);
assert('commit: allSafe', r1.allSafe === true);
assert('commit: no git add -A', !r1.commands.some(c => typeof c === 'string' && c.includes('git add -A')));

// push operation
const r2 = generateSafeCommands({
  operation: 'push',
  pushInput: { branch: 'main', verifyStatus: 'passed', workingTreeClean: true, isAhead: true }
});
assert('push: gate_required', r2.gate_required === true);
assert('push: humanApprovalRequired', r2.humanApprovalRequired === true);

// tag operation
const r3 = generateSafeCommands({
  operation: 'tag',
  tagInput: { targetVersion: '3.4.0', actionsStatus: 'success', verifyStatus: 'passed', workingTreeClean: true, isAhead: false }
});
assert('tag: gate_required', r3.gate_required === true);
assert('tag: canProceed (no junya)', r3.canProceed === true);
assert('tag: junyaApproved false by default', r3.junyaApproved === false);

// custom operation with denied command
const r4 = generateSafeCommands({
  operation: 'custom',
  customCommands: ['npm run verify', 'rm -rf dist']
});
assert('custom: allSafe false (rm -rf)', r4.allSafe === false);
assert('custom: guardResult.deniedCount 1', r4.guardResult.deniedCount === 1);

// unknown operation → noop
const r5 = generateSafeCommands({ operation: 'unknown-op' });
assert('noop: no error', !!r5.note);

// GENERATOR_VERSION export
assert('GENERATOR_VERSION: 3.4.0', GENERATOR_VERSION === '3.4.0');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
