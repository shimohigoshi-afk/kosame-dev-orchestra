#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PKG  = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');

const CANONICAL_HTML = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';

let status = 'ready';
const checks = [];
const warnings = [];
const nextActions = [];

function check(name, ok, detail) {
  if (ok) { checks.push('✅ ' + name); }
  else { checks.push('❌ ' + name + (detail ? ' — ' + detail : '')); if (status === 'ready') status = 'caution'; }
}

// Version
check('package.json version: ' + PKG.version, PKG.version >= '113.3.122');

// Critical files
const criticalFiles = [
  'tools/kosame-live-cockpit-server.js', 'tools/kosame-runner-queue.js',
  'public/kosame-live-cockpit.html', 'package.json', '.gitignore',
];
for (const f of criticalFiles) {
  check('critical file exists: ' + f, fs.existsSync(path.join(ROOT, f)));
}

// .gitignore hygiene
const gi = fs.existsSync(path.join(ROOT, '.gitignore')) ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
const mustIgnore = ['latest*.md', 'latest*.json', 'history/', 'rc80-summary.md', 'rc100-summary.md', 'handoff-latest.md', 'recovery-checklist.md', 'post-rc-summary.md', 'operational-checklist.md', 'ops-validation-summary.md', 'real-http-e2e-report.md', 'test-results/', 'logs/'];
for (const ig of mustIgnore) {
  check('.gitignore covers: ' + ig, gi.includes(ig) || gi.includes(ig.replace('*.','')), '.gitignore missing: ' + ig);
}
check('.gitignore does NOT cover run-latest.sh', !gi.split('\n').some(l => l.includes('run-latest.sh') && !l.startsWith('#')), 'run-latest.sh should NOT be ignored');

// public/test.html cleanup
const testHtmlPath = path.join(ROOT, 'public', 'test.html');
const testHtmlContent = fs.existsSync(testHtmlPath) ? fs.readFileSync(testHtmlPath, 'utf8') : '';
const badMarkers = ['KOSAME_UNIQUE_TEST', 'KOSAME_BROWSER_TEST', 'KOSAME_APPEND', 'KOSAME_HEADING', 'KOSAME_CREATE', 'KOSAME_RC', 'HELLO WORLD KOSAME'];
for (const m of badMarkers) {
  check('public/test.html no marker: ' + m, !testHtmlContent.includes(m), 'test.html has ' + m + ' residue');
}

// Generated files
const genFiles = ['latest.md', 'latest-deepseek.md', 'latest-deepseek-result.json', 'latest-deepseek-action.json', 'latest-judge.json'];
for (const gf of genFiles) {
  check('generated file check: .kosame-executor/' + gf, true, 'exists=' + fs.existsSync(path.join(EXECUTOR_DIR, gf)));
}

// Forbidden markers
const sourceFiles = [
  { p: 'tools/kosame-live-cockpit-server.js', label: 'server.js' },
  { p: 'tools/kosame-runner-queue.js', label: 'runner-queue.js' },
  { p: 'public/kosame-live-cockpit.html', label: 'cockpit.html' },
];
for (const sf of sourceFiles) {
  try {
    const content = fs.readFileSync(path.join(ROOT, sf.p), 'utf8');
    check(sf.label + ' no ANESTY Board', !content.includes('ANESTY Board'));
  } catch (_) { warnings.push(sf.label + ' cannot be read'); }
}

// Judge / Release Gate checks
try {
  const jp = path.join(EXECUTOR_DIR, 'latest-judge.json');
  if (fs.existsSync(jp)) {
    const jd = JSON.parse(fs.readFileSync(jp, 'utf8'));
    check('judge status valid', ['pending_judge', 'judge_accept', 'judge_revise', 'judge_reject', 'judge_human_gate'].includes(jd.judge_status), 'judge_status=' + jd.judge_status);
  } else {
    warnings.push('no latest-judge.json — judge status unknown');
    if (status === 'ready') status = 'caution';
  }
} catch (_) { warnings.push('latest-judge.json is malformed'); }

// Next actions
if (status === 'ready') { nextActions.push('npm run verify; commit/push after human gate'); }
if (warnings.length) { nextActions.push('resolve ' + warnings.length + ' warnings'); }
nextActions.push('npm run smoke:v113-3-122:http to validate HTTP E2E');
nextActions.push('check release-gate before push');

// Output
console.log('KOSAME_OPERATIONAL_VALIDATION_BEGIN');
console.log('status: ' + status);
console.log('checks:');
checks.forEach(function(c) { console.log('- ' + c); });
if (warnings.length) {
  console.log('warnings:');
  warnings.forEach(function(w) { console.log('- ' + w); });
}
console.log('next_actions:');
nextActions.forEach(function(a) { console.log('- ' + a); });
console.log('KOSAME_OPERATIONAL_VALIDATION_END');

process.exit(status === 'ready' ? 0 : 1);
