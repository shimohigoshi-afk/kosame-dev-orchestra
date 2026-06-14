#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const { collectLiveCockpitSnapshot, READ_ONLY_COMMANDS } = require('../tools/kosame-live-cockpit-snapshot');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function include(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include ${needle}`);
}

console.log('=== v110.80 live cockpit smoke ===');

const snapshotPath = path.join(__dirname, '..', 'tools', 'kosame-live-cockpit-snapshot.js');
const serverPath = path.join(__dirname, '..', 'tools', 'kosame-live-cockpit-server.js');
const htmlPath = path.join(__dirname, '..', 'public', 'kosame-live-cockpit.html');

mustExist(snapshotPath);
mustExist(serverPath);
mustExist(htmlPath);

assert.ok(pkg.version >= '110.80.1', `package version must be >= 110.80.1 (got ${pkg.version})`);
assert.ok(pkg.scripts['cockpit:snapshot'], 'cockpit:snapshot must exist');
assert.ok(pkg.scripts['cockpit:server'], 'cockpit:server must exist');
assert.ok(pkg.scripts['smoke:v110-80'], 'smoke:v110-80 must exist');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-80'), 'verify must run smoke:v110-80');

const html = read(htmlPath);
include(html, 'CURRENT MISSION', 'HTML');
include(html, '☂️ KOSAME Readonly Monitor', 'HTML');
include(html, 'ACTIVE REPO', 'HTML');
include(html, 'DEV ORCHESTRA STATUS', 'HTML');
include(html, 'SALES DX STATUS', 'HTML');
include(html, 'CHANGED FILES', 'HTML');
include(html, 'STAGED FILES', 'HTML');
include(html, 'RECENT COMMITS', 'HTML');
include(html, 'GITHUB ACTIONS', 'HTML');
include(html, 'HUMAN GATE', 'HTML');
include(html, 'WARNINGS', 'HTML');
include(html, 'NEXT ACTION', 'HTML');
assert.ok(!html.includes('<button'), 'HTML must not include buttons');
assert.ok(!html.includes('onclick='), 'HTML must not include click handlers');
assert.ok(!html.includes('type="button"'), 'HTML must not include button types');
assert.ok(!html.includes('git add'), 'HTML must not mention git add');
assert.ok(!html.includes('git commit'), 'HTML must not mention git commit');
assert.ok(!html.includes('git push'), 'HTML must not mention git push');
assert.ok(!html.includes('git tag'), 'HTML must not mention git tag');
assert.ok(!html.includes('git reset'), 'HTML must not mention git reset');
assert.ok(!html.includes('git checkout --'), 'HTML must not mention git checkout --');

const snapshotSource = read(snapshotPath);
include(snapshotSource, 'git status -sb', 'snapshot source');
include(snapshotSource, 'git diff --name-only', 'snapshot source');
include(snapshotSource, 'git diff --cached --name-only', 'snapshot source');
include(snapshotSource, 'git log --oneline -5', 'snapshot source');
include(snapshotSource, 'gh run list --limit 5', 'snapshot source');
assert.ok(snapshotSource.includes('Blocked non-read-only command'), 'snapshot must enforce read-only blocking');
assert.ok(snapshotSource.includes('READ_ONLY_COMMANDS'), 'snapshot must keep a read-only allowlist');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]add['"]/s.test(snapshotSource), 'snapshot must not execute git add');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]commit['"]/s.test(snapshotSource), 'snapshot must not execute git commit');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]push['"]/s.test(snapshotSource), 'snapshot must not execute git push');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]tag['"]/s.test(snapshotSource), 'snapshot must not execute git tag');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]reset['"]/s.test(snapshotSource), 'snapshot must not execute git reset');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]checkout['"]\s*,\s*['"]--['"]/s.test(snapshotSource), 'snapshot must not execute git checkout --');
assert.ok(!/readFileSync\([^)]*['"][^'"]*\.env['"]/s.test(snapshotSource), 'snapshot must not read .env');
assert.ok(!/readFileSync\([^)]*['"][^'"]*credentials?['"]/s.test(snapshotSource), 'snapshot must not read credentials');

const serverSource = read(serverPath);
include(serverSource, '/api/snapshot', 'server source');
include(serverSource, 'createLiveCockpitServer', 'server source');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]add['"]/s.test(serverSource), 'server must not execute git add');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]commit['"]/s.test(serverSource), 'server must not execute git commit');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]push['"]/s.test(serverSource), 'server must not execute git push');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]tag['"]/s.test(serverSource), 'server must not execute git tag');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]reset['"]/s.test(serverSource), 'server must not execute git reset');
assert.ok(!/execFileSync\([^)]*['"]git['"][^)]*['"]checkout['"]\s*,\s*['"]--['"]/s.test(serverSource), 'server must not execute git checkout --');

assert.ok(Array.from(READ_ONLY_COMMANDS).every(cmd => [
  'git status -sb',
  'git diff --name-only',
  'git diff --cached --name-only',
  'git log --oneline -5',
  'gh run list --limit 5',
].includes(cmd)), 'read-only command allowlist must be exact');

const snapshot = collectLiveCockpitSnapshot();
assert.ok(snapshot, 'snapshot must be created');
assert.ok(snapshot.version >= '110.80.1', `snapshot version must be >= 110.80.1 (got ${snapshot.version})`);
assert.equal(snapshot.currentMission, '☂️ KOSAME Readonly Monitor', 'snapshot mission must match');
assert.ok(snapshot.activeRepo && snapshot.activeRepo.path, 'snapshot must include activeRepo');
assert.ok(snapshot.devOrchestra && snapshot.salesDx, 'snapshot must include both repos');
assert.ok(Array.isArray(snapshot.humanGate) && snapshot.humanGate.length > 0, 'snapshot must include human gate');
assert.ok(Array.isArray(snapshot.warnings), 'snapshot must include warnings');
assert.ok(snapshot.nextAction && typeof snapshot.nextAction === 'string', 'snapshot must include next action');

console.log('  PASS: files, package metadata, source allowlist, and snapshot structure are valid');
console.log('✅ v110.80 live cockpit smoke PASSED');
