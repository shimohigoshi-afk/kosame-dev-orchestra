'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v2.7.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v2.7.0-release-record.md');
const fixtGit = path.join(__dirname, '../fixtures/git-status.sample.json');
const fixtActions = path.join(__dirname, '../fixtures/github-actions-result.sample.json');

assert('v2.7.0 release record doc exists', fs.existsSync(docPath));
assert('git-status fixture exists', fs.existsSync(fixtGit));
assert('github-actions fixture exists', fs.existsSync(fixtActions));

if (fs.existsSync(docPath)) {
  const content = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 2.7.0', content.includes('2.7.0'));
  assert('doc mentions Real Status Import', content.includes('Real Status Import'));
  assert('doc mentions repository-health-snapshot', content.includes('repository-health-snapshot'));
}

const tools = [
  'tools/git-status-importer.js',
  'tools/github-actions-result-importer.js',
  'tools/verify-result-importer.js',
  'tools/repository-health-snapshot.js'
];
for (const t of tools) {
  assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));
}

if (fs.existsSync(fixtGit)) {
  const g = JSON.parse(fs.readFileSync(fixtGit, 'utf-8'));
  assert('git fixture has branch', 'branch' in g);
  assert('git fixture has statusLines', 'statusLines' in g);
}

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
