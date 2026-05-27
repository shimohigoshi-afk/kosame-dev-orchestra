'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.9.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.9.0-release-record.md');
assert('v3.9.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.9.0', c.includes('3.9.0'));
  assert('doc mentions Handoff', c.includes('Handoff'));
  assert('doc mentions concise', c.includes('concise'));
  assert('doc mentions detailed', c.includes('detailed'));
}

const tools = ['tools/kosame-handoff-auto-generator.js'];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
assert('scripts has smoke:kosame-handoff-auto-generator', 'smoke:kosame-handoff-auto-generator' in pkg.scripts);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
