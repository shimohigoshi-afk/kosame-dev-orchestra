#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const HTML_PATH = path.join(__dirname, '..', 'public', 'fk-omiya-console.html');

async function main() {
  console.log('=== v113.3.47 Real Estate Pricing Score smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.47'), `version >= 113.3.47 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-47'], 'smoke:v113-3-47 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // ① スコア計算関数
  assert.ok(src.includes('function calcPriceScore('), 'must define calcPriceScore');
  assert.ok(src.includes('function getPriceScoreLabel('), 'must define getPriceScoreLabel');
  console.log('  PASS ① スコア計算関数（calcPriceScore / getPriceScoreLabel）');

  // ② スコアバッジCSS
  assert.ok(src.includes('.re-score-badge'), 'must have re-score-badge CSS');
  assert.ok(src.includes('.re-score-cheap'), 'must have re-score-cheap CSS');
  assert.ok(src.includes('.re-score-fair'), 'must have re-score-fair CSS');
  assert.ok(src.includes('.re-score-expensive'), 'must have re-score-expensive CSS');
  console.log('  PASS ② スコアバッジCSS（割安/標準/割高）');

  // ③ ソート選択
  assert.ok(src.includes('re-sort'), 'must have re-sort select');
  assert.ok(src.includes('score-asc'), 'must have score-asc sort option');
  assert.ok(src.includes('price-asc'), 'must have price-asc sort option');
  assert.ok(src.includes('price-desc'), 'must have price-desc sort option');
  console.log('  PASS ③ ソート選択（スコア順/価格順）');

  // ④ カードにスコアバッジが表示される
  assert.ok(src.includes('scoreCls'), 'must use scoreCls in card template');
  assert.ok(src.includes('scoreLabel'), 'must use scoreLabel in card template');
  console.log('  PASS ④ カードにスコアバッジ表示');

  // ⑤ searchRealesate がソートを適用
  assert.ok(src.includes("sort === 'score-asc'"), 'must handle score-asc sort');
  assert.ok(src.includes("sort === 'price-asc'"), 'must handle price-asc sort');
  console.log('  PASS ⑤ searchRealestate ソート適用');

  // ⑥ No secrets
  assert.ok(!src.includes('OPENAI_API_KEY'), 'no OPENAI_API_KEY');
  assert.ok(!src.includes('GROQ_API_KEY'), 'no GROQ_API_KEY');
  console.log('  PASS ⑥ no secrets');

  console.log('\n✅ v113.3.47 Real Estate Pricing Score smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
