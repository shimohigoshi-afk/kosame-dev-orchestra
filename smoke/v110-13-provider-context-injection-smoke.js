#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110-13 Provider Context Injection
 *
 * Verifies that enrichContext includes all required fields and that
 * routing decisions enforce Claude exclusion and Grok bucket creation.
 */

const assert = require('node:assert');
const { enrichContext, detectInsufficientContext } = require('../tools/multi-agent-task-router');
const { heuristicRoute } = require('../tools/gpt-task-arbiter');

let passed = 0;
function pass(msg) {
  passed += 1;
  console.log(`  PASS: ${msg}`);
}

console.log('=== v110-13 provider context injection smoke ===');

// 1. enrichContext: originalInput preserved
const originalInput = 'ANESTY Board v87.0.14の制作指示書→Claude Code実装チケット変換';
const raw = enrichContext('制作指示書をチケットに変換して', originalInput);
const ctx = JSON.parse(raw);

assert.ok(ctx.originalInput, 'originalInput must be present');
assert.ok(ctx.originalInput.includes('ANESTY Board'), 'originalInput must contain original context');
pass('enrichContext: originalInput present and preserved');

// 2. enrichContext: projectContext with productName and targetVersion
assert.ok(ctx.projectContext, 'projectContext must be present');
assert.ok(ctx.projectContext.productName, 'productName must be in projectContext');
assert.ok(ctx.projectContext.targetVersion, 'targetVersion must be in projectContext');
pass('enrichContext: projectContext.productName and targetVersion present');

// 3. enrichContext: forbiddenActions
assert.ok(Array.isArray(ctx.forbiddenActions) && ctx.forbiddenActions.length > 0, 'forbiddenActions must be non-empty array');
pass('enrichContext: forbiddenActions is non-empty array');

// 4. enrichContext: expectedOutput
assert.ok(typeof ctx.expectedOutput === 'string' && ctx.expectedOutput.length > 0, 'expectedOutput must be non-empty string');
pass('enrichContext: expectedOutput present');

// 5. Safety flags
assert.strictEqual(ctx.projectContext.realProductActionsExecuted, false, 'realProductActionsExecuted must be false');
pass('enrichContext: realProductActionsExecuted=false');

assert.strictEqual(ctx.projectContext.dangerousActionsDenied, true, 'dangerousActionsDenied must be true');
pass('enrichContext: dangerousActionsDenied=true');

// 6. Claude unavailable → claudeCode bucket = 0
const h1 = heuristicRoute('Claude unavailableなのでGeminiで実装案を作って');
assert.strictEqual(h1.claudeCode.length, 0, 'Claude should be excluded when "Claude unavailable" is present');
assert.ok(h1.gemini.length > 0, 'Gemini should be used as fallback');
pass('Claude unavailable → claudeCode bucket forced to 0');

const h2 = heuristicRoute('Claudeには振らないでGeminiでやって');
assert.strictEqual(h2.claudeCode.length, 0, 'Claude should be excluded for "Claudeには振らない"');
pass('Claudeには振らない → claudeCode bucket forced to 0');

const h3 = heuristicRoute('Claude limit超えた。Claude stopped。Geminiで続けて');
assert.strictEqual(h3.claudeCode.length, 0, 'Claude should be excluded for "Claude stopped / limit"');
pass('Claude stopped/limit → claudeCode bucket forced to 0');

// 7. Grok review → grok bucket created
const h4 = heuristicRoute('Grokで抜け漏れレビューして');
assert.ok(h4.grok.length > 0, 'Grok bucket should be created for "Grokで抜け漏れ"');
pass('Grokで抜け漏れ → grok bucket created');

const h5 = heuristicRoute('Grokでレビューして');
assert.ok(h5.grok.length > 0, 'Grok bucket should be created for "Grokでレビュー"');
pass('Grokでレビュー → grok bucket created');

// 8. Gemini task retains original context via enrichContext
const geminiEnriched = JSON.parse(enrichContext(
  'ANESTY Board v87.0.14の制作指示書→Claude Code実装チケット変換',
  'ANESTY Board v87.0.14の制作指示書→Claude Code実装チケット変換'
));
assert.ok(geminiEnriched.originalInput.includes('ANESTY Board v87.0.14'), 'Gemini task must retain product version context');
assert.ok(geminiEnriched.originalInput.includes('制作指示書'), 'Gemini task must retain domain context');
pass('Gemini task enriched context retains product and domain details');

// 9. Insufficient context detection
assert.strictEqual(detectInsufficientContext('もう少し情報が必要ですが、どの機能ですか？'), true);
assert.strictEqual(detectInsufficientContext('どの機能ですか'), true);
assert.strictEqual(detectInsufficientContext('具体的に教えてください'), true);
assert.strictEqual(detectInsufficientContext('need more info'), true);
assert.strictEqual(detectInsufficientContext('which feature'), true);
assert.strictEqual(detectInsufficientContext('INSUFFICIENT_CONTEXT'), true);
pass('detectInsufficientContext: all general-answer signals detected');

assert.strictEqual(detectInsufficientContext('実装完了しました。'), false);
assert.strictEqual(detectInsufficientContext('Implementation complete.'), false);
pass('detectInsufficientContext: normal responses not flagged');

console.log(`\n✅ v110-13 provider context injection smoke PASSED (${passed} checks)`);
