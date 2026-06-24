#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'fk-omiya-console.html');

function main() {
  console.log('=== v113.3.49 FK Omiya Real Estate Map Price Click Lite smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.49'), `version must be >= 113.3.49 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-49'], 'smoke:v113-3-49 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');
  const mapSectionStart = src.indexOf('🗺 地図クリック価格推定 Lite');
  const mapSectionEnd = src.indexOf('🧭 MLIT API Bridge Lite 設計');
  const mapSection = mapSectionStart >= 0 && mapSectionEnd > mapSectionStart
    ? src.slice(mapSectionStart, mapSectionEnd)
    : src;

  assert.ok(src.includes('id="section-realestate"'), 'must keep real estate section');
  assert.ok(src.includes('地図クリック価格推定 Lite'), 'must expose map click lite section');
  assert.ok(src.includes('外部地図API未接続のモック地図'), 'must show mock map state');
  assert.ok(src.includes('Google Maps') || src.includes('Maps JavaScript API'), 'must mention Google Maps future swap');
  assert.ok(src.includes('Leaflet + 国土地理院タイル'), 'must mention GSI/Leaflet future swap');
  assert.ok(src.includes('APIキーはブラウザに置きません'), 'must forbid browser API key storage');
  assert.ok(src.includes('査定・鑑定ではなく、公開取引データをもとにした参考推定です'), 'must show disclaimer');
  console.log('  PASS map UI copy');

  for (const label of ['大宮駅西口', '大宮駅東口', 'さいたま新都心', '北大宮', '鉄道博物館周辺', '土呂']) {
    assert.ok(src.includes(label), `must include map point: ${label}`);
  }
  assert.ok(src.includes('data-map-key="omiya-west"'), 'must include map key wiring');
  assert.ok(src.includes('onclick="selectRealestateMapPoint(\'omiya-west\')"'), 'must wire click handler');
  assert.ok(src.includes('id="re-map-mortgage-btn"'), 'must keep mortgage handoff from map');
  assert.ok(src.includes('id="re-map-region"'), 'must show selected region');
  assert.ok(src.includes('id="re-map-latlng"'), 'must show lat/lng');
  assert.ok(src.includes('id="re-map-center-price"'), 'must show estimate price');
  assert.ok(src.includes('id="re-map-range-price"'), 'must show range');
  assert.ok(src.includes('id="re-map-count"'), 'must show similar case count');
  assert.ok(src.includes('id="re-map-radius"'), 'must show radius');
  assert.ok(src.includes('id="re-map-confidence"'), 'must show confidence');
  assert.ok(src.includes('id="re-map-basis"'), 'must show basis');
  assert.ok(src.includes('id="re-map-warning"'), 'must show warning');
  console.log('  PASS map interaction wiring');

  assert.ok(src.includes('const RE_MAP_LS_KEY = \'fk_omiya_realestate_map_click_estimate_v1\''), 'must define map estimate key');
  assert.ok(src.includes('const RE_MAP_SELECTION_LS_KEY = \'fk_omiya_realestate_map_selected_point_v1\''), 'must define map selection key');
  assert.ok(src.includes('function selectRealestateMapPoint('), 'must define point selector');
  assert.ok(src.includes('function applyRealestateMapEstimateToMortgage('), 'must define map mortgage bridge');
  assert.ok(src.includes('window.__fkOmiyaRealestateMapEstimate'), 'must keep map estimate state');
  assert.ok(src.includes('localStorage.setItem(RE_MAP_SELECTION_LS_KEY'), 'must persist map selection');
  assert.ok(src.includes('localStorage.setItem(RE_LS_KEY'), 'must preserve mortgage handoff storage');
  assert.ok(src.includes('data-estimated-price="" data-estimated-center="" data-map-key="" data-map-region="" data-map-radius=""'), 'must keep data-* bridge on map button');
  console.log('  PASS localStorage and data-* wiring');

  const mapJsStart = src.indexOf('const RE_MAP_LS_KEY = \'fk_omiya_realestate_map_click_estimate_v1\'');
  const mapJsEnd = src.indexOf('function readRealestateBridgeCache()', mapJsStart);
  const mapJs = mapJsStart >= 0 && mapJsEnd > mapJsStart ? src.slice(mapJsStart, mapJsEnd) : '';
  assert.ok(mapJs, 'must isolate map JS block');
  assert.ok(!/\bfetch\s*\(/.test(mapJs), 'map JS must not call fetch directly');
  assert.ok(!/google\.maps\./.test(mapJs), 'map JS must not include Google Maps runtime calls');
  assert.ok(!/L\.map\(/.test(mapJs), 'map JS must not include Leaflet runtime calls');
  assert.ok(!/cyberjapandata\.gsi\.go\.jp/.test(mapJs), 'map JS must not hardcode GSI tile URLs');
  assert.ok(!/tile\.gsi\.go\.jp/.test(mapJs), 'map JS must not hardcode GSI tile URLs');
  console.log('  PASS no direct external map runtime');

  assert.ok(src.includes('MLIT API Bridge Lite 設計'), 'must preserve MLIT bridge design');
  assert.ok(src.includes('FK Omiya Real Estate Pricing Score Lite'), 'must preserve v113.3.48 pricing UI');
  assert.ok(src.includes('re-estimate-price'), 'must keep v113.3.47 price UI');
  assert.ok(src.includes('re-bridge-endpoint'), 'must keep v113.3.48 bridge endpoint');
  console.log('  PASS existing real-estate UI preserved');

  console.log('\n✅ v113.3.49 FK Omiya Real Estate Map Price Click Lite smoke PASSED');
}

try {
  main();
} catch (err) {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
}
