'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-landing-page-requirement-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-landing-page-requirement-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 62, `pkg version must be >= 62.0.0, got ${pkg.version}`);
console.log('  PASS: package version 62.0.0 or later');

assert.ok(pkg.scripts['smoke:landing-page-requirement'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:landing-page-requirement'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:landing-page-requirement exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-landing-page-requirement-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '62.0.0', 'tool version must be 62.0.0');
console.log('  PASS: tool meta version 62.0.0');

const result = tool.buildLandingPageRequirement({
  productIdea:  'AI議事録自動化ツール',
  targetUser:   '中小企業の営業担当者',
  headline:     '会議の議事録を30秒で自動生成。営業担当者の30分を取り戻す。',
  subHeadline:  '録音するだけで要点・タスク・次回アクションを自動整理。'
});

assert.strictEqual(result.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(result.headline    && result.headline.length    > 5, 'headline must exist');
assert.ok(result.subHeadline && result.subHeadline.length > 5, 'subHeadline must exist');
console.log('  PASS: headline/subHeadline exist');

assert.ok(result.oneSecondMessage, 'oneSecondMessage must exist');
console.log('  PASS: oneSecondMessage exists');

assert.ok(result.firstViewRequirement && typeof result.firstViewRequirement === 'object', 'firstViewRequirement must exist');
assert.ok(result.firstViewRequirement.hero_text, 'firstViewRequirement.hero_text must exist');
assert.ok(result.firstViewRequirement.cta_button, 'firstViewRequirement.cta_button must exist');
console.log('  PASS: firstViewRequirement exists');

assert.ok(result.waitlistCTA && result.waitlistCTA.text, 'waitlistCTA must exist');
console.log('  PASS: waitlistCTA exists');

assert.ok(Array.isArray(result.socialShareHook) && result.socialShareHook.length > 0, 'socialShareHook must exist');
console.log('  PASS: socialShareHook exists');

// No real LP publish
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('real LP publish')),  'must deny real LP publish');
assert.ok(denied.some(d => d.includes('real ad launch')),   'must deny real ad launch');
assert.ok(denied.some(d => d.includes('real SNS post')),    'must deny real SNS post');
assert.ok(denied.some(d => d.includes('deploy')),           'must deny deploy');
console.log('  PASS: no real LP publish (dangerousActionsDenied includes real LP publish)');

// riskNotes contains no-real-publish note
assert.ok(Array.isArray(result.riskNotes) && result.riskNotes.some(n => n.includes('dryRun') || n.includes('実LP公開はしない')), 'riskNotes must mention no real publish');
console.log('  PASS: riskNotes mention no real LP publish');

// lpPrinciples exported
assert.ok(Array.isArray(tool.LP_PRINCIPLES) && tool.LP_PRINCIPLES.length >= 5, 'LP_PRINCIPLES must be exported');
console.log('  PASS: LP_PRINCIPLES exported');

// faqItems
assert.ok(Array.isArray(result.faqItems) && result.faqItems.length >= 3, 'faqItems must have 3+ items');
console.log('  PASS: faqItems exist');

console.log('=== dev-agent-landing-page-requirement-pack smoke PASSED ===');
