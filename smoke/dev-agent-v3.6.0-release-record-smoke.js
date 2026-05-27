'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.6.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.6.0-release-record.md');
assert('v3.6.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.6.0', c.includes('3.6.0'));
  assert('doc mentions CLI Runner', c.includes('CLI Runner'));
  assert('doc mentions kosame-cli-runner', c.includes('kosame-cli-runner'));
  assert('doc mentions FORBIDDEN', c.includes('FORBIDDEN'));
}

const tools = ['tools/kosame-cli-runner.js'];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
assert('package version >= 3.6.0', parseFloat(pkg.version) >= 3.6);
assert('scripts has smoke:kosame-cli-runner', 'smoke:kosame-cli-runner' in pkg.scripts);
assert('scripts has kosame:next', 'kosame:next' in pkg.scripts);
assert('scripts has pm-agent:vp-practical-console', 'pm-agent:vp-practical-console' in pkg.scripts);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
