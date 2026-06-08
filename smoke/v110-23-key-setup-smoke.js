#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.23 Cloud Shell Key Auto-Loader + Difficulty Model Router
 *
 * Verifies:
 *   - kosame-key-setup: TOOL_META, KEY_DEFS (6 keys), BASHRC_BLOCK, buildEnvFileContent
 *   - DeepSeek and Kimi are marked advisory=sanitized-advisory
 *   - sensitive-data-auto-masker: DeepSeek/Kimi specific patterns
 *   - difficulty-model-router: DIFFICULTY_ROUTING (light/medium/high), route()
 *   - npm scripts: setup:keys, route:task
 */

const assert = require('node:assert');
const pkg    = require('../package.json');
const setup  = require('../tools/kosame-key-setup');
const masker = require('../tools/sensitive-data-auto-masker');
const router = require('../tools/kosame-difficulty-model-router');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.23 key-setup + model-router smoke ===');

// package version
assert.ok(pkg.version >= '110.23.0');
pass('package version >= 110.23.0');

// ── Key Setup ────────────────────────────────────────────────────────────────

assert.strictEqual(setup.TOOL_META.version, '110.23.0');
pass('kosame-key-setup TOOL_META.version is 110.23.0');

assert.ok(Array.isArray(setup.KEY_DEFS), 'KEY_DEFS must be array');
assert.strictEqual(setup.KEY_DEFS.length, 6, 'KEY_DEFS must have 6 entries');
pass('KEY_DEFS has 6 entries');

const keyNames = setup.KEY_DEFS.map(k => k.name);
for (const expected of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROK_API_KEY', 'DISCORD_BOT_TOKEN', 'DEEPSEEK_API_KEY', 'KIMI_API_KEY']) {
  assert.ok(keyNames.includes(expected), `KEY_DEFS must include ${expected}`);
  pass(`KEY_DEFS includes ${expected}`);
}

const deepseekDef = setup.KEY_DEFS.find(k => k.name === 'DEEPSEEK_API_KEY');
const kimiDef     = setup.KEY_DEFS.find(k => k.name === 'KIMI_API_KEY');
assert.strictEqual(deepseekDef.advisory, 'sanitized-advisory', 'DEEPSEEK must be sanitized-advisory');
assert.strictEqual(kimiDef.advisory,     'sanitized-advisory', 'KIMI must be sanitized-advisory');
pass('DEEPSEEK_API_KEY and KIMI_API_KEY have advisory=sanitized-advisory');

// BASHRC_BLOCK exists and contains auto-loader sentinel
assert.ok(setup.BASHRC_BLOCK.includes('kosame key auto-loader'), 'BASHRC_BLOCK must contain sentinel comment');
pass('BASHRC_BLOCK contains kosame key auto-loader sentinel');

// buildEnvFileContent
const envContent = setup.buildEnvFileContent({ GEMINI_API_KEY: 'test-key', KIMI_API_KEY: 'kimi-key' });
assert.ok(typeof envContent === 'string', 'buildEnvFileContent must return string');
assert.ok(envContent.includes('GEMINI_API_KEY'), 'env content must include GEMINI_API_KEY');
pass('buildEnvFileContent returns valid .env content');

// isBashrcPatched / patchBashrc
const notPatched = 'export FOO=bar\n';
assert.strictEqual(setup.isBashrcPatched(notPatched), false, 'isBashrcPatched: unpatched returns false');
pass('isBashrcPatched: unpatched content returns false');

const patched = setup.patchBashrc(notPatched);
assert.ok(patched.includes('kosame key auto-loader'), 'patchBashrc must add loader block');
assert.strictEqual(setup.isBashrcPatched(patched), true, 'isBashrcPatched: patched returns true');
pass('patchBashrc adds loader block; isBashrcPatched detects it');

// ── Sensitive Data Masker ─────────────────────────────────────────────────────

assert.strictEqual(masker.TOOL_META.version, '110.23.0');
pass('sensitive-data-auto-masker TOOL_META.version is 110.23.0');

const maskResult = masker.maskText('DEEPSEEK_API_KEY=sk-deepseek-abc123 and KIMI_API_KEY=kimi-secret-xyz');
assert.ok(maskResult.detectedTypes.includes('deepseek_key'), 'must detect deepseek_key');
assert.ok(maskResult.detectedTypes.includes('kimi_key'), 'must detect kimi_key');
assert.ok(maskResult.masked.includes('[MASKED:DEEPSEEK_KEY]'), 'must mask DEEPSEEK key');
assert.ok(maskResult.masked.includes('[MASKED:KIMI_KEY]'), 'must mask KIMI key');
pass('masker detects and masks DEEPSEEK_API_KEY and KIMI_API_KEY');

const autoResult = masker.autoMask({ content: 'DEEPSEEK_API_KEY=sk-test123', dryRun: true });
assert.strictEqual(autoResult.sanitizedAdvisoryDetected, true, 'sanitizedAdvisoryDetected must be true');
pass('autoMask sets sanitizedAdvisoryDetected=true for DeepSeek key');

// ── Difficulty Model Router ───────────────────────────────────────────────────

assert.strictEqual(router.TOOL_META.version, '110.24.0');
pass('kosame-difficulty-model-router TOOL_META.version is 110.24.0');

assert.ok(typeof router.DIFFICULTY_ROUTING === 'object', 'DIFFICULTY_ROUTING must exist');
assert.ok(router.DIFFICULTY_ROUTING.light, 'DIFFICULTY_ROUTING.light must exist');
assert.ok(router.DIFFICULTY_ROUTING.medium, 'DIFFICULTY_ROUTING.medium must exist');
assert.ok(router.DIFFICULTY_ROUTING.high, 'DIFFICULTY_ROUTING.high must exist');
pass('DIFFICULTY_ROUTING has light/medium/high tiers');

const routeResult = router.route('light', { dryRun: true });
assert.ok(routeResult.difficulty, 'route() must return difficulty');
assert.ok(Array.isArray(routeResult.candidates), 'route() must return candidates array');
pass('route("light") returns difficulty and candidates');

// npm scripts
assert.ok(pkg.scripts['setup:keys'], 'npm run setup:keys must exist');
pass('npm run setup:keys script exists');
assert.ok(pkg.scripts['route:task'], 'npm run route:task must exist');
pass('npm run route:task script exists');

console.log(`\n✅ v110.23 key-setup smoke PASSED (${passed} checks)`);
