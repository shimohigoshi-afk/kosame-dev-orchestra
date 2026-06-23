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
  console.log('=== v113.3.41 FK Omiya v1.1.0 smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.41'), `version must be >= 113.3.41 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-41'], 'smoke:v113-3-41 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // ① 教育費シミュレーション
  assert.ok(src.includes('id="section-education"'), 'must have section-education');
  assert.ok(src.includes('edu-child-tabs'), 'must have edu-child-tabs');
  assert.ok(src.includes("switchEduChild(0)"), 'must have switchEduChild');
  assert.ok(src.includes("selectEduStage("), 'must have selectEduStage');
  assert.ok(src.includes('function calcEducation('), 'must define calcEducation');
  assert.ok(src.includes('LiPSS'), 'must mention LiPSS');
  assert.ok(src.includes('edu-lipss-total'), 'must have edu-lipss-total element');
  assert.ok(src.includes('kindergarten'), 'must have kindergarten stage');
  assert.ok(src.includes('university'), 'must have university stage');
  assert.ok(src.includes('22.3'), 'must include 文科省 幼稚園公立データ');
  assert.ok(src.includes('167.3'), 'must include 文科省 小学校私立データ');
  console.log('  PASS ① 教育費シミュレーション（LiPSS）');

  // ② e-Stat / education-costs.json
  assert.ok(fs.existsSync(path.join(ROOT, 'data', 'education-costs.json')), 'data/education-costs.json must exist');
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'fetch-education-costs.js')), 'tools/fetch-education-costs.js must exist');
  assert.ok(pkg.scripts['fetch:education-costs'], 'fetch:education-costs script must exist');
  console.log('  PASS ② e-Stat fetch script and data file');

  // ③ 医務査定検索リニューアル
  assert.ok(!src.includes('ソリシター君'), 'must not contain ソリシター君');
  assert.ok(src.includes('医務査定検索'), 'must have 医務査定検索');
  assert.ok(src.includes('uw-criteria-filter'), 'must have criteria filter');
  assert.ok(src.includes('filterUWCriteria('), 'must define filterUWCriteria');
  assert.ok(src.includes('function searchUnderwriting('), 'must define searchUnderwriting');
  assert.ok(src.includes('uw-pdf-note'), 'must have PDF import note');
  assert.ok(src.includes('data/underwriting/'), 'must reference data/underwriting/');
  assert.ok(fs.existsSync(path.join(ROOT, 'data', 'underwriting', '.gitkeep')), 'data/underwriting/ must exist');
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'import-underwriting-pdf.js')), 'import-underwriting-pdf.js must exist');
  // UW_DATA must have 30+ entries
  const uwCount = (src.match(/disease:/g) || []).length;
  assert.ok(uwCount >= 25, `UW_DATA must have at least 25 entries (got ${uwCount})`);
  console.log(`  PASS ③ 医務査定検索リニューアル (${uwCount} entries, no ソリシター君)`);

  // ④ 不動産・土地価格検索
  assert.ok(src.includes('id="section-realestate"'), 'must have section-realestate');
  assert.ok(src.includes('RE_DATA'), 'must have RE_DATA');
  assert.ok(src.includes('function renderRealestate('), 'must define renderRealestate');
  assert.ok(src.includes('function searchRealestate('), 'must define searchRealestate');
  assert.ok(src.includes('坪単価'), 'must display 坪単価');
  assert.ok(src.includes('国土交通省'), 'must reference 国土交通省');
  assert.ok(src.includes('マンション'), 'RE_DATA must include マンション');
  assert.ok(src.includes('戸建て'), 'RE_DATA must include 戸建て');
  console.log('  PASS ④ 不動産・土地価格検索');

  // v1.1.x console version (footer updated in subsequent patches)
  assert.ok(/v1\.1\.\d/.test(src), 'sidebar footer must show v1.1.x or higher');
  console.log('  PASS console version v1.1.x');

  // .gitignore
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('data/underwriting'), '.gitignore must exclude data/underwriting');
  console.log('  PASS .gitignore excludes data/underwriting');

  // No secrets in HTML
  assert.ok(!src.includes('OPENAI_API_KEY'), 'must not reference OPENAI_API_KEY');
  assert.ok(!src.includes('GROQ_API_KEY'), 'must not reference GROQ_API_KEY');
  console.log('  PASS no secrets in HTML');

  console.log('\n✅ v113.3.41 FK Omiya v1.1.0 smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
