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
  console.log('=== v113.3.48 FK Omiya Real Estate MLIT API Bridge Lite smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.48'), `version must be >= 113.3.48 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-48'], 'smoke:v113-3-48 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(src.includes('MLIT API Bridge Lite 設計'), 'must expose bridge lite design section');
  assert.ok(src.includes('id="re-bridge-status"'), 'must expose bridge status');
  assert.ok(src.includes('id="re-bridge-endpoint"'), 'must expose bridge endpoint');
  assert.ok(src.includes('id="re-bridge-cache"'), 'must expose bridge cache hint');
  assert.ok(src.includes('モックデータ / API未接続'), 'must show mock/api state');
  assert.ok(src.includes('ブラウザに APIキーは置かず'), 'must forbid browser API key storage');
  assert.ok(src.includes('/api/fk-omiya/realestate/cases'), 'must mention future server endpoint');
  assert.ok(src.includes('Cloud Run 側で Secret Manager または <code>.env</code> から読み込み'), 'must describe server-side secret handling');
  assert.ok(src.includes('キャッシュ済みデータを優先'), 'must mention cached data priority');
  assert.ok(src.includes('fallback'), 'must mention fallback');
  console.log('  PASS bridge UI copy');

  assert.ok(src.includes('function fetchMlitRealEstateCasesLite('), 'must define bridge lite function');
  assert.ok(src.includes('function renderRealestateBridgeStatus('), 'must define bridge status renderer');
  assert.ok(src.includes('const RE_MLIT_BRIDGE_ENDPOINT = \'/api/fk-omiya/realestate/cases\''), 'must define future endpoint constant');
  assert.ok(src.includes('const RE_MLIT_BRIDGE_CACHE_KEY = \'fk_omiya_realestate_cases_cache_v1\''), 'must define cache key');

  const bridgeStart = src.indexOf('async function fetchMlitRealEstateCasesLite(');
  const bridgeEnd = src.indexOf('\nfunction realestateRangeLabel', bridgeStart);
  assert.ok(bridgeStart >= 0 && bridgeEnd > bridgeStart, 'must isolate fetchMlitRealEstateCasesLite body');
  const bridgeBody = src.slice(bridgeStart, bridgeEnd);
  assert.ok(!/\bfetch\s*\(/.test(bridgeBody), 'bridge lite must not call fetch directly');
  assert.ok(!/https?:\/\//.test(bridgeBody), 'bridge lite must not hardcode external URLs');
  assert.ok(bridgeBody.includes('writeRealestateBridgeCache'), 'bridge lite should write cache');
  assert.ok(bridgeBody.includes('cloneRealestateRows'), 'bridge lite should clone rows');
  console.log('  PASS bridge implementation');

  assert.ok(src.includes('async function searchRealestate('), 'searchRealestate should be async for bridge lookup');
  assert.ok(src.includes('searchRealestate().catch'), 'init should catch bridge search errors');
  assert.ok(src.includes('renderRealestateBridgeStatus(bridge.bridge)'), 'search should render bridge status');
  assert.ok(src.includes('localStorage.setItem(RE_LS_KEY'), 'must keep mortgage handoff storage');
  assert.ok(src.includes('data-estimated-price'), 'must keep estimated price data attribute');
  assert.ok(src.includes('applyRealestateEstimateToMortgage'), 'must keep mortgage transfer button');
  console.log('  PASS existing pricing UI preserved');

  assert.ok(src.includes('SUUMO/HOME\'S などの自動取得や外部サイト巡回は行いません。'), 'must keep anti-scraping copy');
  assert.ok(!src.includes('SUUMO/HOME\'S を自動取得して'), 'must not add scraping automation wording');
  assert.ok(!src.includes('external API直叩き'), 'must not add direct external fetch wording');
  console.log('  PASS safety wording');

  console.log('\n✅ v113.3.48 FK Omiya Real Estate MLIT API Bridge Lite smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
