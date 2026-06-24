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
  console.log('=== v113.3.45 FK Omiya v1.2.0 smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.45'), `version >= 113.3.45 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-45'], 'smoke:v113-3-45 must exist');
  assert.ok(pkg.scripts['start:line-bot'], 'start:line-bot script must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // ① LINE Botサーバーファイル
  const botPath = path.join(ROOT, 'tools', 'kosame-line-bot.js');
  assert.ok(fs.existsSync(botPath), 'tools/kosame-line-bot.js must exist');
  const botSrc = fs.readFileSync(botPath, 'utf8');
  assert.ok(botSrc.includes('node:http'), 'bot must use node:http');
  assert.ok(botSrc.includes('node:crypto'), 'bot must use node:crypto for HMAC');
  assert.ok(botSrc.includes('/webhook'), 'bot must handle /webhook endpoint');
  assert.ok(botSrc.includes('LINE_CHANNEL_ACCESS_TOKEN'), 'bot must read LINE_CHANNEL_ACCESS_TOKEN');
  assert.ok(botSrc.includes('runScheduler'), 'bot must have scheduler');
  console.log('  PASS ① LINE Botサーバー (kosame-line-bot.js)');

  // ② LINE セクション HTML
  assert.ok(src.includes('section-line'), 'must have section-line');
  assert.ok(src.includes('ipanel-line-customers'), 'must have customers panel');
  assert.ok(src.includes('ipanel-line-contents'), 'must have contents panel');
  assert.ok(src.includes('ipanel-line-schedule'), 'must have schedule panel');
  assert.ok(src.includes('ipanel-line-analytics'), 'must have analytics panel');
  assert.ok(src.includes('switchLineTab('), 'must call switchLineTab');
  console.log('  PASS ② LINE セクション HTML（4パネル）');

  // ③ 顧客管理JS
  assert.ok(src.includes('function loadCustomers('), 'must define loadCustomers');
  assert.ok(src.includes('function renderCustomers('), 'must define renderCustomers');
  assert.ok(src.includes('function filterCustomers('), 'must define filterCustomers');
  assert.ok(src.includes('function openCustomerEditor('), 'must define openCustomerEditor');
  assert.ok(src.includes('function saveCustomer('), 'must define saveCustomer');
  assert.ok(src.includes('cust-list'), 'must have cust-list element');
  assert.ok(src.includes('cust-search'), 'must have search input');
  assert.ok(src.includes('cust-seg-filter'), 'must have segment filter');
  console.log('  PASS ③ 顧客管理（一覧・検索・セグメント・編集）');

  // ④ コンテンツ管理JS
  assert.ok(src.includes('function loadContents('), 'must define loadContents');
  assert.ok(src.includes('function renderContents('), 'must define renderContents');
  assert.ok(src.includes('function openContentEditor('), 'must define openContentEditor');
  assert.ok(src.includes('function saveContent('), 'must define saveContent');
  assert.ok(src.includes('function deleteContent('), 'must define deleteContent');
  assert.ok(src.includes('content-list'), 'must have content-list element');
  console.log('  PASS ④ コンテンツ管理（追加・編集・削除）');

  // ⑤ 配信スケジュールJS
  assert.ok(src.includes('function loadSchedules('), 'must define loadSchedules');
  assert.ok(src.includes('function renderSchedules('), 'must define renderSchedules');
  assert.ok(src.includes('function openScheduleEditor('), 'must define openScheduleEditor');
  assert.ok(src.includes('function createSchedule('), 'must define createSchedule');
  assert.ok(src.includes('function cancelSchedule(', ), 'must define cancelSchedule');
  assert.ok(src.includes('schedule-list'), 'must have schedule-list element');
  console.log('  PASS ⑤ 配信スケジュール（作成・一覧・キャンセル）');

  // ⑥ 配信分析JS
  assert.ok(src.includes('function loadLineAnalytics('), 'must define loadLineAnalytics');
  assert.ok(src.includes('function drawLineAnalyticsChart('), 'must define drawLineAnalyticsChart');
  assert.ok(src.includes('line-analytics-chart'), 'must have chart canvas');
  assert.ok(src.includes('content-ranking'), 'must have content ranking element');
  assert.ok(src.includes('delivery-history'), 'must have delivery history element');
  console.log('  PASS ⑥ 配信分析（グラフ・ランキング・履歴）');

  // ⑦ LINE 設定JS
  assert.ok(src.includes('function saveLineSettings('), 'must define saveLineSettings');
  assert.ok(src.includes('function loadLineSettings('), 'must define loadLineSettings');
  assert.ok(src.includes('function testLineConnection('), 'must define testLineConnection');
  assert.ok(src.includes('function copyWebhookUrl('), 'must define copyWebhookUrl');
  assert.ok(src.includes('cfg-line-token'), 'must have LINE token input');
  assert.ok(src.includes('cfg-line-secret'), 'must have LINE secret input');
  assert.ok(src.includes('cfg-line-channel-id'), 'must have channel ID input');
  assert.ok(src.includes('cfg-webhook-display'), 'must have webhook URL display');
  console.log('  PASS ⑦ LINE API設定（Token・Secret・ChannelID・Webhook表示）');

  // ⑧ LINE API サーバー接続
  assert.ok(src.includes("const LINE_API = 'http://localhost:3001/api'"), 'must define LINE_API constant');
  assert.ok(src.includes('function checkLineServer('), 'must define checkLineServer');
  console.log('  PASS ⑧ LINE Bot サーバー接続チェック');

  // ⑨ .gitignore
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('data/customers.json'), '.gitignore must exclude customers.json');
  assert.ok(gitignore.includes('data/line-*.json'), '.gitignore must exclude line-*.json');
  console.log('  PASS ⑨ .gitignore（顧客・LINEデータ除外）');

  // ⑩ サイドバーナビ
  assert.ok(src.includes("section-line"), 'sidebar must link to section-line');
  assert.ok(src.includes("LINE連携・顧客フォロー"), 'SECTION_TITLES must include LINE section');
  console.log('  PASS ⑩ サイドバーナビ・セクション定義');

  // v1.2.0 footer
  assert.ok(src.includes('v1.2.0'), 'footer must show v1.2.0');
  console.log('  PASS console version v1.2.0');

  // No secrets
  assert.ok(!src.includes('OPENAI_API_KEY'), 'no OPENAI_API_KEY');
  assert.ok(!src.includes('GROQ_API_KEY'), 'no GROQ_API_KEY');
  console.log('  PASS no secrets');

  console.log('\n✅ v113.3.45 FK Omiya v1.2.0 smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
