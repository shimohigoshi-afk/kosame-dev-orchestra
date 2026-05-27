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
const tool = require('../tools/multi-provider-backup-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== multi-provider-backup-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.5.0') >= 0);
console.log('  PASS: package version 5.5.0 or later');

assert.ok(pkg.scripts['smoke:multi-provider-backup-console-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.5.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/multi-provider-backup-console.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.5.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ primary: 'gemini', unavailable: [], dataLevel: 'A' });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const backup = tool.selectBackup('gemini', [], 'A');
assert.ok(['grok', 'kimi', 'kosame'].includes(backup.provider));
console.log('  PASS: gemini backup selected');

const levelC = tool.selectBackup('gemini', [], 'C');
assert.strictEqual(levelC.provider, 'kosame');
console.log('  PASS: level C routed to kosame');

const exhausted = tool.selectBackup('gemini', ['grok', 'kimi'], 'A');
assert.strictEqual(exhausted.provider, 'kosame');
console.log('  PASS: all backups exhausted → kosame');

const console_ = tool.getBackupConsole('claude');
assert.ok(Array.isArray(console_.backups));
console.log('  PASS: backup console for claude');

console.log('PASS: multi-provider-backup-console-pack');
