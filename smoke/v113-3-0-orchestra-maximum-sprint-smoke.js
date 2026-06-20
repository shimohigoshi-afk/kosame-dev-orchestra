#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const scripts = [
  'smoke/v113-3-0-safety-detector-smoke.js',
  'smoke/v113-3-0-prompt-classifier-smoke.js',
  'smoke/v113-3-0-executor-policy-smoke.js',
  'smoke/v113-3-0-auto-responder-smoke.js',
  'smoke/v113-3-0-direct-spawn-audit-smoke.js',
  'smoke/v113-3-0-startup-audit-smoke.js',
  'smoke/v113-3-0-operations-board-smoke.js',
  'smoke/v113-3-0-recovery-result-smoke.js',
  'smoke/v113-3-0-handoff-queue-stress-smoke.js',
];

console.log('=== v113.3.0 orchestra maximum sprint smoke ===');
for (const script of scripts) {
  console.log(`> node ${script}`);
  execFileSync('node', [path.join(ROOT, script)], { stdio: 'inherit' });
}
console.log('✅ v113.3.0 orchestra maximum sprint smoke PASSED');
