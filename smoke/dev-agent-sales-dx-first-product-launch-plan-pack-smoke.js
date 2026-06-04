'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-sales-dx-first-product-launch-plan-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-sales-dx-first-product-launch-plan-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 91, `pkg version must be >= 91.0.0, got ${pkg.version}`);
console.log('  PASS: package version 91.0.0 or later');

assert.ok(pkg.scripts['smoke:sales-dx-first-product-launch-plan'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:sales-dx-first-product-launch-plan'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:sales-dx-first-product-launch-plan exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-sales-dx-first-product-launch-plan-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '91.0.0');
console.log('  PASS: tool meta version 91.0.0');

const result = tool.buildSalesDxFirstProductLaunchPlan({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.firstUseCase && result.firstUseCase.title, 'firstUseCase must exist');
assert.strictEqual(result.firstUseCase.realSend, false, 'firstUseCase.realSend must be false');
console.log('  PASS: firstUseCase exists (realSend: false)');

assert.ok(Array.isArray(result.guardianRequirements) && result.guardianRequirements.length >= 3, 'guardianRequirements must exist');
const grStr = result.guardianRequirements.join(' ').toLowerCase();
assert.ok(grStr.includes('customer') || grStr.includes('insurance') || grStr.includes('顧客') || grStr.includes('保険'), 'guardianRequirements must include customer/insurance');
assert.ok(grStr.includes('gmail') || grStr.includes('pdf') || grStr.includes('告知') || grStr.includes('secret') || grStr.includes('data'), 'guardianRequirements must include Gmail/PDF or data gate');
console.log('  PASS: guardianRequirements include customer/insurance/Gmail/PDF');

assert.ok(result.dataBoundary && typeof result.dataBoundary === 'object', 'dataBoundary must exist');
console.log('  PASS: dataBoundary exists');

assert.ok(Array.isArray(result.launchBlockers) && result.launchBlockers.length > 0, 'launchBlockers must exist');
console.log('  PASS: launchBlockers exist');

// no real data/send/deploy
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('customer data')),   'must deny customer data read');
assert.ok(denied.some(d => d.includes('real Gmail send') || d.includes('real send')), 'must deny real send');
assert.ok(denied.some(d => d.includes('deploy')),           'must deny deploy');
assert.ok(denied.some(d => d.includes('real contract')),    'must deny real contract');
console.log('  PASS: no real data/read/send/deploy (dangerousActionsDenied correct)');

console.log('=== dev-agent-sales-dx-first-product-launch-plan-pack smoke PASSED ===');
