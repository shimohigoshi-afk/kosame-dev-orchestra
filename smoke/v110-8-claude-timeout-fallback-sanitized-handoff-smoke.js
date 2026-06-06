#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.8.0
 * - Claude timeout → Grok/GPT auto-fallback
 * - DeepSeek/Kimi sanitized handoff pipeline
 * - Sensitive data (API key / customer / insurance) auto-mask
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');

function pass(msg) { console.log(`  PASS: ${msg}`); }

console.log('=== v110.8 claude-timeout-fallback / sanitized-handoff / auto-masker smoke ===');

// ── version ───────────────────────────────────────────────────────────────────

assert.strictEqual(pkg.version, '110.8.0', `version mismatch: ${pkg.version}`);
pass('package.json version is 110.8.0');

// ── scripts exist ─────────────────────────────────────────────────────────────

[
  'smoke:claude-timeout-fallback-router',
  'smoke:sensitive-data-auto-masker',
  'smoke:deepseek-kimi-sanitized-handoff',
  'smoke:v110-8'
].forEach(s => {
  assert.ok(pkg.scripts[s], `script missing: ${s}`);
  pass(`script ${s} exists`);
});

// ── node --check ──────────────────────────────────────────────────────────────

[
  'tools/claude-timeout-fallback-router.js',
  'tools/sensitive-data-auto-masker.js',
  'tools/deepseek-kimi-sanitized-handoff.js'
].forEach(f => {
  execFileSync(process.execPath, ['--check', f], { cwd: ROOT });
  pass(`${f} passes node --check`);
});

// ── fixtures exist ────────────────────────────────────────────────────────────

[
  'fixtures/claude-timeout-fallback-router.fixture.json',
  'fixtures/sensitive-data-auto-masker.fixture.json',
  'fixtures/deepseek-kimi-sanitized-handoff.fixture.json'
].forEach(f => {
  assert.ok(fs.existsSync(path.join(ROOT, f)), `fixture missing: ${f}`);
  pass(`fixture ${f} exists`);
});

// ── claude-timeout-fallback-router ────────────────────────────────────────────

const fallbackRouter = require('../tools/claude-timeout-fallback-router');

assert.strictEqual(fallbackRouter.TOOL_META.version, '110.8.0');
pass('claude-timeout-fallback-router version');

// detectTimeout: elapsed >= threshold → timedOut=true
const d1 = fallbackRouter.detectTimeout({ provider: 'claude', elapsedMs: 35000, timeoutMs: 30000 });
assert.strictEqual(d1.timedOut, true);
assert.strictEqual(d1.detectionMethod, 'duration');
pass('detectTimeout: duration exceeds threshold');

// detectTimeout: elapsed < threshold → timedOut=false
const d2 = fallbackRouter.detectTimeout({ provider: 'claude', elapsedMs: 5000, timeoutMs: 30000 });
assert.strictEqual(d2.timedOut, false);
pass('detectTimeout: within threshold → not timed out');

// detectTimeout: ETIMEDOUT error code
const d3 = fallbackRouter.detectTimeout({ provider: 'claude', elapsedMs: 100, errorCode: 'ETIMEDOUT' });
assert.strictEqual(d3.timedOut, true);
assert.strictEqual(d3.detectionMethod, 'error_code');
pass('detectTimeout: ETIMEDOUT error code');

// buildFallbackPlan: no prior attempts → grok is next
const p1 = fallbackRouter.buildFallbackPlan({ timedOutProvider: 'claude', operation: 'code-review', attemptedFallbacks: [] });
assert.strictEqual(p1.nextFallback, 'grok');
assert.strictEqual(p1.exhausted, false);
assert.strictEqual(p1.dryRun, true);
assert.strictEqual(p1.realProductActionsExecuted, false);
assert.strictEqual(p1.dangerousActionsDenied, true);
pass('buildFallbackPlan: no prior attempts → grok');

// buildFallbackPlan: grok attempted → gpt is next
const p2 = fallbackRouter.buildFallbackPlan({ timedOutProvider: 'claude', operation: 'code-review', attemptedFallbacks: ['grok'] });
assert.strictEqual(p2.nextFallback, 'gpt');
assert.strictEqual(p2.exhausted, false);
pass('buildFallbackPlan: grok attempted → gpt');

// buildFallbackPlan: all fallbacks exhausted
const p3 = fallbackRouter.buildFallbackPlan({ timedOutProvider: 'claude', operation: 'code-review', attemptedFallbacks: ['grok', 'gpt'] });
assert.strictEqual(p3.nextFallback, null);
assert.strictEqual(p3.exhausted, true);
assert.strictEqual(p3.requiresHumanApproval, true);
pass('buildFallbackPlan: all fallbacks exhausted → escalate to human');

// buildFallbackPlan: sensitive operation always requires human approval
const p4 = fallbackRouter.buildFallbackPlan({ timedOutProvider: 'claude', operation: 'deploy to production', attemptedFallbacks: [] });
assert.strictEqual(p4.requiresHumanApproval, true);
pass('buildFallbackPlan: sensitive operation requires human approval');

// evaluateFallback: grok is valid fallback for timed-out claude
const f1 = fallbackRouter.evaluateFallback({ timedOutProvider: 'claude', proposedFallback: 'grok', operation: 'code-review' });
assert.strictEqual(f1.allowed, true);
pass('evaluateFallback: grok valid for timed-out claude');

// evaluateFallback: deepseek blocked as advisory-only
const f2 = fallbackRouter.evaluateFallback({ timedOutProvider: 'claude', proposedFallback: 'deepseek', operation: 'review' });
assert.strictEqual(f2.allowed, false);
assert.strictEqual(f2.advisoryOnly, true);
assert.strictEqual(f2.mustSanitize, true);
pass('evaluateFallback: deepseek blocked (advisory-only)');

// evaluateFallback: already attempted
const f3 = fallbackRouter.evaluateFallback({ timedOutProvider: 'claude', proposedFallback: 'grok', operation: 'review', attemptedFallbacks: ['grok'] });
assert.strictEqual(f3.allowed, false);
pass('evaluateFallback: already-attempted provider blocked');

// evaluateFallback: gemini not in chain
const f4 = fallbackRouter.evaluateFallback({ timedOutProvider: 'claude', proposedFallback: 'gemini', operation: 'review' });
assert.strictEqual(f4.allowed, false);
pass('evaluateFallback: gemini not in Claude timeout fallback chain');

// ── sensitive-data-auto-masker ────────────────────────────────────────────────

const masker = require('../tools/sensitive-data-auto-masker');

assert.strictEqual(masker.TOOL_META.version, '110.8.0');
pass('sensitive-data-auto-masker version');

// maskText: API key detected and masked
const m1 = masker.maskText('api_key=sk-abc123secret');
assert.ok(m1.detectedTypes.includes('api_key'), `api_key not detected in: ${JSON.stringify(m1)}`);
assert.ok(!m1.masked.includes('sk-abc123secret'), 'api key value should be masked');
assert.ok(m1.maskCount > 0);
pass('maskText: API key masked');

// maskText: email masked
const m2 = masker.maskText('contact user@example.com for support');
assert.ok(m2.detectedTypes.includes('email_address'));
assert.ok(!m2.masked.includes('user@example.com'));
pass('maskText: email address masked');

// maskText: insurance data masked
const m3 = masker.maskText('policy_number=INS-2024-001 claim_id=CLM-555');
assert.ok(m3.detectedTypes.includes('insurance_data'));
pass('maskText: insurance data masked');

// maskText: clean code not masked
const m4 = masker.maskText('function add(a, b) { return a + b; }');
assert.strictEqual(m4.detectedTypes.length, 0);
assert.strictEqual(m4.maskCount, 0);
pass('maskText: clean code not masked');

// maskText: phone number masked
const m5 = masker.maskText('call 090-1234-5678 for info');
assert.ok(m5.detectedTypes.includes('phone_number'));
pass('maskText: phone number masked');

// maskText: GitHub credential masked
const m6 = masker.maskText('token: ghp_abcdefghijklmnopqrstuvwxyz123456');
assert.ok(m6.detectedTypes.includes('github_credential'), `github_credential not detected in: ${JSON.stringify(m6)}`);
pass('maskText: GitHub credential masked');

// autoMask: full result structure
const ma1 = masker.autoMask({ content: 'api_key=sk-test customer_id=cust-1', targetProvider: 'deepseek' });
assert.strictEqual(ma1.tool, 'sensitive-data-auto-masker');
assert.strictEqual(ma1.dryRun, true);
assert.strictEqual(ma1.realProductActionsExecuted, false);
assert.strictEqual(ma1.dangerousActionsDenied, true);
assert.strictEqual(ma1.sensitiveDataFound, true);
assert.ok(ma1.maskCount > 0);
pass('autoMask: full result structure');

// maskObject: masks nested object values
const obj = { credentials: { key: 'api_key=sk-secret123' }, note: 'clean text' };
const mo1 = masker.maskObject(obj);
assert.ok(mo1.detectedTypes.includes('api_key'));
assert.ok(!mo1.masked.credentials.key.includes('sk-secret123'));
pass('maskObject: nested object masked');

// ── deepseek-kimi-sanitized-handoff ───────────────────────────────────────────

const handoff = require('../tools/deepseek-kimi-sanitized-handoff');

assert.strictEqual(handoff.TOOL_META.version, '110.8.0');
pass('deepseek-kimi-sanitized-handoff version');

// Deepseek with API key content → auto-masked, handoff allowed (advisory)
const h1 = handoff.buildHandoffPacket({
  targetProvider: 'deepseek',
  content: 'api_key=sk-abc123 customer_id=cust-456',
  contentTypes: ['anonymized_code_snippet'],
  taskDescription: 'Review this error',
  dryRun: true
});
assert.strictEqual(h1.allowed, true);
assert.strictEqual(h1.sanitized, true);
assert.strictEqual(h1.finalDecisionAllowed, false);
assert.strictEqual(h1.advisoryOnly, true);
assert.strictEqual(h1.dryRun, true);
assert.strictEqual(h1.realProductActionsExecuted, false);
assert.strictEqual(h1.dangerousActionsDenied, true);
assert.ok(h1.maskCount > 0);
assert.ok(!h1.maskedContent.includes('sk-abc123'), 'API key should be masked in handoff content');
pass('buildHandoffPacket: deepseek with API key → auto-masked, advisory-only');

// Kimi with blocked content type → denied
const h2 = handoff.buildHandoffPacket({
  targetProvider: 'kimi',
  contentTypes: ['deploy_credential'],
  dryRun: true
});
assert.strictEqual(h2.allowed, false);
assert.ok(h2.reason.includes('deploy_credential'));
pass('buildHandoffPacket: blocked content type → denied');

// Unsupported provider → denied
const h3 = handoff.buildHandoffPacket({
  targetProvider: 'claude',
  contentTypes: [],
  dryRun: true
});
assert.strictEqual(h3.allowed, false);
pass('buildHandoffPacket: unsupported provider → denied');

// Kimi clean content → allowed
const h4 = handoff.buildHandoffPacket({
  targetProvider: 'kimi',
  content: 'function foo() { return 42; }',
  contentTypes: ['anonymized_code_snippet'],
  dryRun: true
});
assert.strictEqual(h4.allowed, true);
assert.strictEqual(h4.advisoryOnly, true);
pass('buildHandoffPacket: kimi with clean content → allowed advisory-only');

// taskDescription with email gets masked
const h5 = handoff.buildHandoffPacket({
  targetProvider: 'deepseek',
  content: 'clean code',
  contentTypes: [],
  taskDescription: 'Contact dev@kosame.ai for this issue',
  dryRun: true
});
assert.ok(h5.maskCount > 0, 'email in taskDescription should be masked');
assert.ok(!h5.maskedTaskDescription.includes('dev@kosame.ai'));
pass('buildHandoffPacket: email in taskDescription auto-masked');

console.log('\nPASS: v110.8 all smoke tests');
