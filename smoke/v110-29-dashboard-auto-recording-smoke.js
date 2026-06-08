'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'tools/kosame-dashboard-server.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

console.log('=== v110.29 dashboard auto recording smoke ===');

function pass(msg) {
  console.log('  PASS:', msg);
}

assert.strictEqual(pkg.version, '110.29.0');
pass('package version is 110.29.0');

assert.ok(dashboard.includes('function loadLearningLogEntries()'));
pass('loadLearningLogEntries exists');

assert.ok(dashboard.includes('function buildAutoRecordingState()'));
pass('buildAutoRecordingState exists');

assert.ok(dashboard.includes('autoRecording: buildAutoRecordingState()'));
pass('state includes autoRecording');

assert.ok(dashboard.includes('Auto Recording'));
pass('HTML includes Auto Recording card');

assert.ok(dashboard.includes("function renderAutoRecording(autoRecording)"));
pass('renderAutoRecording exists');

assert.ok(dashboard.includes('renderAutoRecording(state.autoRecording || {})'));
pass('renderState calls renderAutoRecording');

assert.ok(dashboard.includes('learning-log.jsonl'));
pass('reads learning-log.jsonl only');

assert.ok(!dashboard.includes('credentials.json'));
pass('does not reference credentials.json');

assert.ok(!dashboard.includes('.env'));
pass('does not reference .env');

console.log('PASS: v110.29 dashboard auto recording smoke');
