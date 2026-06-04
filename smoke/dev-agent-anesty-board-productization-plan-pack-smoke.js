'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-anesty-board-productization-plan-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-anesty-board-productization-plan-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 94, `pkg version must be >= 94.0.0, got ${pkg.version}`);
console.log('  PASS: package version 94.0.0 or later');

assert.ok(pkg.scripts['smoke:anesty-board-productization-plan'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:anesty-board-productization-plan'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:anesty-board-productization-plan exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-anesty-board-productization-plan-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '94.0.0');
console.log('  PASS: tool meta version 94.0.0');

const result = tool.buildAnestyBoardProductizationPlan({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(result.productizationAngles) && result.productizationAngles.length >= 2, 'productizationAngles must exist');
console.log('  PASS: productizationAngles exists');

assert.ok(Array.isArray(result.targetUsers) && result.targetUsers.length >= 2, 'targetUsers must exist');
console.log('  PASS: targetUsers exists');

assert.ok(result.pilotOffer && result.pilotOffer.type, 'pilotOffer must exist');
console.log('  PASS: pilotOffer exists');

// Discord/Webhook/SNS real send blocked
assert.ok(result.discordOperationalRisk, 'discordOperationalRisk must exist');
const dor = result.discordOperationalRisk;
assert.ok(dor.webhookSend === 'BLOCKED' || (dor.webhookSend && dor.webhookSend.includes('BLOCK')), 'webhookSend must be BLOCKED');
assert.ok(dor.autoPost   === 'BLOCKED' || (dor.autoPost   && dor.autoPost.includes('BLOCK')),   'autoPost must be BLOCKED');
console.log('  PASS: Discord/Webhook/SNS real send blocked');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('Discord') || d.toLowerCase().includes('webhook')), 'must deny real Discord/Webhook send');
assert.ok(denied.some(d => d.includes('real SNS post') || d.includes('anesty-board repo mutation')), 'must deny real SNS post and repo mutation');
assert.ok(denied.some(d => d.includes('deploy')), 'must deny deploy');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-anesty-board-productization-plan-pack smoke PASSED ===');
