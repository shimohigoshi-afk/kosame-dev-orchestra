'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const mod = require('../tools/deepseek-local-patch-executor');

console.log('=== v110.30 deepseek patch executor smoke ===');

function pass(msg) {
  console.log('  PASS:', msg);
}

assert.strictEqual(mod.TOOL_META.version, '110.30.0');
pass('TOOL_META.version is 110.30.0');

const patch = `[FILE] tmp/v110-30-ok.js
\`\`\`js
'use strict';
console.log('ok');
\`\`\`
`;

const parsed = mod.parseKosamePatch(patch);
assert.strictEqual(parsed.length, 1);
assert.strictEqual(parsed[0].target, 'tmp/v110-30-ok.js');
pass('parseKosamePatch parses [FILE] block');

const dry = mod.applyPatches(parsed, { write: false });
assert.strictEqual(dry.ok, true);
assert.strictEqual(dry.dryRun, true);
assert.strictEqual(dry.human_gate, true);
assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'tmp/v110-30-ok.js')), false);
pass('dryRun does not write file and requires human_gate');

assert.strictEqual(mod.isBlockedPath('.env'), true);
assert.strictEqual(mod.isBlockedPath('credentials.json'), true);
assert.strictEqual(mod.isBlockedPath('package-lock.json'), true);
assert.strictEqual(mod.isBlockedPath('node_modules/x.js'), true);
assert.throws(() => mod.isBlockedPath('../x.js'), /path traversal rejected/);
pass('dangerous paths are rejected');

const badContent = `[FILE] tmp/bad.js
\`\`\`js
require('child_process').execSync('git push origin main');
\`\`\`
`;
const badParsed = mod.parseKosamePatch(badContent);
const badResult = mod.applyPatches(badParsed, { write: false });
assert.strictEqual(badResult.ok, false);
assert.strictEqual(badResult.reason, 'blocked patch target or content');
pass('dangerous content is rejected');

assert.throws(() => mod.parseKosamePatch('no patch here'), /no \[FILE\] patch blocks found/);
pass('invalid format is rejected');

const multi = `[FILE] tmp/a.js
\`\`\`js
'use strict';
module.exports = 1;
\`\`\`

[FILE] tmp/b.txt
\`\`\`txt
hello
\`\`\`
`;
assert.strictEqual(mod.parseKosamePatch(multi).length, 2);
pass('multiple file patches are parsed');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v110-30-'));
const oldCwd = process.cwd();
process.chdir(tmpDir);
try {
  const writeRes = mod.applyPatches(mod.parseKosamePatch(patch), { write: true });
  assert.strictEqual(writeRes.ok, true);
  assert.strictEqual(writeRes.dryRun, false);
  assert.strictEqual(fs.existsSync(path.join(tmpDir, 'tmp/v110-30-ok.js')), true);
  assert.ok(writeRes.nodeChecks.length >= 1);
  assert.strictEqual(writeRes.realGitActionsExecuted, false);
  assert.strictEqual(writeRes.realDeployActionsExecuted, false);
  pass('--write applies allowed file and runs node --check');
} finally {
  process.chdir(oldCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('PASS: v110.30 deepseek patch executor smoke');
