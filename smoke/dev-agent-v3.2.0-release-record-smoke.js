'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.2.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.2.0-release-record.md');
assert('v3.2.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.2.0', c.includes('3.2.0'));
  assert('doc mentions Auto-Reader', c.includes('Auto-Reader'));
  assert('doc mentions combined-state-snapshot', c.includes('combined-state-snapshot'));
}

const fixtures = ['fixtures/repo-state.sample.json', 'fixtures/actions-state.sample.json', 'fixtures/verify-state.sample.json'];
for (const f of fixtures) assert(`fixture exists: ${f}`, fs.existsSync(path.join(__dirname, '..', f)));

const tools = ['tools/repo-state-reader.js', 'tools/actions-state-reader.js', 'tools/verify-state-reader.js', 'tools/combined-state-snapshot.js'];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
