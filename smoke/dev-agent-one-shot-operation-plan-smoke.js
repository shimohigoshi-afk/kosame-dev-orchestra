'use strict';
const { generateOneShotOperationPlan } = require('../tools/one-shot-operation-plan');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== one-shot-operation-plan smoke ===');

// Test 1: full plan with human approval
const r1 = generateOneShotOperationPlan({
  operationName: 'v2.8.0-release',
  targetVersion: '2.8.0',
  taskDescription: 'Implement v2.8.0 pack',
  targetFiles: ['tools/one-shot-operation-plan.js'],
  commands: ['npm run verify', 'git push origin main', 'git tag v2.8.0'],
  needsHumanApproval: true,
  riskLevel: 'High',
  dangerousCommands: ['git push origin main', 'git tag v2.8.0'],
  consequences: ['push to main', 'tag created']
});

assert('plan field', r1.plan === 'one-shot-operation-plan');
assert('version 2.8.0', r1.version === '2.8.0');
assert('dryRun true', r1.dryRun === true);
assert('operationName set', r1.operationName === 'v2.8.0-release');
assert('claudePrompt exists', !!r1.claudePrompt);
assert('claudePrompt is object', typeof r1.claudePrompt === 'object');
assert('commandPlan exists', !!r1.commandPlan);
assert('approvalSummary exists (human approval)', !!r1.approvalSummary);
assert('requiresHumanApproval true', r1.requiresHumanApproval === true);
assert('phases includes human_approval', r1.phases.includes('human_approval'));
assert('phases includes claude_implementation', r1.phases.includes('claude_implementation'));
assert('dangerousCommandCount 2', r1.dangerousCommandCount === 2);
assert('safeCommandCount 1', r1.safeCommandCount === 1);

// Test 2: no human approval needed (all safe commands)
const r2 = generateOneShotOperationPlan({
  operationName: 'run-verify',
  commands: ['npm run verify', 'node --check tools/foo.js'],
  needsHumanApproval: false,
  riskLevel: 'Low'
});
assert('safe only: approvalSummary null', r2.approvalSummary === null);
assert('safe only: requiresHumanApproval false', r2.requiresHumanApproval === false);
assert('safe only: phases no human_approval', !r2.phases.includes('human_approval'));

// Test 3: Gemini included
const r3 = generateOneShotOperationPlan({
  operationName: 'bulk-gen',
  needsGemini: true,
  itemsToGenerate: ['smoke-a.js', 'smoke-b.js', 'smoke-c.js'],
  commands: ['npm run verify'],
  riskLevel: 'Low'
});
assert('gemini: geminiPrompt exists', !!r3.geminiPrompt);
assert('gemini: phases includes gemini_bulk_gen', r3.phases.includes('gemini_bulk_gen'));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
