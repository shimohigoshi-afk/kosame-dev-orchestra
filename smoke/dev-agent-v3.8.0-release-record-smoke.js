'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.8.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.8.0-release-record.md');
assert('v3.8.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.8.0', c.includes('3.8.0'));
  assert('doc mentions Approval Board', c.includes('Approval Board'));
  assert('doc mentions じゅんやさん', c.includes('じゅんやさん'));
}

const tools = ['tools/kosame-approval-board.js'];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
assert('scripts has smoke:kosame-approval-board', 'smoke:kosame-approval-board' in pkg.scripts);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
