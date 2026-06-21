#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const PROVIDER_CONFIG_PATH = path.join(ROOT, 'providers', 'provider-config.js');
const PROVIDER_JSON_PATH   = path.join(ROOT, 'providers', 'provider-config.json');
const HTML_PATH            = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

async function main() {
  console.log('=== v113.3.10 agent-roles-asl smoke ===');

  // パッケージ wiring
  assert.ok(isVersionAtLeast(pkg.version, '113.3.10'), `version must be >= 113.3.10 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-10'], 'smoke:v113-3-10 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-10'), 'verify must include smoke:v113-3-10');
  console.log('  PASS: package wiring');

  // provider-config.json 存在 + 構造チェック
  assert.ok(fs.existsSync(PROVIDER_JSON_PATH), 'providers/provider-config.json must exist');
  const roleJson = JSON.parse(fs.readFileSync(PROVIDER_JSON_PATH, 'utf8'));
  assert.ok(roleJson.agents, 'agents key must exist');
  assert.ok(roleJson.arbiter, 'arbiter key must exist');
  assert.equal(roleJson.arbiter.primary, 'claude', 'arbiter.primary must be claude');
  assert.equal(roleJson.arbiter.fallback, 'gpt', 'arbiter.fallback must be gpt');
  assert.equal(roleJson.arbiter.userFacing, 'kosame-gpt', 'arbiter.userFacing must be kosame-gpt');

  // 全9エージェントが定義されているか
  const REQUIRED_AGENTS = ['KOSAME', 'DIRECTOR', 'DIRECTOR_FALLBACK', 'GPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Llama'];
  for (const ag of REQUIRED_AGENTS) {
    assert.ok(roleJson.agents[ag], `agents.${ag} must be defined`);
  }
  // カラー検証
  assert.equal(roleJson.agents.KOSAME.color, '#00bcd4', 'KOSAME color must be #00bcd4');
  assert.equal(roleJson.agents.DIRECTOR.color, '#00bcd4', 'DIRECTOR color must be #00bcd4');
  assert.equal(roleJson.agents.DIRECTOR_FALLBACK.color, '#10a37f', 'DIRECTOR_FALLBACK color must be #10a37f');
  assert.equal(roleJson.agents.GPT.color, '#10a37f', 'GPT color must be #10a37f');
  assert.equal(roleJson.agents.Claude.color, '#D97757', 'Claude color must be #D97757');
  assert.equal(roleJson.agents.Gemini.color, '#EA4335', 'Gemini color must be #EA4335');
  assert.equal(roleJson.agents.Grok.color, '#8899aa', 'Grok color must be #8899aa');
  assert.equal(roleJson.agents.DeepSeek.color, '#4D6BFE', 'DeepSeek color must be #4D6BFE');
  assert.equal(roleJson.agents.Llama.color, '#6e57d2', 'Llama color must be #6e57d2');
  // ロール検証
  assert.equal(roleJson.agents.KOSAME.role, 'user-facing', 'KOSAME role must be user-facing');
  assert.equal(roleJson.agents.DIRECTOR.role, 'arbiter-primary', 'DIRECTOR role must be arbiter-primary');
  assert.equal(roleJson.agents.DIRECTOR_FALLBACK.role, 'arbiter-fallback', 'DIRECTOR_FALLBACK role must be arbiter-fallback');
  assert.equal(roleJson.agents.Claude.role, 'quality', 'Claude role must be quality');
  // typingDelayMs
  assert.equal(roleJson.messageStyle.typingDelayMs, 40, 'typingDelayMs must be 40');
  console.log('  PASS: provider-config.json structure, colors, roles, arbiter');

  // provider-config.js に arbiterConfig が追加されているか
  const providerSrc = fs.readFileSync(PROVIDER_CONFIG_PATH, 'utf8');
  assert.ok(providerSrc.includes('arbiterConfig'), 'provider-config.js must export arbiterConfig');
  assert.ok(providerSrc.includes("primary: 'claude'"), 'arbiterConfig.primary must be claude');
  assert.ok(providerSrc.includes("fallback: 'gpt'"), 'arbiterConfig.fallback must be gpt');
  assert.ok(providerSrc.includes("module.exports = { getConfig, arbiterConfig }"), 'arbiterConfig must be in exports');
  // 機能テスト
  delete require.cache[require.resolve(PROVIDER_CONFIG_PATH)];
  const providerModule = require(PROVIDER_CONFIG_PATH);
  assert.ok(providerModule.arbiterConfig, 'arbiterConfig must be exported from provider-config');
  assert.equal(providerModule.arbiterConfig.primary, 'claude', 'arbiterConfig.primary must be claude');
  console.log('  PASS: provider-config.js arbiterConfig export');

  // HTML CSS: DIRECTOR and DIRECTOR-GPT classes
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(html.includes('.asl-agent-DIRECTOR     { color: #00bcd4; font-weight: bold; }'), 'DIRECTOR CSS must exist');
  assert.ok(html.includes('.asl-agent-DIRECTOR-GPT { color: #10a37f; font-weight: bold; }'), 'DIRECTOR-GPT CSS must exist');
  console.log('  PASS: HTML CSS DIRECTOR classes');

  // HTML JS: ASL_AGENTS map
  assert.ok(html.includes("'DIRECTOR':      'asl-agent-DIRECTOR'"), "ASL_AGENTS must have DIRECTOR");
  assert.ok(html.includes("'DIRECTOR(GPT)': 'asl-agent-DIRECTOR-GPT'"), "ASL_AGENTS must have DIRECTOR(GPT)");
  // 既存エージェントが残っているか
  for (const key of ['KOSAME', 'GPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Llama']) {
    assert.ok(html.includes(`'asl-agent-${key}'`) || html.includes(`"asl-agent-${key}"`), `ASL_AGENTS must still have ${key}`);
  }
  console.log('  PASS: HTML ASL_AGENTS map');

  // デモが DIRECTOR を使っているか
  assert.ok(html.includes("agent: 'DIRECTOR'"), "demo must include DIRECTOR agent");
  assert.ok(html.includes('いたします。'), 'demo DIRECTOR msg must use polite 敬語');
  console.log('  PASS: demo uses DIRECTOR agent with 敬語');

  // 全エージェントが 敬語 ベースであること確認（デモ文の基本チェック）
  assert.ok(html.includes('☂️ じゅんやさん'), 'KOSAME demo must start with ☂️');
  assert.ok(html.includes('以上。'), 'Llama demo must end with 以上。');
  assert.ok(html.includes('問題ありません🔍'), 'Claude demo must end completion with 🔍');
  assert.ok(html.includes('❤️'), 'Gemini demo must have ❤️');
  console.log('  PASS: emoji rules respected in demo');

  // regression
  assert.ok(html.includes('id="agent-stream-log"'), 'agent-stream-log must still exist');
  assert.ok(html.includes('.asl-agent-KOSAME'), 'KOSAME CSS still exists');
  assert.ok(html.includes("chatStatusState.llamaAudit === 'configured' ? 'OK' : 'missing'"), 'Llama audit badge still OK');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.10 agent-roles-asl smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
