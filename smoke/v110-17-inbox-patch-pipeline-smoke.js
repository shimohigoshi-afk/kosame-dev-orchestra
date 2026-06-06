#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.17 Inbox Patch Pipeline
 *
 * Verifies that the Command Inbox → Patch Executor pipeline
 * integrates correctly: parseArgs, buildCommitCandidate, safety flags.
 */

const assert = require('node:assert');
const pkg = require('../package.json');
const pipeline = require('../tools/kosame-inbox-patch-pipeline');

let passed = 0;
function pass(msg) {
  passed += 1;
  console.log(`  PASS: ${msg}`);
}

console.log('=== v110.17 inbox patch pipeline smoke ===');

// Version
assert.strictEqual(pkg.version, '110.17.0');
pass('package version is 110.17.0');

assert.strictEqual(pipeline.TOOL_META.version, '110.17.0');
pass('tool meta version is 110.17.0');

assert.strictEqual(pipeline.TOOL_META.slug, 'kosame-inbox-patch-pipeline');
pass('tool meta slug is kosame-inbox-patch-pipeline');

// parseArgs: full args
const args = pipeline.parseArgs(['--input=ANESTYを修正して', '--yes', '--live', '--output=out.json']);
assert.strictEqual(args.input, 'ANESTYを修正して');
assert.strictEqual(args.yes, true);
assert.strictEqual(args.live, true);
assert.strictEqual(args.output, 'out.json');
pass('parseArgs: all flags parsed correctly');

// parseArgs: dry-run by default (no --yes)
const dryArgs = pipeline.parseArgs(['--input=テスト入力']);
assert.strictEqual(dryArgs.yes, false, 'dry-run should be default (no --yes)');
assert.strictEqual(dryArgs.live, false);
assert.strictEqual(dryArgs.output, null);
pass('parseArgs: dry-run is default (no --yes)');

// buildCommitCandidate: generates correct candidate
const patches = [{ file: 'tools/test.js', content: 'console.log(1);\n' }];
const candidate = pipeline.buildCommitCandidate(patches, 'ANESTY Board v87.0.14 制作指示書チケット変換');

assert.ok(candidate, 'commit candidate must be generated');
assert.ok(candidate.suggestedMessage.includes('v110.17'), 'suggestedMessage must include v110.17 scope');
assert.ok(candidate.files.includes('tools/test.js'), 'files must include patched file');
assert.strictEqual(candidate.actualCommitNotExecuted, true, 'actualCommitNotExecuted must be true');
assert.strictEqual(candidate.requiresExplicitYes, true, 'requiresExplicitYes must be true');
assert.ok(typeof candidate.gitCommand === 'string' && candidate.gitCommand.includes('git add'), 'gitCommand must be a git add+commit string');
pass('buildCommitCandidate: generates correct candidate');

// buildCommitCandidate: null for empty patches
const noCandidate = pipeline.buildCommitCandidate([], 'no patches here');
assert.strictEqual(noCandidate, null, 'should return null for empty patches');
pass('buildCommitCandidate: returns null for empty patches');

// buildCommitCandidate: null when patches is null
const nullCandidate = pipeline.buildCommitCandidate(null, 'no patches here');
assert.strictEqual(nullCandidate, null, 'should return null for null patches');
pass('buildCommitCandidate: returns null for null input');

// safety: actualCommitNotExecuted always true
assert.strictEqual(candidate.actualCommitNotExecuted, true);
pass('safety: actualCommitNotExecuted=true enforced');

// multiple patches scope
const multiPatches = [
  { file: 'tools/a.js', content: '1' },
  { file: 'tools/b.js', content: '2' },
  { file: 'tools/c.js', content: '3' },
];
const multiCandidate = pipeline.buildCommitCandidate(multiPatches, 'multi file fix');
assert.ok(multiCandidate.scope.includes('3'), 'scope should reflect file count for multiple patches');
assert.strictEqual(multiCandidate.files.length, 3);
pass('buildCommitCandidate: multi-file scope correctly reflects count');

// verify scripts exist
assert.ok(pkg.scripts['smoke:v110-17-inbox-patch-pipeline']);
pass('script smoke:v110-17-inbox-patch-pipeline exists in package.json');

assert.ok(pkg.scripts['inbox-pipeline']);
pass('script inbox-pipeline exists in package.json');

console.log(`\n✅ v110.17 inbox patch pipeline smoke PASSED (${passed} checks)`);
