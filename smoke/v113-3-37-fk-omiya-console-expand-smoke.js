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
  console.log('=== v113.3.37 FK Console Phase1 expand smoke ===');

  // Package wiring
  assert.ok(isVersionAtLeast(pkg.version, '113.3.37'), `version must be >= 113.3.37 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-37'], 'smoke:v113-3-37 must exist in package.json');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-37'), 'verify must include smoke:v113-3-37');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // CSS
  assert.ok(src.includes('.inner-tab'), 'must define .inner-tab CSS class');
  assert.ok(src.includes('.inner-panel'), 'must define .inner-panel CSS class');
  console.log('  PASS CSS inner-tab / inner-panel defined');

  // Mortgage inner tab HTML
  assert.ok(src.includes('id="itab-mortgage-basic"'), 'must have itab-mortgage-basic');
  assert.ok(src.includes('id="itab-mortgage-balance"'), 'must have itab-mortgage-balance');
  assert.ok(src.includes('id="itab-mortgage-steprate"'), 'must have itab-mortgage-steprate');
  assert.ok(src.includes('id="ipanel-mortgage-basic"'), 'must have ipanel-mortgage-basic');
  assert.ok(src.includes('id="ipanel-mortgage-balance"'), 'must have ipanel-mortgage-balance');
  assert.ok(src.includes('id="ipanel-mortgage-steprate"'), 'must have ipanel-mortgage-steprate');
  console.log('  PASS mortgage inner tabs HTML');

  // Asset inner tab HTML
  assert.ok(src.includes('id="itab-asset-accum"'), 'must have itab-asset-accum');
  assert.ok(src.includes('id="itab-asset-goal"'), 'must have itab-asset-goal');
  assert.ok(src.includes('id="itab-asset-lumpsum"'), 'must have itab-asset-lumpsum');
  assert.ok(src.includes('id="ipanel-asset-accum"'), 'must have ipanel-asset-accum');
  assert.ok(src.includes('id="ipanel-asset-goal"'), 'must have ipanel-asset-goal');
  assert.ok(src.includes('id="ipanel-asset-lumpsum"'), 'must have ipanel-asset-lumpsum');
  console.log('  PASS asset inner tabs HTML');

  // Key result element IDs — balance panel
  const hasLegacyBalanceIds = src.includes('id="mb-bal60"') && src.includes('id="mb-bal65"');
  const hasCurrentBalanceIds = src.includes('id="balance-chart"') && src.includes('id="ipanel-mortgage-balance"');
  assert.ok(hasLegacyBalanceIds || hasCurrentBalanceIds, 'must have balance panel result elements');
  assert.ok(src.includes('id="mb-end-age"'), 'must have mb-end-age');
  assert.ok(src.includes('id="mb-monthly"'), 'must have mb-monthly');
  console.log('  PASS balance panel element IDs');

  // Key result element IDs — step rate panel
  assert.ok(src.includes('id="sr-init-monthly"'), 'must have sr-init-monthly');
  assert.ok(src.includes('id="sr-required-monthly"'), 'must have sr-required-monthly');
  assert.ok(src.includes('id="sr-capped-monthly"'), 'must have sr-capped-monthly');
  assert.ok(src.includes('id="sr-balloon"'), 'must have sr-balloon');
  assert.ok(src.includes('id="sr-total-paid"'), 'must have sr-total-paid');
  console.log('  PASS step rate panel element IDs');

  // Key result element IDs — goal panel
  assert.ok(src.includes('id="ag-monthly"'), 'must have ag-monthly');
  assert.ok(src.includes('id="ag-total-invest"'), 'must have ag-total-invest');
  assert.ok(src.includes('id="ag-gain"'), 'must have ag-gain');
  assert.ok(src.includes('id="ag-multiplier"'), 'must have ag-multiplier');
  console.log('  PASS goal panel element IDs');

  // Key result element IDs — lumpsum panel
  assert.ok(src.includes('id="al-fv"'), 'must have al-fv');
  assert.ok(src.includes('id="al-gain"'), 'must have al-gain');
  assert.ok(src.includes('id="al-multiplier"'), 'must have al-multiplier');
  assert.ok(src.includes('id="al-milestones"'), 'must have al-milestones');
  console.log('  PASS lumpsum panel element IDs');

  // Canvas elements for new charts
  assert.ok(src.includes('id="balance-chart"'), 'must have balance-chart canvas');
  assert.ok(src.includes('id="goal-chart"'), 'must have goal-chart canvas');
  assert.ok(src.includes('id="lumpsum-chart"'), 'must have lumpsum-chart canvas');
  console.log('  PASS new chart canvas elements');

  // JavaScript functions — mortgage
  assert.ok(src.includes('function switchMortgageInner('), 'must define switchMortgageInner');
  assert.ok(src.includes('function calcMortgageBalance('), 'must define calcMortgageBalance');
  assert.ok(src.includes('function drawBalanceChart('), 'must define drawBalanceChart');
  assert.ok(src.includes('function calcStepRate('), 'must define calcStepRate');
  console.log('  PASS JS functions: mortgage');

  // JavaScript functions — asset
  assert.ok(src.includes('function switchAssetInner('), 'must define switchAssetInner');
  assert.ok(src.includes('function calcAssetGoal('), 'must define calcAssetGoal');
  assert.ok(src.includes('function drawGoalChart('), 'must define drawGoalChart');
  assert.ok(src.includes('function calcAssetLumpsum('), 'must define calcAssetLumpsum');
  assert.ok(src.includes('function drawLumpsumChart('), 'must define drawLumpsumChart');
  console.log('  PASS JS functions: asset');

  // Existing functionality preserved
  assert.ok(src.includes('function calcMortgage('), 'must preserve calcMortgage');
  assert.ok(src.includes('function drawMortgageChart('), 'must preserve drawMortgageChart');
  assert.ok(src.includes('function calcAsset('), 'must preserve calcAsset');
  assert.ok(src.includes('function drawAssetChart('), 'must preserve drawAssetChart');
  assert.ok(src.includes('id="spanel-mortgage"'), 'mortgage panel must exist');
  assert.ok(src.includes('id="spanel-asset"'), 'asset panel must exist');
  assert.ok(src.includes('id="mortgage-chart"'), 'original mortgage-chart canvas must exist');
  assert.ok(src.includes('id="asset-chart"'), 'original asset-chart canvas must exist');
  assert.ok(src.includes('SOLICITOR_DATA'), 'solicitor data must be preserved');
  assert.ok(src.includes('function calcBMI('), 'must preserve calcBMI');
  assert.ok(src.includes('function calcInsurance('), 'must preserve calcInsurance');
  console.log('  PASS existing functionality preserved');

  // Security
  assert.ok(!src.includes('OPENAI_API_KEY'), 'must not reference OPENAI_API_KEY');
  assert.ok(!src.includes('api.openai.com'), 'must not reference OpenAI API');
  assert.ok(!src.includes("require('dotenv')"), 'must not require dotenv');
  console.log('  PASS security checks');

  // Simulation badge updated to 7
  assert.ok(src.includes('nav-badge">7<'), 'simulation badge must show 7');
  console.log('  PASS simulation badge = 7');

  console.log('\n✅ v113.3.37 Phase1 expand smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
