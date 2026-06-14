#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const {
  detectConfirmation,
  detectConfirmationInText,
  DEFAULT_LOG_PATHS,
  CONFIRMATION_PATTERNS,
} = require('../tools/kosame-confirmation-detector');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function include(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include "${needle}"`);
}

console.log('=== v110.81 confirmation bridge smoke ===');

const detectorPath = path.join(__dirname, '..', 'tools', 'kosame-confirmation-detector.js');
const serverPath = path.join(__dirname, '..', 'tools', 'kosame-live-cockpit-server.js');
const htmlPath = path.join(__dirname, '..', 'public', 'kosame-live-cockpit.html');

mustExist(detectorPath);
mustExist(serverPath);
mustExist(htmlPath);
console.log('  PASS: required files exist');

assert.ok(pkg.version >= '110.81.0', `package version must be >= 110.81.0 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-81'], 'smoke:v110-81 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-81'), 'verify must include smoke:v110-81');
console.log('  PASS: package.json version and script entries');

const detectorSource = read(detectorPath);
include(detectorSource, 'detectConfirmation', 'detector source');
include(detectorSource, 'detectConfirmationInText', 'detector source');
include(detectorSource, 'DEFAULT_LOG_PATHS', 'detector source');
include(detectorSource, 'CONFIRMATION_PATTERNS', 'detector source');
include(detectorSource, 'would you like to make the following edits', 'detector source');
include(detectorSource, 'readFileTail', 'detector source');
include(detectorSource, 'extractChoices', 'detector source');
include(detectorSource, 'extractFiles', 'detector source');
assert.ok(
  Array.isArray(CONFIRMATION_PATTERNS) && CONFIRMATION_PATTERNS.length > 0,
  'CONFIRMATION_PATTERNS must be a non-empty array'
);
assert.ok(Array.isArray(DEFAULT_LOG_PATHS) && DEFAULT_LOG_PATHS.length > 0, 'DEFAULT_LOG_PATHS must be non-empty');
assert.ok(!/writeFileSync/.test(detectorSource), 'detector must not write files');
assert.ok(!/process\.stdin/.test(detectorSource), 'detector must not touch process.stdin');
assert.ok(!/execFileSync/.test(detectorSource), 'detector must not execute subprocesses');
console.log('  PASS: detector source structure and safety checks');

const serverSource = read(serverPath);
include(serverSource, 'kosame-confirmation-detector', 'server source');
include(serverSource, 'detectConfirmation', 'server source');
include(serverSource, '/api/confirmation', 'server source');
include(serverSource, 'confirmationBridge', 'server source');
assert.ok(!/writeFileSync/.test(serverSource), 'server must not write files');
console.log('  PASS: server has /api/confirmation and confirmationBridge integration');

const html = read(htmlPath);
include(html, 'CONFIRMATION BRIDGE', 'HTML');
include(html, 'cb-panel', 'HTML');
include(html, 'cb-badge-row', 'HTML');
include(html, 'cb-body', 'HTML');
include(html, 'cb-files', 'HTML');
include(html, 'cb-summary', 'HTML');
include(html, 'cb-choices', 'HTML');
include(html, 'cb-context', 'HTML');
include(html, 'cb-source', 'HTML');
include(html, '確認待ち', 'HTML');
include(html, 'renderConfirmationBridge', 'HTML');
include(html, 'confirmationBridge', 'HTML');
include(html, 'sound-toggle', 'HTML');
include(html, 'sound-test', 'HTML');
assert.ok(!html.includes('type="submit"'), 'HTML must not include submit buttons');
assert.ok(!html.includes('type="reset"'), 'HTML must not include reset buttons');
assert.ok(!html.includes('onclick='), 'HTML must not include inline click handlers');
assert.ok(!html.includes('git add'), 'HTML must not mention git add');
assert.ok(!html.includes('git commit'), 'HTML must not mention git commit');
assert.ok(!html.includes('git push'), 'HTML must not mention git push');
console.log('  PASS: HTML has CONFIRMATION BRIDGE section with all required elements');

const mockTextWithConfirmation = `
Processing files...
  - src/app.js: add error handler
  - src/utils/logger.js: update log level

Would you like to make the following edits?
[1] Yes  [2] Yes to all  [3] No
`;

const matched = detectConfirmationInText(mockTextWithConfirmation);
assert.ok(matched !== null, 'detectConfirmationInText must detect confirmation in mock text');
assert.ok(matched.detected === true, 'matched.detected must be true');
assert.ok(Array.isArray(matched.files), 'matched.files must be an array');
assert.ok(Array.isArray(matched.editSummary), 'matched.editSummary must be an array');
assert.ok(Array.isArray(matched.choices), 'matched.choices must be an array');
assert.ok(typeof matched.rawContext === 'string', 'matched.rawContext must be a string');
assert.ok(matched.choices.length > 0, 'choices must be detected from mock text');
assert.ok(matched.choices.some(c => c.key === '1'), 'choice [1] must be detected');
assert.ok(matched.choices.some(c => c.key === '2'), 'choice [2] must be detected');
assert.ok(matched.choices.some(c => c.key === '3'), 'choice [3] must be detected');
console.log('  PASS: detectConfirmationInText correctly identifies confirmation in mock text');

const noConfirmation = detectConfirmationInText('Just some regular output\nNo confirmation here');
assert.equal(noConfirmation, null, 'detectConfirmationInText must return null when no confirmation');
console.log('  PASS: detectConfirmationInText returns null for non-confirmation text');

const nullResult = detectConfirmationInText(null);
assert.equal(nullResult, null, 'detectConfirmationInText must handle null safely');
const emptyResult = detectConfirmationInText('');
assert.equal(emptyResult, null, 'detectConfirmationInText must handle empty string safely');
console.log('  PASS: detectConfirmationInText handles edge cases safely');

const ynText = 'Apply changes to config.json (y/n)';
const ynResult = detectConfirmationInText(ynText);
assert.ok(ynResult !== null, 'detectConfirmationInText must detect (y/n) confirmation');
assert.ok(ynResult.choices.some(c => c.key === 'y'), '(y/n) must produce y choice');
assert.ok(ynResult.choices.some(c => c.key === 'n'), '(y/n) must produce n choice');
console.log('  PASS: detectConfirmationInText handles (y/n) style prompts');

const liveResult = detectConfirmation();
assert.ok(liveResult && typeof liveResult === 'object', 'detectConfirmation must return an object');
assert.ok(typeof liveResult.detected === 'boolean', 'result.detected must be boolean');
assert.ok(Array.isArray(liveResult.files), 'result.files must be an array');
assert.ok(Array.isArray(liveResult.editSummary), 'result.editSummary must be an array');
assert.ok(Array.isArray(liveResult.choices), 'result.choices must be an array');
assert.ok(typeof liveResult.rawContext === 'string', 'result.rawContext must be a string');
assert.ok(typeof liveResult.checkedAt === 'string', 'result.checkedAt must be a string');
assert.ok(Array.isArray(liveResult.checkedPaths), 'result.checkedPaths must be an array');
console.log(`  PASS: detectConfirmation() returned detected=${liveResult.detected}, checked ${liveResult.checkedPaths.length} paths`);

const customPaths = ['/nonexistent/path/output.log'];
const customResult = detectConfirmation({ logPaths: customPaths });
assert.equal(customResult.detected, false, 'no-file result must not be detected');
assert.deepEqual(customResult.checkedPaths, customPaths, 'checkedPaths must match logPaths option');
console.log('  PASS: detectConfirmation respects custom logPaths option');

console.log('✅ v110.81 confirmation bridge smoke PASSED');
