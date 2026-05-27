'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.3.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.3.0-release-record.md');
assert('doc exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.3.0', c.includes('3.3.0'));
  assert('doc mentions Auto Decision', c.includes('Auto Decision'));
  assert('doc mentions auto-decision-report-generator', c.includes('auto-decision-report-generator'));
}

const tools = [
  'tools/commit-decision-report.js', 'tools/push-decision-report.js',
  'tools/release-decision-report.js', 'tools/dispatch-decision-report.js',
  'tools/auto-decision-report-generator.js'
];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
