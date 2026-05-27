'use strict';
const { generateClaudeTaskPrompt } = require('../tools/claude-task-prompt-generator');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== claude-task-prompt-generator smoke ===');

const r1 = generateClaudeTaskPrompt({
  taskType: 'implementation',
  taskName: 'Add kosame-status',
  description: 'Implement executeStatusCommand',
  targetFiles: ['tools/kosame-status-command.js', 'smoke/dev-agent-kosame-status-command-smoke.js'],
  constraints: ['v2.5.0 packs を壊さない'],
  verifyCommand: 'npm run verify'
});

assert('generator field', r1.generator === 'claude-task-prompt-generator');
assert('taskName set', r1.taskName === 'Add kosame-status');
assert('version 2.8.0', r1.version === '2.8.0');
assert('dryRun true', r1.dryRun === true);
assert('prompt is string', typeof r1.prompt === 'string');
assert('prompt contains task name', r1.prompt.includes('Add kosame-status'));
assert('prompt contains constraints', r1.prompt.includes('Constraints'));
assert('prompt contains npm run verify', r1.prompt.includes('npm run verify'));
assert('default constraints included', r1.constraints.some(c => c.includes('ANESTY')));
assert('custom constraint included', r1.constraints.some(c => c.includes('v2.5.0')));
assert('targetFiles 2', r1.targetFiles.length === 2);
assert('complexity: low (2 files)', r1.estimatedComplexity === 'low');

// Test: medium complexity
const rm = generateClaudeTaskPrompt({ taskName: 'mid', targetFiles: ['a', 'b', 'c'] });
assert('complexity: medium (3 files)', rm.estimatedComplexity === 'medium');

// Test: high complexity
const r2 = generateClaudeTaskPrompt({
  taskName: 'big-task',
  targetFiles: ['a', 'b', 'c', 'd', 'e', 'f']
});
assert('complexity: high (6 files)', r2.estimatedComplexity === 'high');

// Test: low complexity
const r3 = generateClaudeTaskPrompt({ taskName: 'small', targetFiles: ['a'] });
assert('complexity: low (1 file)', r3.estimatedComplexity === 'low');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
