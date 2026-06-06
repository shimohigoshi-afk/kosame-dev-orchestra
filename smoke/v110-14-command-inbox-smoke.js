'use strict';

const assert = require('assert');
const pkg = require('../package.json');
const inbox = require('../tools/kosame-command-inbox');

let passed = 0;
function pass(message) {
  passed += 1;
  console.log(`  PASS: ${message}`);
}

console.log('=== v110.14 command inbox smoke ===');

assert.ok(pkg.version === '110.14.0' || pkg.version === '110.15.0' || pkg.version === '110.16.0');
pass('package version is valid');

assert.ok(pkg.scripts.inbox);
pass('script inbox exists');

assert.ok(pkg.scripts['smoke:v110-14-command-inbox']);
pass('script smoke:v110-14-command-inbox exists');

assert.ok(inbox.TOOL_META.version === '110.14.0' || inbox.TOOL_META.version === '110.15.0' || inbox.TOOL_META.version === '110.16.0');
pass('tool meta version is valid');

const anesty = inbox.buildInboxPlan({
  input: 'ANESTY Board v87.0.15を進めて',
});
assert.strictEqual(anesty.repo.id, 'anesty-board');
pass('ANESTY input selects anesty-board');

const kosame = inbox.buildInboxPlan({
  input: 'KOSAME v110.15 routerを修正して',
});
assert.strictEqual(kosame.repo.id, 'kosame-dev-orchestra');
pass('KOSAME input selects kosame-dev-orchestra');

const fallback = inbox.buildInboxPlan({
  input: 'Claude unavailable。Claudeには振らない。Geminiで実装案、Grokで抜け漏れレビュー',
});
assert.ok(fallback.providers.some((p) => p.provider === 'gemini'));
assert.ok(fallback.providers.some((p) => p.provider === 'grok'));
assert.ok(!fallback.providers.some((p) => p.provider === 'claude_code'));
pass('Claude unavailable excludes claude_code and includes Gemini/Grok');

const normal = inbox.buildInboxPlan({
  input: 'ANESTY Board v87.0.15を実装して',
});
// Updated for v110.15: Claude is disabled by default
assert.ok(!normal.providers.some((p) => p.provider === 'claude_code'));
pass('normal implementation excludes claude_code in v110.15');

const masked = inbox.buildInboxPlan({
  input: 'OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz ANESTYを進めて',
});
assert.ok(masked.input.includes('[MASKED:SECRET]') || masked.input.includes('[MASKED:OPENAI_KEY]'));
pass('secret-like input is masked');

assert.strictEqual(masked.safety.dryRun, true);
assert.strictEqual(masked.safety.realProductActionsExecuted, false);
assert.strictEqual(masked.safety.dangerousActionsDenied, true);
pass('safety flags are preserved');

assert.ok(typeof anesty.nextCommand === 'string' && anesty.nextCommand.includes('npm run route'));
pass('nextCommand is generated');

const rendered = inbox.renderPlan(fallback);
assert.ok(rendered.includes('KOSAME Command Inbox'));
assert.ok(rendered.includes('PROVIDERS'));
assert.ok(rendered.includes('NEXT'));
pass('renderPlan includes required sections');

console.log(`PASS: v110.14 command inbox smoke (${passed} checks)`);
