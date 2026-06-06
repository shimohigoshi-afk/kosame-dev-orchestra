'use strict';

const assert = require('assert');
const pkg = require('../package.json');
const executor = require('../tools/kosame-patch-executor');

let passed = 0;
function pass(msg) {
  passed += 1;
  console.log(`  PASS: ${msg}`);
}

console.log('=== v110.16 agent patch executor smoke ===');

assert.ok(pkg.version === '110.16.0' || pkg.version === '110.17.0');
pass('package version is valid');

assert.ok(executor.TOOL_META.version === '110.16.0' || executor.TOOL_META.version === '110.17.0');
pass('tool meta version is valid');

// extractPatches test
const sampleResponse = `
Here is the implementation.
[FILE] smoke/executor-test-dummy.js
\`\`\`javascript
console.log('dummy');
\`\`\`
`;
const patches = executor.extractPatches(sampleResponse);
assert.strictEqual(patches.length, 1);
assert.strictEqual(patches[0].file, 'smoke/executor-test-dummy.js');
assert.ok(patches[0].content.includes("console.log('dummy');"));
pass('extractPatches identifies [FILE] pattern');

const sample2 = `
\`\`\`javascript
// file: smoke/executor-test-dummy2.js
console.log('dummy2');
\`\`\`
`;
const patches2 = executor.extractPatches(sample2);
assert.strictEqual(patches2.length, 1);
assert.strictEqual(patches2[0].file, 'smoke/executor-test-dummy2.js');
pass('extractPatches identifies // file: hint');

console.log(`PASS: v110.16 agent patch executor smoke (${passed} checks)`);
