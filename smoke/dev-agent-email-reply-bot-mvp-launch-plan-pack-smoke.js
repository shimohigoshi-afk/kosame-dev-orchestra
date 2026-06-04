'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-email-reply-bot-mvp-launch-plan-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-email-reply-bot-mvp-launch-plan-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 92, `pkg version must be >= 92.0.0, got ${pkg.version}`);
console.log('  PASS: package version 92.0.0 or later');

assert.ok(pkg.scripts['smoke:email-reply-bot-mvp-launch-plan'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:email-reply-bot-mvp-launch-plan'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:email-reply-bot-mvp-launch-plan exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-email-reply-bot-mvp-launch-plan-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '92.0.0');
console.log('  PASS: tool meta version 92.0.0');

const result = tool.buildEmailReplyBotMvpLaunchPlan({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.draftOnlyPolicy && typeof result.draftOnlyPolicy === 'object', 'draftOnlyPolicy must exist');
assert.strictEqual(result.draftOnlyPolicy.autoSend, false, 'draftOnlyPolicy.autoSend must be false');
console.log('  PASS: draftOnlyPolicy exists (autoSend: false)');

assert.strictEqual(result.autoSendBlocked, true, 'autoSendBlocked must be true');
console.log('  PASS: autoSendBlocked true');

assert.ok(result.gmailHandlingPolicy && typeof result.gmailHandlingPolicy === 'object', 'gmailHandlingPolicy must exist');
assert.ok(result.gmailHandlingPolicy.draftOnly === true || result.gmailHandlingPolicy.apiAccess, 'gmailHandlingPolicy must have draftOnly or apiAccess');
console.log('  PASS: gmailHandlingPolicy exists');

assert.ok(result.pdfSeparationPolicy && result.pdfSeparationPolicy.enabled === true, 'pdfSeparationPolicy must exist and be enabled');
console.log('  PASS: pdfSeparationPolicy exists');

const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real Gmail send') || d.includes('real email send')), 'must deny real Gmail/email send');
assert.ok(denied.some(d => d.includes('customer data')), 'must deny customer data');
assert.ok(denied.some(d => d.includes('deploy')),        'must deny deploy');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-email-reply-bot-mvp-launch-plan-pack smoke PASSED ===');
