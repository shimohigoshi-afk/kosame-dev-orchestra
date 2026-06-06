#!/usr/bin/env node
'use strict';

/**
 * Smoke test: Multi-Agent Task Router v110.13.0
 */

const assert = require('node:assert');
const path = require('node:path');
const { arbitrate, heuristicRoute } = require('../tools/gpt-task-arbiter');

function pass(msg) { console.log(`  PASS: ${msg}`); }

async function runTests() {
  console.log('=== v110.13 multi-agent task router smoke ===');

  // 1. Claude exclusion keywords
  const h1 = heuristicRoute('実装して。Claude unavailableなので。');
  assert.strictEqual(h1.claudeCode.length, 0, 'Claude should be excluded');
  assert.ok(h1.gemini.length > 0, 'Should route to Gemini instead');
  pass('Claude exclusion keywords handled');

  // 2. Grok inclusion keywords
  const h2 = heuristicRoute('Grokで抜け漏れレビューして');
  assert.ok(h2.grok.length > 0, 'Grok bucket should be created');
  pass('Grok inclusion keywords handled');

  // 3. Mixed routing
  const h3 = heuristicRoute('実装案をGeminiで作って、Grokでレビューして');
  assert.ok(h3.gemini.length > 0, 'Gemini bucket should exist');
  assert.ok(h3.grok.length > 0, 'Grok bucket should exist');
  pass('Mixed routing (Gemini + Grok) handled');

  // 4. Insufficient context detection
  const { detectInsufficientContext } = require('../tools/multi-agent-task-router');
  const r1 = detectInsufficientContext('もう少し情報が必要ですが、どの機能ですか？');
  assert.strictEqual(r1, true, 'Should detect insufficient context (Japanese)');
  const r2 = detectInsufficientContext('Implementation complete.');
  assert.strictEqual(r2, false, 'Should not detect on normal response');
  const r3 = detectInsufficientContext('Need more info on which feature.');
  assert.strictEqual(r3, true, 'Should detect insufficient context (English)');
  pass('Insufficient context detection works');

  // 5. Version check
  const pkg = require('../package.json');
  assert.strictEqual(pkg.version, '110.13.0', 'package.json version should be 110.13.0');
  pass('Version is 110.13.0');

  console.log('✅ v110.13 smoke passed');
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('FAIL:', err.message);
    process.exit(1);
  });
}
