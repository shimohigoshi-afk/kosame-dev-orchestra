'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tool = require('../tools/provider-health-auto-reporter-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== provider-health-auto-reporter-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.6.0') >= 0);
console.log('  PASS: package version 5.6.0 or later');

assert.ok(pkg.scripts['smoke:provider-health-auto-reporter-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.6.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/provider-health-auto-reporter.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.6.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({});
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const healthy = tool.evaluateHealth({ successRate: 0.95, latencyMs: 100 });
assert.strictEqual(healthy.status, 'healthy');
console.log('  PASS: healthy status');

const warning = tool.evaluateHealth({ successRate: 0.7, latencyMs: 100 });
assert.strictEqual(warning.status, 'warning');
console.log('  PASS: warning status on low success rate');

const critical = tool.evaluateHealth({ successRate: 0.3, latencyMs: 100 });
assert.strictEqual(critical.status, 'critical');
console.log('  PASS: critical status');

const report = tool.generateReport({ gemini: { successRate: 0.3 } });
assert.ok(report.criticalProviders.includes('gemini'));
console.log('  PASS: critical provider detected in report');

console.log('PASS: provider-health-auto-reporter-pack');
