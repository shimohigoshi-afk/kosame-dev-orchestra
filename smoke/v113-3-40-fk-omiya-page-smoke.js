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
  console.log('=== v113.3.40 FK Omiya Page smoke ===');

  // Package wiring
  assert.ok(isVersionAtLeast(pkg.version, '113.3.40'), `version must be >= 113.3.40 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-40'], 'smoke:v113-3-40 must exist in package.json');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-40'), 'verify must include smoke:v113-3-40');
  console.log('  PASS package wiring');

  // HTML file exists
  assert.ok(fs.existsSync(HTML_PATH), 'public/fk-omiya-console.html must exist');
  console.log('  PASS fk-omiya-console.html exists');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // Phase 3 sections
  assert.ok(src.includes('id="section-medical"'), 'must have section-medical (高額療養費)');
  assert.ok(src.includes('id="section-disease"'), 'must have section-disease (医療費・疾病リスク)');
  assert.ok(src.includes('id="section-underwriting"'), 'must have section-underwriting (医務査定検索)');
  assert.ok(src.includes('高額療養費・傷病手当'), 'must show 高額療養費・傷病手当 in nav');
  assert.ok(src.includes('医療費リスク試算'), 'must show 医療費リスク試算 in nav');
  assert.ok(src.includes('医務査定検索'), 'must show 医務査定検索 in nav');
  console.log('  PASS Phase3 sections (medical, disease, underwriting)');

  // Phase 2 sections
  assert.ok(src.includes('id="section-lifetime"'), 'must have section-lifetime (生涯収入)');
  assert.ok(src.includes('id="section-security"'), 'must have section-security (社会保障)');
  assert.ok(src.includes('function calcLifetime('), 'must define calcLifetime');
  assert.ok(src.includes('function calcSocialSecurity('), 'must define calcSocialSecurity');
  console.log('  PASS Phase2 sections (lifetime, security)');

  // Phase 1 simulation tabs
  assert.ok(src.includes('id="spanel-mortgage"'), 'must have mortgage panel (住宅ローン)');
  assert.ok(src.includes('id="spanel-asset"'), 'must have asset panel (資産運用・利回り)');
  assert.ok(src.includes('贈与税'), 'must have 贈与税');
  assert.ok(src.includes('相続税'), 'must have 相続税');
  assert.ok(src.includes('id="spanel-insurance"'), 'must have insurance panel (必要死亡保障額)');
  assert.ok(src.includes('id="spanel-bmi"'), 'must have bmi panel (健康・BMI)');
  assert.ok(src.includes('障害年金'), 'must have 障害年金 (障害介護)');
  assert.ok(src.includes('介護保険'), 'must have 介護保険 (障害介護)');
  console.log('  PASS Phase1 simulation tabs (mortgage, tax, insurance, bmi, asset, disability/care)');

  // Mobile viewport
  assert.ok(src.includes('name="viewport"'), 'must have viewport meta tag');
  assert.ok(src.includes('width=device-width'), 'viewport must include width=device-width');
  console.log('  PASS mobile viewport meta');

  // No secrets
  assert.ok(!src.includes('OPENAI_API_KEY'), 'must not reference OPENAI_API_KEY');
  assert.ok(!src.includes('api.openai.com'), 'must not reference OpenAI API');
  assert.ok(!src.includes("require('dotenv')"), 'must not require dotenv');
  assert.ok(!src.includes('GROQ_API_KEY'), 'must not reference GROQ_API_KEY');
  console.log('  PASS no secrets in HTML');

  console.log('\n✅ v113.3.40 FK Omiya Page smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
