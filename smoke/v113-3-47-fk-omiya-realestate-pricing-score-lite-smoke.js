#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'fk-omiya-console.html');

function countMatches(src, pattern) {
  const m = src.match(pattern);
  return m ? m.length : 0;
}

async function main() {
  console.log('=== v113.3.47 FK Omiya Real Estate Pricing Score Lite smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.47'), `version must be >= 113.3.47 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-47'], 'smoke:v113-3-47 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(src.includes('id="section-realestate"'), 'must have real estate section');
  assert.ok(src.includes('FK Omiya Real Estate Pricing Score Lite'), 'must mention Lite version');
  assert.ok(src.includes('SUUMO/HOME\'S'), 'must explicitly forbid portal scraping');
  assert.ok(src.includes('検索・類似事例フィルター'), 'must have advanced filter title');
  assert.ok(src.includes('id="re-city"'), 'must have city filter');
  assert.ok(src.includes('id="re-station"'), 'must have station filter');
  assert.ok(src.includes('id="re-walk"'), 'must have walk filter');
  assert.ok(src.includes('id="re-age"'), 'must have age filter');
  assert.ok(src.includes('id="re-type"'), 'must have property type filter');
  assert.ok(src.includes('id="re-size"'), 'must have size band filter');
  assert.ok(src.includes('id="re-period"'), 'must have transaction period filter');
  assert.ok(src.includes('id="re-sort"'), 'must have sort selector');
  console.log('  PASS filters present');

  assert.ok(src.includes('推定成約価格'), 'must display estimated price');
  assert.ok(src.includes('相場レンジ'), 'must display range');
  assert.ok(src.includes('売出目安'), 'must display listing guide');
  assert.ok(src.includes('強気売出上限'), 'must display upper bound');
  assert.ok(src.includes('id="re-avg-score"'), 'must display average score');
  assert.ok(src.includes('id="re-top-score"'), 'must display top score');
  assert.ok(src.includes('id="re-score-note"'), 'must display score note');
  assert.ok(src.includes('信頼度A'), 'must describe confidence A');
  assert.ok(src.includes('信頼度B'), 'must describe confidence B');
  assert.ok(src.includes('信頼度C'), 'must describe confidence C');
  assert.ok(src.includes('査定・鑑定ではなく、公開取引データをもとにした参考推定です'), 'must include disclaimer');
  assert.ok(src.includes('根拠：直近'), 'must expose basis text');
  console.log('  PASS summary and disclaimer copy');

  assert.ok(src.includes('function searchRealestate('), 'must define searchRealestate');
  assert.ok(src.includes('function renderRealestate('), 'must define renderRealestate');
  assert.ok(src.includes('function estimateRealestate('), 'must define estimateRealestate');
  assert.ok(src.includes('function calcRealestatePricingScore('), 'must define calcRealestatePricingScore');
  assert.ok(src.includes('function sortRealestateRows('), 'must define sortRealestateRows');
  assert.ok(src.includes('function applyRealestateEstimateToMortgage('), 'must define mortgage transfer handler');
  assert.ok(src.includes('localStorage.setItem(RE_LS_KEY'), 'must store estimate in localStorage');
  assert.ok(src.includes('data-estimated-price'), 'must expose estimated price as data attribute');
  assert.ok(src.includes('Pricing Score Lite'), 'must render pricing score card');
  console.log('  PASS JS wiring');

  const dataCount = countMatches(src, /periodYears:\s*(?:1|3|5)/g);
  assert.ok(dataCount >= 20, `RE_DATA must have at least 20 sample entries (got ${dataCount})`);
  assert.ok(src.includes("type: '中古マンション'"), 'RE_DATA must include 中古マンション');
  assert.ok(src.includes("type: '戸建て'"), 'RE_DATA must include 戸建て');
  assert.ok(src.includes("type: '土地'"), 'RE_DATA must include 土地');
  assert.ok(src.includes("station: '大宮'"), 'RE_DATA must include 大宮 station');
  assert.ok(src.includes("city: 'さいたま市大宮区'"), 'RE_DATA must include city sample');
  console.log(`  PASS sample data (${dataCount} entries)`);

  assert.ok(src.includes('id="m-principal"'), 'must have mortgage principal input');
  assert.ok(src.includes('住宅ローン計算へ反映'), 'must have mortgage transfer button');
  assert.ok(src.includes('switchSimTab(\'mortgage\')'), 'must navigate to mortgage tab');
  console.log('  PASS mortgage handoff');

  console.log('\n✅ v113.3.47 FK Omiya Real Estate Pricing Score Lite smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
