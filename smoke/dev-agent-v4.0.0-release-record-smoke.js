'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}


const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v4.0.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v4.0.0-release-record.md');
assert('v4.0.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 4.0.0', c.includes('4.0.0'));
  assert('doc mentions Practical Operating Console', c.includes('Practical Operating Console'));
  assert('doc mentions SAFE_COMMAND_BOUNDARY', c.includes('SAFE_COMMAND_BOUNDARY') || c.includes('Safe Command Boundary'));
  assert('doc mentions じゅんやさん', c.includes('じゅんやさん'));
}

const stdPath = path.join(__dirname, '../docs/ai-dev-team/kosame-vp-operation-standard-v4.0.0.md');
assert('v4.0.0 operation standard exists', fs.existsSync(stdPath));
if (fs.existsSync(stdPath)) {
  const c = fs.readFileSync(stdPath, 'utf-8');
  assert('standard mentions Practical', c.includes('Practical'));
  assert('standard mentions approval-board', c.includes('approval-board'));
}

const tools = [
  'tools/kosame-vp-practical-console.js',
  'tools/kosame-cli-runner.js',
  'tools/kosame-real-repo-snapshot.js',
  'tools/kosame-approval-board.js',
  'tools/kosame-handoff-auto-generator.js'
];
for (const t of tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
assert('package version 4.0.0 or later', compareVersion(pkg.version, '4.0.0') >= 0);
assert('scripts has smoke:kosame-vp-practical-console', 'smoke:kosame-vp-practical-console' in pkg.scripts);
assert('scripts has pm-agent:vp-practical-console', 'pm-agent:vp-practical-console' in pkg.scripts);
assert('scripts has kosame:next', 'kosame:next' in pkg.scripts);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
