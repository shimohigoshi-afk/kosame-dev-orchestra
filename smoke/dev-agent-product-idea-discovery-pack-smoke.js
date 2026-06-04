'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-product-idea-discovery-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-product-idea-discovery-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 61, `pkg version must be >= 61.0.0, got ${pkg.version}`);
console.log('  PASS: package version 61.0.0 or later');

assert.ok(pkg.scripts['smoke:product-idea-discovery'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-idea-discovery'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:product-idea-discovery exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-product-idea-discovery-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '61.0.0', 'tool version must be 61.0.0');
console.log('  PASS: tool meta version 61.0.0');

const result = tool.buildIdeaDiscovery({
  productIdea: 'AI議事録自動化ツール',
  targetUser:  '中小企業の営業担当者',
  painPoint:   '会議後の議事録作成に毎回30分かかる',
  urgency:     'high'
});

assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.productIdea && result.productIdea !== '(未設定)', 'productIdea must exist');
console.log('  PASS: productIdea exists');

assert.ok(result.targetUser && result.targetUser !== '(未設定)', 'targetUser must exist');
assert.ok(result.painPoint  && result.painPoint  !== '(未設定)', 'painPoint must exist');
console.log('  PASS: targetUser and painPoint exist');

assert.ok(typeof result.oneSecondUnderstandingScore === 'number', 'oneSecondUnderstandingScore must exist');
assert.ok(result.oneSecondUnderstandingScore >= 0 && result.oneSecondUnderstandingScore <= 10, 'score must be 0-10');
console.log('  PASS: oneSecondUnderstandingScore exists (0-10)');

assert.ok(result.competitorSignal && typeof result.competitorSignal === 'object', 'competitorSignal must exist');
console.log('  PASS: competitorSignal exists');

assert.ok(Array.isArray(result.differentiationAngles) && result.differentiationAngles.length > 0, 'differentiationAngles must exist');
console.log('  PASS: differentiationAngles exists');

assert.ok(result.nextValidationStep, 'nextValidationStep must exist');
console.log('  PASS: nextValidationStep exists');

// dangerousActionsDenied — no real actions
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real ad launch')),   'must deny real ad launch');
assert.ok(denied.some(d => d.includes('real LP publish')),  'must deny real LP publish');
assert.ok(denied.some(d => d.includes('real SNS post')),    'must deny real SNS post');
assert.ok(denied.some(d => d.includes('deploy')),           'must deny deploy');
assert.ok(denied.some(d => d.includes('secret read')),      'must deny secret read');
console.log('  PASS: dangerousActionsDenied correct (includes real ad/LP/SNS/deploy/secret)');

// ideaRisks and evaluationDimensions
assert.ok(Array.isArray(result.ideaRisks) && result.ideaRisks.length > 0, 'ideaRisks must exist');
assert.ok(Array.isArray(result.evaluationDimensions) && result.evaluationDimensions.length >= 5, 'evaluationDimensions must exist');
assert.ok(Array.isArray(tool.EVALUATION_DIMENSIONS) && tool.EVALUATION_DIMENSIONS.length >= 5, 'EVALUATION_DIMENSIONS must be exported');
console.log('  PASS: ideaRisks / evaluationDimensions exist');

// default (未設定)
const defaultResult = tool.buildIdeaDiscovery({});
assert.ok(defaultResult.productIdea === '(未設定)', 'default productIdea must be placeholder');
assert.ok(defaultResult.dryRun === true, 'default dryRun must be true');
console.log('  PASS: default buildIdeaDiscovery() works without args');

console.log('=== dev-agent-product-idea-discovery-pack smoke PASSED ===');
