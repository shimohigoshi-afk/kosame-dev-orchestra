'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.5.0-release-record smoke ===');

// Release record doc
const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.5.0-release-record.md');
assert('v3.5.0 release record exists', fs.existsSync(docPath));
if (fs.existsSync(docPath)) {
  const c = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.5.0', c.includes('3.5.0'));
  assert('doc mentions VP Operation Loop', c.includes('VP Operation Loop'));
  assert('doc mentions vp-handoff-packet', c.includes('vp-handoff-packet'));
  assert('doc mentions VERDICT', c.includes('VERDICT'));
}

// Operation Standard doc
const stdPath = path.join(__dirname, '../docs/ai-dev-team/kosame-vp-operation-standard-v3.5.0.md');
assert('operation standard doc exists', fs.existsSync(stdPath));
if (fs.existsSync(stdPath)) {
  const c = fs.readFileSync(stdPath, 'utf-8');
  assert('standard mentions じゅんやさん', c.includes('じゅんやさん'));
  assert('standard mentions Phase 1', c.includes('Phase 1'));
  assert('standard mentions deny-command-guard', c.includes('deny-command-guard'));
}

// v3.5.0 tools
const v35Tools = [
  'tools/vp-next-action-controller.js',
  'tools/vp-human-approval-gate.js',
  'tools/vp-execution-review-packet.js',
  'tools/vp-handoff-packet.js',
  'tools/kosame-vp-operation-loop.js'
];
for (const t of v35Tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

// v3.4.0 tools
const v34Tools = ['tools/deny-command-guard.js', 'tools/kosame-safe-command-generator.js'];
for (const t of v34Tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

// v3.2.0 tools
const v32Tools = ['tools/repo-state-reader.js', 'tools/actions-state-reader.js', 'tools/verify-state-reader.js', 'tools/combined-state-snapshot.js'];
for (const t of v32Tools) assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));

// package.json
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
assert('package version 3.5.0', pkg.version === '3.5.0');
assert('scripts has smoke:vp-next-action-controller', 'smoke:vp-next-action-controller' in pkg.scripts);
assert('scripts has smoke:vp-execution-review-packet', 'smoke:vp-execution-review-packet' in pkg.scripts);
assert('scripts has smoke:vp-handoff-packet', 'smoke:vp-handoff-packet' in pkg.scripts);
assert('scripts has smoke:kosame-vp-operation-loop', 'smoke:kosame-vp-operation-loop' in pkg.scripts);
assert('scripts has pm-agent:vp-operation-loop', 'pm-agent:vp-operation-loop' in pkg.scripts);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
