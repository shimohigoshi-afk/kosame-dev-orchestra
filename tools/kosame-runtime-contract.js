'use strict';

/**
 * KOSAME Runtime Contract v110.84.31
 *
 * defaultDecision: YES — normalTask はユーザー確認不要で続行。
 * Safety Stop 対象のみ実行を停止する。
 * Safety Stop 以外の wait_for_user / human_wait は失敗扱い。
 *
 * Safety Stop トリガー:
 *   secret                   — API key / token / credential / .env
 *   production_deploy        — 本番 deploy (gcloud run deploy 等)
 *   billing                  — 課金 / subscription / stripe
 *   force_push               — git push --force
 *   mass_delete              — rm -rf / DROP TABLE / 全削除
 *   target_repo_change       — 対象 repo / ALLOWED_TARGET_REPOS 変更
 *   customer_data_external_send — 顧客情報の外部送信
 */

const fs   = require('node:fs');
const path = require('node:path');

const CONTRACT_PATH = path.resolve(__dirname, '../config/kosame-runtime-contract.json');

// ── Safety Stop パターン ──────────────────────────────────────────────────────

const SAFETY_STOP_PATTERNS = {
  secret:
    /(?:api[_-]?key|token|secret|credential|password|\.env\b|credentials?)/i,
  production_deploy:
    /(?:(?:本番|production|prod)[^a-z]*deploy|gcloud run deploy|deploy[^a-z]*(?:本番|production|prod))/i,
  billing:
    /(?:billing|subscription|stripe|revenue model|課金|決済|請求)/i,
  force_push:
    /(?:git push[^|&\n]*--force|--force[^|&\n]*push|push[^|&\n]*-f\b)/i,
  mass_delete:
    /(?:rm\s+-[rf]{1,2}\s+[^;|&\n]{2,}|git clean\s+-[fd]{1,2}|DROP\s+(?:TABLE|DATABASE)|TRUNCATE\b|全(?:削除|消去))/i,
  target_repo_change:
    /(?:target_repo\s*[=:→]|ALLOWED_TARGET_REPOS|対象.{0,15}(?:repo|リポ)|(?:repo|リポ).{0,15}変更)/i,
  customer_data_external_send:
    /(?:顧客.{0,30}(?:送信|外部|upload)|customer.{0,30}(?:send|external|upload)|個人情報.{0,30}送信)/i,
};

// ── Helper ────────────────────────────────────────────────────────────────────

function loadContract() {
  return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
}

/**
 * Safety Stop に該当するかチェック。
 * @param {string} text
 * @returns {{ detected: boolean, triggers: string[] }}
 */
function isSafetyStop(text) {
  const src = String(text || '');
  const triggers = [];
  for (const [name, pattern] of Object.entries(SAFETY_STOP_PATTERNS)) {
    if (pattern.test(src)) triggers.push(name);
  }
  return { detected: triggers.length > 0, triggers };
}

// ── Main contract check ───────────────────────────────────────────────────────

/**
 * Runtime Contract チェック。
 *
 * @param {object} opts
 *   action        {string}   チェック対象のテキスト（コマンド / プロンプト等）
 *   isWaitForUser {boolean}  wait_for_user / human_wait イベントの場合 true
 * @returns {{ decision: 'YES'|'STOP'|'FAILURE', reason: string, triggers: string[] }}
 */
function checkRuntimeContract({ action = '', isWaitForUser = false } = {}) {
  const contract  = loadContract();
  const safetyCheck = isSafetyStop(action);

  // Safety Stop が検出されたら即停止（wait_for_user より優先）
  if (safetyCheck.detected) {
    return {
      decision: 'STOP',
      reason:   `Safety Stop triggered: ${safetyCheck.triggers.join(', ')}`,
      triggers: safetyCheck.triggers,
    };
  }

  // Safety Stop 以外の wait_for_user / human_wait は失敗扱い
  if (isWaitForUser) {
    return {
      decision: 'FAILURE',
      reason:   'wait_for_user / human_wait outside Safety Stop — treated as failure per runtime contract',
      triggers: [],
    };
  }

  // normalTask — defaultDecision (YES) で続行
  return {
    decision: contract.defaultDecision,
    reason:   'normalTask: no confirmation required',
    triggers: [],
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  loadContract,
  isSafetyStop,
  checkRuntimeContract,
  SAFETY_STOP_PATTERNS,
  CONTRACT_PATH,
};
