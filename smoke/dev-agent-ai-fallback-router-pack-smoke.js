'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-ai-fallback-router-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-ai-fallback-router-pack smoke ===');

// version
function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}
assert.ok(semverGte(pkg.version, '110.1.0'), 'package version must be 110.1.0 or later');
console.log('  PASS: package version');

// script exists
assert.ok(pkg.scripts['smoke:ai-fallback-router-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-ai-fallback-router-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// TOOL_META
assert.strictEqual(tool.TOOL_META.version, '110.1.0');
console.log('  PASS: tool meta version');

// buildRoute — no failure
const route = tool.buildRoute({});
assert.strictEqual(route.dryRun, true);
assert.strictEqual(route.realProductActionsExecuted, false);
assert.strictEqual(route.dangerousActionsDenied, true);
assert.strictEqual(route.humanApprovalRequired, true);
assert.deepStrictEqual(route.fallbackRoutes, []);
assert.ok(Array.isArray(route.blockedFallbackProviders));
assert.ok(route.blockedFallbackProviders.includes('deepseek'));
assert.ok(route.blockedFallbackProviders.includes('kimi'));
console.log('  PASS: buildRoute with no failure');

// buildRoute — gemini fails → grok/gpt
const geminiRoute = tool.buildRoute({ failedProvider: 'gemini', reason: 'timeout' });
assert.deepStrictEqual(geminiRoute.fallbackRoutes, ['grok', 'gpt']);
assert.strictEqual(geminiRoute.providerFailureReasons.gemini, 'timeout');
console.log('  PASS: gemini failure routes to grok/gpt');

// buildRoute — claude fails → gpt/grok/gemini
const claudeRoute = tool.buildRoute({ failedProvider: 'claude' });
assert.deepStrictEqual(claudeRoute.fallbackRoutes, ['gpt', 'grok', 'gemini']);
console.log('  PASS: claude failure routes to gpt/grok/gemini');

// finalDecisionPolicy blocks deepseek/kimi
assert.strictEqual(route.finalDecisionPolicy.deepseekAllowedFinalDecision, false);
assert.strictEqual(route.finalDecisionPolicy.kimiAllowedFinalDecision, false);
assert.strictEqual(route.finalDecisionPolicy.humanMustApproveIrreversible, true);
console.log('  PASS: finalDecisionPolicy blocks deepseek/kimi');

// evaluateFailover — grok is valid fallback for gemini
const fo1 = tool.evaluateFailover({ failedProvider: 'gemini', requestedFallback: 'grok', operation: 'bulk-review' });
assert.strictEqual(fo1.allowed, true);
console.log('  PASS: grok is valid fallback for gemini');

// evaluateFailover — deepseek blocked as final decision provider
const fo2 = tool.evaluateFailover({ failedProvider: 'claude', requestedFallback: 'deepseek', operation: 'general' });
assert.strictEqual(fo2.allowed, false);
assert.strictEqual(fo2.humanApprovalRequired, true);
assert.strictEqual(fo2.advisoryOnly, true);
console.log('  PASS: deepseek blocked as final-decision provider');

// evaluateFailover — deepseek + sensitive operation = fully blocked
const fo3 = tool.evaluateFailover({ failedProvider: 'claude', requestedFallback: 'deepseek', operation: 'deploy' });
assert.strictEqual(fo3.allowed, false);
assert.strictEqual(fo3.advisoryOnly, false);
console.log('  PASS: deepseek + deploy operation fully blocked');

// evaluateFailover — unknown fallback not in route
const fo4 = tool.evaluateFailover({ failedProvider: 'gemini', requestedFallback: 'claude', operation: 'review' });
assert.strictEqual(fo4.allowed, false);
console.log('  PASS: claude not in gemini fallback route');

console.log('PASS: dev-agent-ai-fallback-router-pack');
