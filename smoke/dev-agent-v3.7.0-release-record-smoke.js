'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.7.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.7.0-release-record.md');
assert('v3.7.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.7.0', c.includes('3.7.0'));
  assert('doc mentions Real Repo Snapshot', c.includes('Real Repo Snapshot'));
  assert('doc mentions riskLevel', c.includes('riskLevel'));
}

const tools = ['tools/kosame-real-repo-snapshot.js'];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
assert('scripts has smoke:kosame-real-repo-snapshot', 'smoke:kosame-real-repo-snapshot' in pkg.scripts);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
