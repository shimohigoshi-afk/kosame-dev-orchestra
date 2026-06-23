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
  console.log('=== v113.3.38 FK Console Phase2 smoke ===');

  // Package wiring
  assert.ok(isVersionAtLeast(pkg.version, '113.3.38'), `version must be >= 113.3.38 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-38'], 'smoke:v113-3-38 must exist in package.json');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-38'), 'verify must include smoke:v113-3-38');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // CSS additions
  assert.ok(src.includes('.alloc-bar'), 'must define .alloc-bar CSS');
  assert.ok(src.includes('.alloc-seg'), 'must define .alloc-seg CSS');
  assert.ok(src.includes('.risk-grid'), 'must define .risk-grid CSS');
  assert.ok(src.includes('.risk-card'), 'must define .risk-card CSS');
  assert.ok(src.includes('.step-wizard'), 'must define .step-wizard CSS');
  assert.ok(src.includes('.step-option'), 'must define .step-option CSS');
  assert.ok(src.includes('.avg-row'), 'must define .avg-row CSS');
  console.log('  PASS CSS additions (alloc-bar, risk-grid, step-wizard, avg-row)');

  // Sidebar nav items
  assert.ok(src.includes("navigate('lifetime'"), 'sidebar must have lifetime nav item');
  assert.ok(src.includes("navigate('security'"), 'sidebar must have security nav item');
  assert.ok(src.includes('分析ツール'), 'sidebar must have 分析ツール label');
  console.log('  PASS sidebar nav items');

  // SECTION_TITLES
  assert.ok(src.includes("lifetime:"), 'SECTION_TITLES must have lifetime key');
  assert.ok(src.includes("security:"), 'SECTION_TITLES must have security key');
  console.log('  PASS SECTION_TITLES');

  // section-lifetime HTML
  assert.ok(src.includes('id="section-lifetime"'), 'must have section-lifetime');
  assert.ok(src.includes('id="lt-age"'), 'must have lt-age input');
  assert.ok(src.includes('id="lt-income"'), 'must have lt-income input');
  assert.ok(src.includes('id="lt-growth"'), 'must have lt-growth input');
  assert.ok(src.includes('id="lt-years"'), 'must have lt-years output');
  assert.ok(src.includes('id="lt-social"'), 'must have lt-social output');
  assert.ok(src.includes('id="lt-tax"'), 'must have lt-tax output');
  assert.ok(src.includes('id="lt-net-annual"'), 'must have lt-net-annual output');
  assert.ok(src.includes('id="lt-total-net"'), 'must have lt-total-net output');
  assert.ok(src.includes('id="lt-breakdown"'), 'must have lt-breakdown output');
  console.log('  PASS section-lifetime inputs/outputs');

  // Allocation IDs
  assert.ok(src.includes('id="alloc-housing"'), 'must have alloc-housing input');
  assert.ok(src.includes('id="alloc-living"'), 'must have alloc-living input');
  assert.ok(src.includes('id="alloc-education"'), 'must have alloc-education input');
  assert.ok(src.includes('id="alloc-insurance"'), 'must have alloc-insurance input');
  assert.ok(src.includes('id="alloc-savings"'), 'must have alloc-savings input');
  assert.ok(src.includes('id="alloc-total-bar"'), 'must have alloc-total-bar');
  assert.ok(src.includes('id="alloc-total-pct"'), 'must have alloc-total-pct');
  assert.ok(src.includes('id="alloc-r-housing"'), 'must have alloc-r-housing');
  assert.ok(src.includes('id="alloc-r-living"'), 'must have alloc-r-living');
  assert.ok(src.includes('id="alloc-r-education"'), 'must have alloc-r-education');
  assert.ok(src.includes('id="alloc-r-insurance"'), 'must have alloc-r-insurance');
  assert.ok(src.includes('id="alloc-r-savings"'), 'must have alloc-r-savings');
  assert.ok(src.includes('id="alloc-avg-compare"'), 'must have alloc-avg-compare');
  console.log('  PASS allocation element IDs');

  // section-security HTML
  assert.ok(src.includes('id="section-security"'), 'must have section-security');
  assert.ok(src.includes('id="ss-sex-m"'), 'must have ss-sex-m option');
  assert.ok(src.includes('id="ss-sex-f"'), 'must have ss-sex-f option');
  assert.ok(src.includes('id="ss-type-1"'), 'must have ss-type-1 option');
  assert.ok(src.includes('id="ss-type-2"'), 'must have ss-type-2 option');
  assert.ok(src.includes('id="ss-type-3"'), 'must have ss-type-3 option');
  assert.ok(src.includes('id="ss-spouse-none"'), 'must have ss-spouse-none option');
  assert.ok(src.includes('id="ss-child-0"'), 'must have ss-child-0 option');
  assert.ok(src.includes('id="ss-child-1"'), 'must have ss-child-1 option');
  assert.ok(src.includes('id="ss-income-step"'), 'must have ss-income-step div');
  assert.ok(src.includes('id="ss-monthly"'), 'must have ss-monthly input');
  assert.ok(src.includes('id="ss-kinen"'), 'must have ss-kinen input');
  assert.ok(src.includes('id="ss-result-area"'), 'must have ss-result-area');
  assert.ok(src.includes('id="ss-notes"'), 'must have ss-notes');
  console.log('  PASS section-security element IDs');

  // JavaScript functions
  assert.ok(src.includes('function calcLifetime('), 'must define calcLifetime');
  assert.ok(src.includes('function calcAllocation('), 'must define calcAllocation');
  assert.ok(src.includes('const SS_STATE ='), 'must define SS_STATE');
  assert.ok(src.includes('function setSS('), 'must define setSS');
  assert.ok(src.includes('function calcSocialSecurity('), 'must define calcSocialSecurity');
  assert.ok(src.includes('function renderSecurityResults('), 'must define renderSecurityResults');
  console.log('  PASS JS functions: lifetime + social security');

  // Init block calls
  assert.ok(src.includes('calcLifetime();'), 'init must call calcLifetime()');
  assert.ok(src.includes('calcSocialSecurity();'), 'init must call calcSocialSecurity()');
  console.log('  PASS init block calls');

  // Phase 1 preserved
  assert.ok(src.includes('function calcMortgage('), 'must preserve calcMortgage');
  assert.ok(src.includes('function calcAsset('), 'must preserve calcAsset');
  assert.ok(src.includes('function calcMortgageBalance('), 'must preserve calcMortgageBalance');
  assert.ok(src.includes('function calcAssetGoal('), 'must preserve calcAssetGoal');
  assert.ok(src.includes('function calcAssetLumpsum('), 'must preserve calcAssetLumpsum');
  assert.ok(src.includes('nav-badge">7<'), 'simulation badge must still show 7');
  console.log('  PASS Phase 1 preservation');

  // Security
  assert.ok(!src.includes('OPENAI_API_KEY'), 'must not reference OPENAI_API_KEY');
  assert.ok(!src.includes('api.openai.com'), 'must not reference OpenAI API');
  assert.ok(!src.includes("require('dotenv')"), 'must not require dotenv');
  console.log('  PASS security checks');

  console.log('\n✅ v113.3.38 Phase2 smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
