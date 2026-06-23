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
  console.log('=== v113.3.35 FK Omiya Console smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.35'), `version must be >= 113.3.35 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-35'], 'smoke:v113-3-35 must exist in package.json');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-35'), 'verify must include smoke:v113-3-35');
  console.log('  PASS: package wiring');

  assert.ok(fs.existsSync(HTML_PATH), `fk-omiya-console.html must exist at ${HTML_PATH}`);
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  console.log('  PASS: file exists');

  // Branding
  assert.ok(html.includes('大宮支店'), 'HTML must include 大宮支店 branding');
  assert.ok(html.includes('FK Console'), 'HTML must include FK Console title');
  assert.ok(/logo-fk[^>]*>FK/.test(html), 'HTML must render FK logo letters');
  assert.ok(html.includes('logo-branch'), 'HTML must have logo-branch element');
  console.log('  PASS: FK branding');

  // Design tokens
  assert.ok(html.includes('#0d1b2a'), 'HTML must use deep navy background #0d1b2a');
  assert.ok(html.includes('#c9a84c'), 'HTML must use gold accent #c9a84c');
  assert.ok(html.includes('#4fc3f7'), 'HTML must use blue sub-color #4fc3f7');
  assert.ok(html.includes('#1a2d42'), 'HTML must use card background #1a2d42');
  assert.ok(html.includes('#e8f4f8'), 'HTML must use off-white text #e8f4f8');
  console.log('  PASS: design tokens');

  // FK emblem
  assert.ok(html.includes('<svg') && html.includes('polygon'), 'HTML must include FK emblem SVG');
  console.log('  PASS: FK emblem SVG');

  // Left sidebar navigation
  assert.ok(html.includes('sidebar'), 'HTML must have sidebar');
  assert.ok(html.includes('ダッシュボード'), 'sidebar must include ダッシュボード');
  assert.ok(html.includes('検索・計算ツール'), 'sidebar must include 検索・計算ツール');
  assert.ok(html.includes('提案サマリー'), 'sidebar must include 提案サマリー');
  assert.ok(html.includes('シミュレーション'), 'sidebar must include シミュレーション');
  assert.ok(html.includes('ファイル管理'), 'sidebar must include ファイル管理');
  assert.ok(html.includes('URL解析'), 'sidebar must include URL解析');
  assert.ok(html.includes('設定'), 'sidebar must include 設定');
  console.log('  PASS: sidebar navigation (7 items)');

  // Feature ① 引受基準検索（旧ソリシター君 — v1.1.0 でリネーム済み）
  assert.ok(true, 'ソリシター君: skipped (renamed to 引受基準検索 in v1.1.0)');
  assert.ok(html.includes('告知事項'), '引受基準検索 must include 告知事項 tag');
  assert.ok(html.includes('引受基準'), '引受基準検索 must include 引受基準 tag');
  assert.ok(html.includes('不担保'), '引受基準検索 must include 不担保 tag');
  assert.ok(html.includes('医的査定'), '引受基準検索 must include 医的査定 tag');
  assert.ok(html.includes('職業分類'), '引受基準検索 must include 職業分類 tag');
  assert.ok(html.includes('doSearch'), 'HTML must include doSearch function');
  console.log('  PASS: ① 引受基準検索（旧ソリシター君）');

  // Feature ② 住宅ローン計算
  assert.ok(html.includes('住宅ローン'), 'HTML must include 住宅ローン section');
  assert.ok(html.includes('借入額'), 'mortgage must include 借入額 input');
  assert.ok(html.includes('毎月返済額'), 'mortgage must compute 毎月返済額');
  assert.ok(html.includes('総返済額'), 'mortgage must compute 総返済額');
  assert.ok(html.includes('総利息'), 'mortgage must compute 総利息');
  assert.ok(html.includes('繰上げ返済'), 'mortgage must include 繰上げ返済 simulation');
  assert.ok(html.includes('変動'), 'mortgage must include 変動 rate option');
  assert.ok(html.includes('固定'), 'mortgage must include 固定 rate option');
  assert.ok(html.includes('mortgageMonthly'), 'HTML must include mortgageMonthly function');
  assert.ok(html.includes('drawMortgageChart'), 'HTML must include drawMortgageChart function');
  console.log('  PASS: ② 住宅ローン計算');

  // Feature ③ 税務計算
  assert.ok(html.includes('税務計算'), 'HTML must include 税務計算 section');
  assert.ok(html.includes('贈与税'), 'tax section must include 贈与税');
  assert.ok(html.includes('暦年課税'), 'gift tax must include 暦年課税');
  assert.ok(html.includes('相続時精算課税'), 'gift tax must include 相続時精算課税');
  assert.ok(html.includes('相続税'), 'tax section must include 相続税');
  assert.ok(html.includes('法定相続人'), 'inheritance tax must include 法定相続人');
  assert.ok(html.includes('実効税率'), 'tax must show 実効税率');
  assert.ok(html.includes('calcGiftTax'), 'HTML must include calcGiftTax function');
  assert.ok(html.includes('calcInheritanceTax'), 'HTML must include calcInheritanceTax function');
  console.log('  PASS: ③ 税務計算');

  // Feature ④ 必要保障額
  assert.ok(html.includes('必要保障額'), 'HTML must include 必要保障額 section');
  assert.ok(html.includes('年収'), 'insurance must have 年収 input');
  assert.ok(html.includes('健康保険'), 'insurance must auto-compute 健康保険');
  assert.ok(html.includes('厚生年金'), 'insurance must auto-compute 厚生年金');
  assert.ok(html.includes('雇用保険'), 'insurance must auto-compute 雇用保険');
  assert.ok(html.includes('遺族年金'), 'insurance must include 遺族年金 deduction');
  assert.ok(html.includes('calcInsurance'), 'HTML must include calcInsurance function');
  console.log('  PASS: ④ 必要保障額（社会保険料自動計算）');

  // Feature ⑤ 健康・BMI
  assert.ok(html.includes('BMI'), 'HTML must include BMI section');
  assert.ok(html.includes('身長'), 'BMI must have 身長 input');
  assert.ok(html.includes('体重'), 'BMI must have 体重 input');
  assert.ok(html.includes('標準体重'), 'BMI must show 標準体重');
  assert.ok(html.includes('肥満度') || html.includes('肥満'), 'BMI must show 肥満判定');
  assert.ok(html.includes('calcBMI'), 'HTML must include calcBMI function');
  assert.ok(html.includes('bmi-marker'), 'BMI must include visual marker');
  console.log('  PASS: ⑤ 健康・BMI');

  // Feature ⑥ 資産運用
  assert.ok(html.includes('資産運用'), 'HTML must include 資産運用 section');
  assert.ok(html.includes('毎月積立額'), 'asset must have 毎月積立額 input');
  assert.ok(html.includes('想定利回り') || html.includes('利回り'), 'asset must have 利回り input');
  assert.ok(html.includes('複利'), 'asset must show 複利 effect');
  assert.ok(html.includes('drawAssetChart'), 'HTML must include drawAssetChart function');
  assert.ok(html.includes('asset-chart'), 'asset must include canvas chart element');
  console.log('  PASS: ⑥ 資産運用（複利グラフ）');

  // Dashboard
  assert.ok(html.includes('ダッシュボード'), 'HTML must include dashboard section');
  assert.ok(html.includes('クイックアクセス'), 'dashboard must have クイックアクセス');
  console.log('  PASS: ダッシュボード');

  // No secrets or forbidden patterns
  assert.ok(!html.includes('OPENAI_API_KEY'), 'HTML must not contain OPENAI_API_KEY');
  assert.ok(!html.includes('api.openai.com'), 'HTML must not contain api.openai.com');
  assert.ok(!html.includes('require(\'dotenv\')'), 'HTML must not contain dotenv');
  console.log('  PASS: security checks');

  // Canvas-based charts
  assert.ok(html.includes('canvas'), 'HTML must use canvas for charts');
  assert.ok(html.includes('getContext'), 'HTML must use Canvas 2D API');
  console.log('  PASS: canvas charts');

  // HTML structure
  assert.ok(html.includes('<!DOCTYPE html>'), 'must be valid HTML5');
  assert.ok(html.includes('lang="ja"'), 'must declare Japanese language');
  assert.ok(html.includes('charset="UTF-8"'), 'must declare UTF-8 charset');
  assert.ok(html.includes('viewport'), 'must include viewport meta');
  console.log('  PASS: HTML structure');

  // Functional JavaScript checks (syntax-level)
  const jsSection = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
  assert.ok(jsSection.includes('function navigate'), 'must include navigate function');
  assert.ok(jsSection.includes('function switchSimTab'), 'must include switchSimTab function');
  assert.ok(jsSection.includes('function fmt'), 'must include fmt helper');
  assert.ok(jsSection.includes('function drawMortgageChart'), 'must include drawMortgageChart');
  assert.ok(jsSection.includes('function drawAssetChart'), 'must include drawAssetChart');
  console.log('  PASS: JavaScript functions');

  console.log('✅ v113.3.35 FK Omiya Console smoke PASSED');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
