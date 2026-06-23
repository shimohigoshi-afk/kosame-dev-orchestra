#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'fk-omiya-console.html');

async function main() {
  console.log('=== v113.3.43 FK Omiya v1.1.2 smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.43'), `version must be >= 113.3.43 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-43'], 'smoke:v113-3-43 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // ① フローティングボタン
  assert.ok(src.includes('fb-float-btn'), 'must have fb-float-btn element');
  assert.ok(src.includes('openFeedback()'), 'must call openFeedback');
  assert.ok(src.includes('💬 ご意見'), 'must show 💬 ご意見 label');
  console.log('  PASS ① フローティングご意見ボタン');

  // ② フィードバックモーダル
  assert.ok(src.includes('fb-overlay'), 'must have fb-overlay');
  assert.ok(src.includes('fb-modal'), 'must have fb-modal');
  assert.ok(src.includes('fb-category-grid'), 'must have category grid');
  assert.ok(src.includes('selectFbCat('), 'must define selectFbCat');
  assert.ok(src.includes('fb-comment'), 'must have comment textarea');
  assert.ok(src.includes('fb-submit-btn'), 'must have submit button');
  assert.ok(src.includes('fb-success'), 'must have success screen');
  console.log('  PASS ② フィードバックモーダル（カテゴリ選択・テキスト入力・送信確認）');

  // ③ JavaScript 関数
  assert.ok(src.includes('function openFeedback('), 'must define openFeedback');
  assert.ok(src.includes('function closeFeedback('), 'must define closeFeedback');
  assert.ok(src.includes('function submitFeedback('), 'must define submitFeedback');
  assert.ok(src.includes('function getAnonymousId('), 'must define getAnonymousId');
  assert.ok(src.includes('function saveSettings('), 'must define saveSettings');
  assert.ok(src.includes('function loadSettings('), 'must define loadSettings');
  assert.ok(src.includes('function analyzeFeedback('), 'must define analyzeFeedback');
  assert.ok(src.includes('function generateWeeklyReport('), 'must define generateWeeklyReport');
  assert.ok(src.includes('function refreshFeedbackAdmin('), 'must define refreshFeedbackAdmin');
  assert.ok(src.includes('function clearLocalFeedback('), 'must define clearLocalFeedback');
  assert.ok(src.includes('fb_local_cache'), 'must use fb_local_cache localStorage key');
  console.log('  PASS ③ JS関数一覧（10関数）');

  // ④ GAS 連携
  assert.ok(src.includes('cfg-gas-url'), 'must have GAS URL input');
  assert.ok(src.includes('mode: \'no-cors\''), 'GAS fetch must use no-cors');
  assert.ok(src.includes('testGasConnection'), 'must have GAS connection test');
  console.log('  PASS ④ GAS連携（no-cors fetch）');

  // ⑤ Gemini API 分析
  assert.ok(src.includes('cfg-gemini-key'), 'must have Gemini API key input');
  assert.ok(src.includes('gemini-result'), 'must have gemini-result container');
  assert.ok(src.includes('generativelanguage.googleapis.com'), 'must reference Gemini API endpoint');
  assert.ok(src.includes('よく要望される機能TOP3'), 'Gemini prompt must ask for TOP3');
  assert.ok(src.includes('優先実装推奨項目'), 'Gemini prompt must ask for priority items');
  console.log('  PASS ⑤ Gemini AI 分析');

  // ⑥ 管理者画面（設定タブ）
  assert.ok(src.includes('fb-stat-total'), 'must show total feedback count');
  assert.ok(src.includes('fb-stat-week'), 'must show weekly count');
  assert.ok(src.includes('fb-entry-list'), 'must show feedback entry list');
  assert.ok(src.includes('mb-milestone-body'), 'existing milestone table must be intact');
  console.log('  PASS ⑥ 管理者画面（設定タブ内の集計・一覧）');

  // ⑦ GAS セットアップドキュメント
  const gasDoc = path.join(ROOT, 'docs', 'fk-omiya-feedback-gas-setup.md');
  assert.ok(fs.existsSync(gasDoc), 'docs/fk-omiya-feedback-gas-setup.md must exist');
  const docSrc = fs.readFileSync(gasDoc, 'utf8');
  assert.ok(docSrc.includes('doPost'), 'GAS doc must include doPost function');
  assert.ok(docSrc.includes('appendRow'), 'GAS doc must include appendRow usage');
  assert.ok(docSrc.includes('sendWeeklySummary'), 'GAS doc must include weekly summary function');
  console.log('  PASS ⑦ GASセットアップドキュメント');

  // v1.1.2 footer
  assert.ok(src.includes('v1.1.2'), 'sidebar footer must show v1.1.2');
  console.log('  PASS console version v1.1.2');

  // No secrets
  assert.ok(!src.includes('OPENAI_API_KEY'), 'must not contain OPENAI_API_KEY');
  assert.ok(!src.includes('GROQ_API_KEY'), 'must not contain GROQ_API_KEY');
  console.log('  PASS no secrets');

  console.log('\n✅ v113.3.43 FK Omiya v1.1.2 smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
