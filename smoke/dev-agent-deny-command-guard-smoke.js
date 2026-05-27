'use strict';
const { guardCommand, guardCommandList, DENY_PATTERNS } = require('../tools/deny-command-guard');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== deny-command-guard smoke ===');

// Safe commands
assert('npm verify: allowed', guardCommand('npm run verify').allowed === true);
assert('git status: allowed', guardCommand('git status -sb').allowed === true);
assert('git add specific: allowed', guardCommand('git add tools/foo.js').allowed === true);
assert('git log: allowed', guardCommand('git log --oneline -3').allowed === true);
assert('node --check: allowed', guardCommand('node --check tools/foo.js').allowed === true);

// Forbidden commands
const rmRf = guardCommand('rm -rf node_modules');
assert('rm -rf: denied', rmRf.allowed === false);
assert('rm -rf: CRITICAL', rmRf.severity === 'CRITICAL');

const resetHard = guardCommand('git reset --hard HEAD');
assert('git reset --hard: denied', resetHard.allowed === false);
assert('git reset --hard: CRITICAL', resetHard.severity === 'CRITICAL');

const gcloudDeploy = guardCommand('gcloud run deploy my-service');
assert('gcloud deploy: denied', gcloudDeploy.allowed === false);

const envAccess = guardCommand('cat .env');
assert('.env access: denied', envAccess.allowed === false);

const gitPushForce = guardCommand('git push --force origin main');
assert('git push --force: denied', gitPushForce.allowed === false);

const dockerBuild = guardCommand('docker build .');
assert('docker build: denied', dockerBuild.allowed === false);

// guardCommandList
const listResult = guardCommandList(['npm run verify', 'rm -rf dist', 'git status -sb']);
assert('list: allAllowed false', listResult.allAllowed === false);
assert('list: deniedCount 1', listResult.deniedCount === 1);
assert('list: allowedCount 2', listResult.allowedCount === 2);
assert('list: dryRun', listResult.dryRun === true);
assert('list: version 3.4.0', listResult.version === '3.4.0');

// DENY_PATTERNS export
assert('DENY_PATTERNS: array', Array.isArray(DENY_PATTERNS));
assert('DENY_PATTERNS: has entries', DENY_PATTERNS.length > 0);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
