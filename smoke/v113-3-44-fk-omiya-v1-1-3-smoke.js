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
  console.log('=== v113.3.44 FK Omiya v1.1.3 smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.44'), `version >= 113.3.44 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-44'], 'smoke:v113-3-44 must exist');
  console.log('  PASS package wiring');

  const src = fs.readFileSync(HTML_PATH, 'utf8');

  // ① ログイン画面
  assert.ok(src.includes('auth-overlay'), 'must have auth-overlay');
  assert.ok(src.includes('auth-login-box'), 'must have auth-login-box');
  assert.ok(src.includes('auth-setup-box'), 'must have admin setup screen');
  assert.ok(src.includes('login-email'), 'must have login email input');
  assert.ok(src.includes('login-pw'), 'must have login password input');
  assert.ok(src.includes('doLogin()'), 'must call doLogin');
  assert.ok(src.includes('setupAdmin()'), 'must call setupAdmin');
  console.log('  PASS ① ログイン画面（初期設定・ログインフォーム）');

  // ② 認証JS関数
  assert.ok(src.includes('function initAuth('), 'must define initAuth');
  assert.ok(src.includes('function doLogin('), 'must define doLogin');
  assert.ok(src.includes('function logoutUser('), 'must define logoutUser');
  assert.ok(src.includes('function setupAdmin('), 'must define setupAdmin');
  assert.ok(src.includes('function getSession('), 'must define getSession');
  assert.ok(src.includes('function createSession('), 'must define createSession');
  assert.ok(src.includes('function hashPassword(', ), 'must define hashPassword');
  assert.ok(src.includes('PBKDF2'), 'must use PBKDF2 for hashing');
  assert.ok(src.includes('checkBruteForce('), 'must implement brute force detection');
  assert.ok(src.includes('AUTH_SESSION_TTL'), 'must define session TTL');
  assert.ok(src.includes('8 * 60 * 60 * 1000'), 'session TTL must be 8 hours');
  console.log('  PASS ② 認証JS（PBKDF2ハッシュ・セッション管理・ブルートフォース検知）');

  // ③ トップバー認証表示
  assert.ok(src.includes('topbar-user-chip'), 'must have topbar auth chip');
  assert.ok(src.includes('topbar-logout-btn'), 'must have logout button');
  assert.ok(src.includes('auth-admin-badge'), 'must have admin badge');
  assert.ok(src.includes('logoutUser()'), 'logout button must call logoutUser');
  console.log('  PASS ③ トップバー認証表示（ユーザー名・管理者バッジ・ログアウト）');

  // ④ ユーザー管理
  assert.ok(src.includes('function addUser('), 'must define addUser');
  assert.ok(src.includes('function deleteUser('), 'must define deleteUser');
  assert.ok(src.includes('function renderUserManager('), 'must define renderUserManager');
  assert.ok(src.includes('admin-panels'), 'must have admin-panels section');
  assert.ok(src.includes('new-user-email'), 'must have new user email input');
  assert.ok(src.includes('new-user-role'), 'must have role selector');
  console.log('  PASS ④ ユーザー管理（追加・削除・管理者専用パネル）');

  // ⑤ ログイン履歴・不正検知
  assert.ok(src.includes('function logLoginAttempt('), 'must define logLoginAttempt');
  assert.ok(src.includes('function renderLoginHistory('), 'must define renderLoginHistory');
  assert.ok(src.includes('auth-anomaly-box'), 'must have anomaly detection box');
  assert.ok(src.includes('login-history-list'), 'must have history list element');
  console.log('  PASS ⑤ ログイン履歴・不正アクセス検知');

  // ⑥ APIコスト見える化
  assert.ok(src.includes('function trackApiCost('), 'must define trackApiCost');
  assert.ok(src.includes('function renderCostDashboard('), 'must define renderCostDashboard');
  assert.ok(src.includes('function drawCostChart('), 'must define drawCostChart');
  assert.ok(src.includes('function downloadCostCsv('), 'must define downloadCostCsv');
  assert.ok(src.includes('function resetMonthlyCost('), 'must define resetMonthlyCost');
  assert.ok(src.includes('cost-total-yen'), 'must show total cost');
  assert.ok(src.includes('cost-budget-warning'), 'must have budget warning');
  assert.ok(src.includes('cost-daily-chart'), 'must have daily chart canvas');
  assert.ok(src.includes('cost-feature-ranking'), 'must have feature ranking');
  assert.ok(src.includes('cost-budget-input'), 'must have budget input');
  assert.ok(src.includes('function trackFeatureUse('), 'must define trackFeatureUse');
  console.log('  PASS ⑥ APIコスト見える化（内訳・グラフ・予算警告・CSV・機能ランキング）');

  // ⑦ GAS URL設定（既存強化）
  assert.ok(src.includes('cfg-gas-url'), 'must have GAS URL input');
  assert.ok(src.includes('testGasConnection'), 'must have GAS connection test');
  console.log('  PASS ⑦ GAS URL設定');

  // ⑧ 査定PDFインポートUI
  assert.ok(src.includes('function handlePdfImport('), 'must define handlePdfImport');
  assert.ok(src.includes('function renderImportedCompanies('), 'must define renderImportedCompanies');
  assert.ok(src.includes('pdf-file-input'), 'must have file input');
  assert.ok(src.includes('pdf-company-name'), 'must have company name input');
  assert.ok(src.includes('pdf-imported-list'), 'must have imported list');
  console.log('  PASS ⑧ 査定PDF取り込みUI');

  // ⑨ 国交省APIキー設定
  assert.ok(src.includes('cfg-mlit-key'), 'must have MLIT key input');
  assert.ok(src.includes('function saveMlitKey('), 'must define saveMlitKey');
  assert.ok(src.includes('mlit_api_key'), 'must store mlit_api_key');
  console.log('  PASS ⑨ 国交省APIキー設定');

  // v1.1.3 footer
  assert.ok(src.includes('v1.1.3'), 'footer must show v1.1.3');
  console.log('  PASS console version v1.1.3');

  // No secrets
  assert.ok(!src.includes('OPENAI_API_KEY'), 'no OPENAI_API_KEY');
  assert.ok(!src.includes('GROQ_API_KEY'), 'no GROQ_API_KEY');
  console.log('  PASS no secrets');

  console.log('\n✅ v113.3.44 FK Omiya v1.1.3 smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
