'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v2.9.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v2.9.0-release-record.md');
const fixtPath = path.join(__dirname, '../fixtures/tag-readiness.sample.json');

assert('v2.9.0 release record doc exists', fs.existsSync(docPath));
assert('tag-readiness fixture exists', fs.existsSync(fixtPath));

if (fs.existsSync(docPath)) {
  const content = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 2.9.0', content.includes('2.9.0'));
  assert('doc mentions Release Gate', content.includes('Release Gate'));
  assert('doc mentions release-gate-controller', content.includes('release-gate-controller'));
}

if (fs.existsSync(fixtPath)) {
  const fixture = JSON.parse(fs.readFileSync(fixtPath, 'utf-8'));
  assert('fixture has targetVersion', 'targetVersion' in fixture);
  assert('fixture has actionsStatus', 'actionsStatus' in fixture);
}

const tools = [
  'tools/release-gate-controller.js',
  'tools/tag-readiness-packet.js',
  'tools/release-handoff-packet.js',
  'tools/post-release-next-phase-suggestion.js'
];
for (const t of tools) {
  assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));
}

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
