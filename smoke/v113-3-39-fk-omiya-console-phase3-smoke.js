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
  console.log('=== v113.3.39 FK Console Phase3 smoke ===');

  // Package wiring
  assert.ok(isVersionAtLeast(pkg.version, '113.3.39'), `version must be >= 113.3.39 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-39'], 'smoke:v113-3-39 must exist in package.json');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-39'), 'verify must include smoke:v113-3-39');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // CSS additions
  assert.ok(src.includes('.med-zone-card'), 'must define .med-zone-card CSS');
  assert.ok(src.includes('.med-zone-grid'), 'must define .med-zone-grid CSS');
  assert.ok(src.includes('.dis-stat-card'), 'must define .dis-stat-card CSS');
  assert.ok(src.includes('.dis-stat-grid'), 'must define .dis-stat-grid CSS');
  assert.ok(src.includes('.uw-table'), 'must define .uw-table CSS');
  assert.ok(src.includes('.uw-search-bar'), 'must define .uw-search-bar CSS');
  assert.ok(src.includes('.uw-badge'), 'must define .uw-badge CSS');
  console.log('  PASS CSS additions (med-zone, dis-stat, uw-table)');

  // Sidebar nav items
  assert.ok(src.includes("navigate('medical'"), 'sidebar must have medical nav item');
  assert.ok(src.includes("navigate('disease'"), 'sidebar must have disease nav item');
  assert.ok(src.includes("navigate('underwriting'"), 'sidebar must have underwriting nav item');
  assert.ok(src.includes('高額療養費・傷病手当'), 'sidebar must show 高額療養費・傷病手当');
  assert.ok(src.includes('医療費リスク試算'), 'sidebar must show 医療費リスク試算');
  assert.ok(src.includes('医務査定検索'), 'sidebar must show 医務査定検索');
  console.log('  PASS sidebar nav items (3 new)');

  // SECTION_TITLES
  assert.ok(src.includes("medical:"), 'SECTION_TITLES must have medical key');
  assert.ok(src.includes("disease:"), 'SECTION_TITLES must have disease key');
  assert.ok(src.includes("underwriting:"), 'SECTION_TITLES must have underwriting key');
  console.log('  PASS SECTION_TITLES');

  // section-medical HTML
  assert.ok(src.includes('id="section-medical"'), 'must have section-medical');
  assert.ok(src.includes('id="med-income"'), 'must have med-income input');
  assert.ok(src.includes('id="med-age"'), 'must have med-age input');
  assert.ok(src.includes('id="med-monthly"'), 'must have med-monthly input');
  assert.ok(src.includes('id="med-instype"'), 'must have med-instype select');
  assert.ok(src.includes('id="sh-daily"'), 'must have sh-daily output');
  assert.ok(src.includes('id="sh-monthly"'), 'must have sh-monthly output');
  assert.ok(src.includes('id="sh-total"'), 'must have sh-total output');
  assert.ok(src.includes('id="sh-period"'), 'must have sh-period output');
  assert.ok(src.includes('id="sh-kenpo-note"'), 'must have sh-kenpo-note');
  assert.ok(src.includes('id="med-zone-name"'), 'must have med-zone-name');
  assert.ok(src.includes('id="med-zone-limit-main"'), 'must have med-zone-limit-main');
  assert.ok(src.includes('id="med-zone-grid"'), 'must have med-zone-grid');
  console.log('  PASS section-medical element IDs');

  // section-disease HTML
  assert.ok(src.includes('id="section-disease"'), 'must have section-disease');
  assert.ok(src.includes('id="dis-income"'), 'must have dis-income input');
  assert.ok(src.includes('id="dis-age"'), 'must have dis-age input');
  assert.ok(src.includes('id="dis-instype"'), 'must have dis-instype select');
  assert.ok(src.includes('id="dis-stat-grid"'), 'must have dis-stat-grid');
  assert.ok(src.includes('id="dis-income-impact"'), 'must have dis-income-impact');
  assert.ok(src.includes('id="dis-cover-area"'), 'must have dis-cover-area');
  console.log('  PASS section-disease element IDs');

  // section-underwriting HTML
  assert.ok(src.includes('id="section-underwriting"'), 'must have section-underwriting');
  assert.ok(src.includes('id="uw-keyword"'), 'must have uw-keyword input');
  assert.ok(src.includes('id="uw-company"'), 'must have uw-company select');
  assert.ok(src.includes('id="uw-count"'), 'must have uw-count');
  assert.ok(src.includes('id="uw-tbody"'), 'must have uw-tbody');
  console.log('  PASS section-underwriting element IDs');

  // JavaScript functions
  assert.ok(src.includes('function calcMedical('), 'must define calcMedical');
  assert.ok(src.includes('function calcDisease('), 'must define calcDisease');
  assert.ok(src.includes('const UW_DATA ='), 'must define UW_DATA');
  assert.ok(src.includes('function renderUnderwriting('), 'must define renderUnderwriting');
  assert.ok(src.includes('function searchUnderwriting('), 'must define searchUnderwriting');
  console.log('  PASS JS functions: medical, disease, underwriting');

  // UW_DATA has 10 entries
  const uwDataStr = src.match(/const UW_DATA = \[([\s\S]*?)\];/);
  assert.ok(uwDataStr, 'UW_DATA must be parseable');
  const entryCount = (uwDataStr[1].match(/disease:/g) || []).length;
  assert.ok(entryCount >= 10, `UW_DATA must have at least 10 entries (got ${entryCount})`);
  console.log(`  PASS UW_DATA has ${entryCount} entries`);

  // Init block calls
  assert.ok(
    src.includes('calcMedical();') || src.includes('calcMedical, calcDisease, renderUnderwriting'),
    'init must include calcMedical in init block',
  );
  assert.ok(
    src.includes('calcDisease();') || src.includes('calcMedical, calcDisease, renderUnderwriting'),
    'init must include calcDisease in init block',
  );
  assert.ok(
    src.includes('renderUnderwriting();') || src.includes('calcMedical, calcDisease, renderUnderwriting'),
    'init must include renderUnderwriting in init block',
  );
  console.log('  PASS init block calls');

  // Phase 1 & 2 preserved
  assert.ok(src.includes('function calcMortgage('), 'must preserve calcMortgage');
  assert.ok(src.includes('function calcLifetime('), 'must preserve calcLifetime');
  assert.ok(src.includes('function calcSocialSecurity(', ), 'must preserve calcSocialSecurity');
  assert.ok(src.includes('nav-badge">7<'), 'simulation badge must still show 7');
  console.log('  PASS Phase 1 & 2 preservation');

  // Security
  assert.ok(!src.includes('OPENAI_API_KEY'), 'must not reference OPENAI_API_KEY');
  assert.ok(!src.includes('api.openai.com'), 'must not reference OpenAI API');
  assert.ok(!src.includes("require('dotenv')"), 'must not require dotenv');
  console.log('  PASS security checks');

  console.log('\n✅ v113.3.39 Phase3 smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
