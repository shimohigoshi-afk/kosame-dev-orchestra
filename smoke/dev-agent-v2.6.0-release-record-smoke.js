'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('=== v2.6.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v2.6.0-release-record.md');
const fixtPath = path.join(__dirname, '../fixtures/kosame-status.sample.json');

const docExists = fs.existsSync(docPath);
const fixtExists = fs.existsSync(fixtPath);

assert('v2.6.0 release record doc exists', docExists);
assert('kosame-status fixture exists', fixtExists);

if (docExists) {
  const content = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains v2.6.0', content.includes('2.6.0'));
  assert('doc mentions Operator Command Console', content.includes('Operator Command Console'));
  assert('doc mentions kosame-status-command', content.includes('kosame-status-command'));
  assert('doc mentions gate_required', content.includes('gate_required'));
}

if (fixtExists) {
  const fixture = JSON.parse(fs.readFileSync(fixtPath, 'utf-8'));
  assert('fixture has packageVersion', 'packageVersion' in fixture);
  assert('fixture has branch', 'branch' in fixture);
  assert('fixture has actionsStatus', 'actionsStatus' in fixture);
}

// v2.6.0 tools exist
const tools = [
  'tools/kosame-status-command.js',
  'tools/kosame-commit-check-command.js',
  'tools/kosame-push-check-command.js',
  'tools/kosame-release-check-command.js',
  'tools/kosame-dispatch-command.js',
  'tools/kosame-operator-command-console.js'
];
for (const t of tools) {
  assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));
}

if (failed > 0) {
  console.error(`\nFAILED: ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} / ${passed + failed}`);
