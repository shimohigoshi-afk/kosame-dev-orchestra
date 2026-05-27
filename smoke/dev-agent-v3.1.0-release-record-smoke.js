'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.1.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.1.0-release-record.md');
assert('v3.1.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.1.0', c.includes('3.1.0'));
  assert('doc mentions CLI Entry', c.includes('CLI Entry'));
  assert('doc mentions kosame-cli-entry', c.includes('kosame-cli-entry'));
}

const tools = ['tools/kosame-cli-entry.js', 'tools/kosame-cli-router.js'];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
assert('package scripts has kosame:status', 'kosame:status' in pkg.scripts);
assert('package scripts has kosame:handoff', 'kosame:handoff' in pkg.scripts);
assert('package scripts has kosame:approval', 'kosame:approval' in pkg.scripts);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
