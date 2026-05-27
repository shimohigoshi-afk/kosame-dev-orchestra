'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v2.8.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v2.8.0-release-record.md');
assert('v2.8.0 release record doc exists', fs.existsSync(docPath));

if (fs.existsSync(docPath)) {
  const content = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 2.8.0', content.includes('2.8.0'));
  assert('doc mentions One-shot', content.includes('One-shot'));
  assert('doc mentions one-shot-operation-plan', content.includes('one-shot-operation-plan'));
}

const tools = [
  'tools/one-shot-operation-plan.js',
  'tools/safe-command-plan-generator.js',
  'tools/claude-task-prompt-generator.js',
  'tools/gemini-bulk-prompt-generator.js',
  'tools/human-approval-summary-generator.js'
];
for (const t of tools) {
  assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));
}

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
