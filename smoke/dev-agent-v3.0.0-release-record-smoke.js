'use strict';
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== v3.0.0-release-record smoke ===');

const docPath = path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v3.0.0-release-record.md');
const guidePath = path.join(__dirname, '../docs/ai-dev-team/kosame-operating-console-operating-guide.md');

assert('v3.0.0 release record doc exists', fs.existsSync(docPath));
assert('operating guide exists', fs.existsSync(guidePath));

if (fs.existsSync(docPath)) {
  const content = fs.readFileSync(docPath, 'utf-8');
  assert('doc contains 3.0.0', content.includes('3.0.0'));
  assert('doc mentions Operating Console Foundation', content.includes('Operating Console Foundation'));
  assert('doc mentions kosame-operating-console-foundation', content.includes('kosame-operating-console-foundation'));
}

if (fs.existsSync(guidePath)) {
  const content = fs.readFileSync(guidePath, 'utf-8');
  assert('guide contains こさめ副社長', content.includes('こさめ副社長'));
  assert('guide mentions decision mode', content.includes('decision'));
}

const tools = [
  'tools/kosame-operating-console-foundation.js',
  'tools/kosame-operating-decision-packet.js',
  'tools/operating-console-command-map.js'
];
for (const t of tools) {
  assert(`tool exists: ${t}`, fs.existsSync(path.join(__dirname, '..', t)));
}

// Package.json version check
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
assert('package.json version is v3.x or later', Number(pkg.version.split('.')[0]) >= 3);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
