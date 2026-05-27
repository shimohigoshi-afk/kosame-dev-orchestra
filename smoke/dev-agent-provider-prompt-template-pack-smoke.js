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
const tool = require('../tools/provider-prompt-template-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== provider-prompt-template-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.4.0') >= 0);
console.log('  PASS: package version 5.4.0 or later');

assert.ok(pkg.scripts['smoke:provider-prompt-template-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.4.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/provider-prompt-template.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.4.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ provider: 'gemini', taskDescription: 'draft release note', dataLevel: 'A' });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const tpl = tool.getTemplate('claude');
assert.ok(tpl);
assert.ok(tpl.prefix.length > 0);
console.log('  PASS: claude template exists');

const rendered = tool.renderTemplate('gemini', 'draft a report', 'A');
assert.strictEqual(rendered.ok, true);
assert.ok(rendered.prompt.includes('draft a report'));
console.log('  PASS: gemini template rendered');

const blocked = tool.renderTemplate('gemini', 'review data', 'C');
assert.strictEqual(blocked.ok, false);
console.log('  PASS: level C blocked for gemini');

const unknown = tool.getTemplate('unknown-provider');
assert.strictEqual(unknown, null);
console.log('  PASS: unknown provider returns null');

console.log('PASS: provider-prompt-template-pack');
