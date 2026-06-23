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
  console.log('=== v113.3.42 FK Omiya v1.1.1 smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.42'), `version must be >= 113.3.42 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-42'], 'smoke:v113-3-42 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // ① BMI — 保険引受基準表現
  assert.ok(!src.includes('低体重'), 'must NOT contain "低体重"');
  assert.ok(!src.includes('肥満(1度)'), 'must NOT contain "肥満(1度)"');
  assert.ok(!src.includes('肥満(2度)'), 'must NOT contain "肥満(2度)"');
  assert.ok(!src.includes('肥満(3度'), 'must NOT contain "肥満(3度以上)"');
  assert.ok(src.includes('優良体域'), 'must contain "優良体域"');
  assert.ok(src.includes('標準体域'), 'must contain "標準体域"');
  assert.ok(src.includes('要確認域'), 'must contain "要確認域"');
  assert.ok(src.includes('bmi-ins-note'), 'must have bmi-ins-note element');
  assert.ok(src.includes('引受条件が有利な範囲です'), 'calcBMI must output 優良体域 message');
  assert.ok(src.includes('通常引受の範囲内です'), 'calcBMI must output 標準体域 message');
  assert.ok(src.includes('詳細確認が必要な場合があります'), 'calcBMI must output 要確認域 message');
  console.log('  PASS ① BMI 保険引受基準表現（肥満/低体重 廃止、優良体域/標準体域/要確認域）');

  // ② 繰上げ返済シミュレーション改善
  assert.ok(src.includes('mb-prepay'), 'balance panel must have mb-prepay input');
  assert.ok(src.includes('mb-prepay-year'), 'balance panel must have mb-prepay-year input');
  assert.ok(src.includes('mb-milestone-body'), 'must have milestone table body');
  assert.ok(src.includes('mb-total-savings'), 'must have mb-total-savings element');
  assert.ok(src.includes('mb-savings-box'), 'must have mb-savings-box element');
  assert.ok(src.includes('総利息節約額'), 'must show 総利息節約額');
  assert.ok(src.includes('繰上げなし'), 'comparison table must have 繰上げなし column');
  assert.ok(src.includes('繰上げあり'), 'comparison table must have 繰上げあり column');
  assert.ok(src.includes('balanceAtMonthWithPrepay'), 'calcMortgageBalance must define balanceAtMonthWithPrepay');
  console.log('  PASS ② 繰上げ返済シミュレーション（マイルストーンテーブル・比較グラフ・節約額）');

  // ③ import-underwriting-pdf.js 実装
  const importScript = path.join(ROOT, 'tools', 'import-underwriting-pdf.js');
  assert.ok(fs.existsSync(importScript), 'import-underwriting-pdf.js must exist');
  const importSrc = fs.readFileSync(importScript, 'utf8');
  assert.ok(importSrc.includes('pdf-parse'), 'must use pdf-parse');
  assert.ok(importSrc.includes('parseTextToEntries'), 'must define parseTextToEntries');
  assert.ok(importSrc.includes('detectCriteria'), 'must define detectCriteria');
  assert.ok(importSrc.includes('saveEntries'), 'must define saveEntries');
  assert.ok(importSrc.includes('process.argv'), 'must parse CLI args');
  assert.ok(importSrc.includes('data/underwriting'), 'must save to data/underwriting/');
  console.log('  PASS ③ import-underwriting-pdf.js 実装（pdf-parse, CLI対応, JSON出力）');

  // v1.1.1 footer
  assert.ok(src.includes('v1.1.1'), 'sidebar footer must show v1.1.1');
  console.log('  PASS console version v1.1.1');

  // No secrets
  assert.ok(!src.includes('OPENAI_API_KEY'), 'must not contain OPENAI_API_KEY');
  assert.ok(!src.includes('GROQ_API_KEY'), 'must not contain GROQ_API_KEY');
  console.log('  PASS no secrets');

  console.log('\n✅ v113.3.42 FK Omiya v1.1.1 smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
