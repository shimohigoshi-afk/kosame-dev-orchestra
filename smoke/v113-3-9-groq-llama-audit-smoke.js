#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const PROVIDER_CONFIG_PATH = path.join(ROOT, 'providers', 'provider-config.js');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const GITIGNORE_PATH = path.join(ROOT, '.gitignore');

function freshRequire(p) {
  delete require.cache[require.resolve(p)];
  return require(p);
}

async function main() {
  console.log('=== v113.3.9 groq-llama-audit smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.9'), `version must be >= 113.3.9 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-9'], 'smoke:v113-3-9 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-9'), 'verify must include smoke:v113-3-9');
  console.log('  PASS: package wiring');

  // .env は gitignore 済み
  const gitignore = fs.readFileSync(GITIGNORE_PATH, 'utf8');
  assert.ok(gitignore.split('\n').some(l => l.trim() === '.env'), '.env must be in .gitignore');
  console.log('  PASS: .env is in .gitignore');

  // provider-config.js が GROQ_API_KEY を llamaKeyPresent に含む
  const providerSrc = fs.readFileSync(PROVIDER_CONFIG_PATH, 'utf8');
  assert.ok(providerSrc.includes('GROQ_API_KEY'), 'provider-config must reference GROQ_API_KEY');
  assert.ok(providerSrc.includes('llamaKeyPresent'), 'provider-config must still expose llamaKeyPresent');
  console.log('  PASS: provider-config.js references GROQ_API_KEY');

  // GROQ_API_KEY が llamaKeyPresent を true にする
  const savedGroq = process.env.GROQ_API_KEY;
  const savedLlama = process.env.LLAMA_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.LLAMA_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';
  delete require.cache[require.resolve(PROVIDER_CONFIG_PATH)];
  const configWithGroq = require(PROVIDER_CONFIG_PATH).getConfig();
  assert.equal(configWithGroq.llamaKeyPresent, true, 'GROQ_API_KEY must set llamaKeyPresent=true');
  delete process.env.GROQ_API_KEY;
  delete require.cache[require.resolve(PROVIDER_CONFIG_PATH)];
  const configWithout = require(PROVIDER_CONFIG_PATH).getConfig();
  assert.equal(configWithout.llamaKeyPresent, false, 'no GROQ/LLAMA key must give llamaKeyPresent=false');
  if (savedGroq !== undefined) process.env.GROQ_API_KEY = savedGroq;
  if (savedLlama !== undefined) process.env.LLAMA_API_KEY = savedLlama;
  delete require.cache[require.resolve(PROVIDER_CONFIG_PATH)];
  console.log('  PASS: GROQ_API_KEY sets llamaKeyPresent=true');

  // サーバーに .env ローダーがある
  const serverSrc = fs.readFileSync(SERVER_PATH, 'utf8');
  assert.ok(serverSrc.includes('Load .env'), 'server must have .env loader comment');
  assert.ok(serverSrc.includes("'.env'") || serverSrc.includes('".env"'), 'server must reference .env file');
  console.log('  PASS: kosame-live-cockpit-server.js loads .env');

  // HTML badge が 'OK' を表示する
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(
    html.includes("chatStatusState.llamaAudit === 'configured' ? 'OK' : 'missing'"),
    "badge must show 'OK' when llamaAudit=configured"
  );
  assert.ok(!html.includes("? 'configured' : 'missing'"), "badge must not show 'configured' text anymore");
  console.log('  PASS: Llama audit badge shows OK when configured');

  // .env がコミット対象外
  assert.ok(
    gitignore.split('\n').some(l => l.trim() === '.env'),
    '.env must remain in .gitignore (never commit API keys)'
  );
  console.log('  PASS: .env excluded from git');

  // regression
  assert.ok(html.includes('id="chat-llama-audit-badge"'), 'chat-llama-audit-badge must still exist');
  assert.ok(providerSrc.includes('llamaAuditLane'), 'llamaAuditLane must still be exported');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.9 groq-llama-audit smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
