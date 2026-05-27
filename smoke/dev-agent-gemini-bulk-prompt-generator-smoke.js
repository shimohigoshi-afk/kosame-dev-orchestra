'use strict';
const { generateGeminiBulkPrompt } = require('../tools/gemini-bulk-prompt-generator');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== gemini-bulk-prompt-generator smoke ===');

const r1 = generateGeminiBulkPrompt({
  taskName: 'Generate smoke stubs',
  itemsToGenerate: ['smoke-a.js', 'smoke-b.js', 'smoke-c.js'],
  outputFormat: 'javascript',
  templateHints: ['follow existing pattern', 'use process.exit(1) on failure'],
  maxTokensPerItem: 800
});

assert('generator field', r1.generator === 'gemini-bulk-prompt-generator');
assert('taskName set', r1.taskName === 'Generate smoke stubs');
assert('version 2.8.0', r1.version === '2.8.0');
assert('dryRun true', r1.dryRun === true);
assert('itemCount 3', r1.itemCount === 3);
assert('prompt is string', typeof r1.prompt === 'string');
assert('prompt contains task name', r1.prompt.includes('Generate smoke stubs'));
assert('prompt contains item list', r1.prompt.includes('smoke-a.js'));
assert('estimatedTotalTokens 2400', r1.estimatedTotalTokens === 2400);
assert('suitableForGemini true (3 items)', r1.suitableForGemini === true);

// Test: small batch → not suitable for Gemini
const r2 = generateGeminiBulkPrompt({ itemsToGenerate: ['one.js', 'two.js'] });
assert('2 items: suitableForGemini false', r2.suitableForGemini === false);
assert('2 items: fallbackNote mentions Claude', r2.fallbackNote.includes('Claude'));

// Test: empty items
const r3 = generateGeminiBulkPrompt({ itemsToGenerate: [] });
assert('empty: itemCount 0', r3.itemCount === 0);
assert('empty: suitableForGemini false', r3.suitableForGemini === false);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
