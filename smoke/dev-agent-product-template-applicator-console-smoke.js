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
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/product-template-applicator-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-template-applicator-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '18.0.0') >= 0, `pkg version must be >= 18.0.0, got ${pkg.version}`);
console.log('  PASS: package version 18.0.0 or later');

assert.ok(pkg.scripts['smoke:product-template-applicator-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-template-applicator-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v18.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-template-applicator-console.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '18.0.0', 'tool version must be 18.0.0');
console.log('  PASS: tool meta version 18.0.0');

for (const p of tool.SUPPORTED_PRODUCTS) {
  const packet = tool.buildTemplateApplicationPacket({ productType: p, taskGoal: `test for ${p}` });
  assert.strictEqual(packet.dryRun, true, `dryRun must be true for ${p}`);
  assert.strictEqual(packet.humanApprovalRequired, true, `humanApprovalRequired must be true for ${p}`);
  assert.ok(packet.templateId, `templateId must be present for ${p}`);
  assert.strictEqual(packet.isKnownProduct, true, `isKnownProduct must be true for ${p}`);
  assert.ok(Array.isArray(packet.recommendedFiles) && packet.recommendedFiles.length > 0, `recommendedFiles must be non-empty for ${p}`);
  assert.ok(Array.isArray(packet.requiredSmoke), `requiredSmoke must be array for ${p}`);
  assert.ok(typeof packet.runbookDraft === 'string', `runbookDraft must be string for ${p}`);
  assert.ok(Array.isArray(packet.launchChecklist), `launchChecklist must be array for ${p}`);
  assert.ok(packet.ownerRoles, `ownerRoles must be present for ${p}`);
  assert.ok(packet.ownerRoles.pm, `ownerRoles.pm must be present for ${p}`);
  assert.ok(packet.ownerRoles.finalApproval, `ownerRoles.finalApproval must be present for ${p}`);
  assert.strictEqual(packet.noRealFileCreation, true, `noRealFileCreation must be true for ${p}`);
}
console.log('  PASS: all 5 product types produce valid template application packet');

// launch checklist must include じゅんやさん
const salesPacket = tool.buildTemplateApplicationPacket({ productType: 'sales_dx', taskGoal: 'test' });
assert.ok(salesPacket.launchChecklist.some(c => c.includes('じゅんやさん')), 'launchChecklist must include じゅんやさん');
console.log('  PASS: launchChecklist includes じゅんやさん approval');

// unknown product returns error packet
const unknown = tool.buildTemplateApplicationPacket({ productType: 'unknown_xyz' });
assert.strictEqual(unknown.isKnownProduct, false, 'isKnownProduct must be false for unknown');
assert.ok(unknown.error, 'error must be present for unknown product');
console.log('  PASS: unknown product returns error packet');

assert.ok(tool.SUPPORTED_PRODUCTS.includes('sales_dx'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('anesty_board'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('backoffice_agent'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('email_reply_bot'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('cloud_run_pm_agent'));
console.log('  PASS: all 5 product types in SUPPORTED_PRODUCTS');

console.log('PASS: product-template-applicator-console-pack');
