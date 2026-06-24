#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'fk-omiya-console.html');
const BRIDGE_PATH = path.join(ROOT, 'tools', 'kosame-mlit-api-bridge.js');

async function main() {
  console.log('=== v113.3.48 Real Estate MLIT API Bridge Lite smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.48'), `version >= 113.3.48 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-48'], 'smoke:v113-3-48 must exist');
  assert.ok(pkg.scripts['start:mlit-bridge'], 'start:mlit-bridge script must exist');
  console.log('  PASS package wiring');

  // ① ブリッジサーバーファイル
  assert.ok(fs.existsSync(BRIDGE_PATH), 'tools/kosame-mlit-api-bridge.js must exist');
  const bridgeSrc = fs.readFileSync(BRIDGE_PATH, 'utf8');
  assert.ok(bridgeSrc.includes('node:http'), 'bridge must use node:http');
  assert.ok(bridgeSrc.includes('node:https'), 'bridge must use node:https');
  assert.ok(bridgeSrc.includes('/api/health'), 'bridge must have /api/health endpoint');
  assert.ok(bridgeSrc.includes('/api/realestate'), 'bridge must have /api/realestate endpoint');
  assert.ok(bridgeSrc.includes('X-API-KEY'), 'bridge must send X-API-KEY header');
  assert.ok(bridgeSrc.includes('Access-Control-Allow-Origin'), 'bridge must have CORS headers');
  assert.ok(bridgeSrc.includes('reinfolib.mlit.go.jp'), 'bridge must target MLIT API');
  assert.ok(bridgeSrc.includes('normalizeMLIT'), 'bridge must normalize MLIT response');
  // API key must come from env, not be hardcoded as a literal string value
  assert.ok(!bridgeSrc.match(/MLIT_API_KEY\s*=\s*['"][^'"]{8,}/), 'bridge must not have hardcoded API key value');
  console.log('  PASS ① ブリッジサーバー（kosame-mlit-api-bridge.js）');

  // ② コンソールHTML 連携
  const src = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(src.includes('fetchMlitData'), 'must define fetchMlitData');
  assert.ok(src.includes('saveMlitBridgeUrl'), 'must define saveMlitBridgeUrl');
  assert.ok(src.includes('cfg-mlit-bridge-url'), 'must have cfg-mlit-bridge-url input');
  assert.ok(src.includes('mlit_bridge_url'), 'must store mlit_bridge_url in localStorage');
  assert.ok(src.includes('mlit-bridge-status'), 'must have mlit-bridge-status element');
  assert.ok(src.includes('MLITリアルタイム取得'), 'must have MLIT fetch button');
  console.log('  PASS ② コンソールHTML MLIT連携（fetchMlitData/ブリッジURL設定）');

  // ③ セキュリティ
  assert.ok(!src.includes('OPENAI_API_KEY'), 'no OPENAI_API_KEY in HTML');
  assert.ok(!src.includes('GROQ_API_KEY'), 'no GROQ_API_KEY in HTML');
  assert.ok(!bridgeSrc.includes('OPENAI_API_KEY'), 'no OPENAI_API_KEY in bridge');
  console.log('  PASS ③ no secrets');

  // ④ ポート競合しない（3001はLINE Bot、3002はMLITブリッジ）
  assert.ok(bridgeSrc.includes('3002'), 'bridge default port must be 3002');
  assert.ok(!bridgeSrc.includes("'3001'") && !bridgeSrc.includes('"3001"'), 'bridge must not use port 3001 (LINE Bot port)');
  console.log('  PASS ④ ポート分離（MLIT:3002、LINE Bot:3001）');

  console.log('\n✅ v113.3.48 Real Estate MLIT API Bridge Lite smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
