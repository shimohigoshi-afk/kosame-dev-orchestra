#!/usr/bin/env node
'use strict';

/**
 * KOSAME IP Protection Gate v110.53.0
 *
 * 事業資産・知的財産（IP）の保護ゲート。
 * - アプリ全体設計、収益モデル、中核ロジックへの外部AIアクセスを制限
 * - 制限対象が検出された場合は HUMAN_GATE_REQUIRED を推奨
 */

const TOOL_META = {
  version: '110.53.0',
  feature: 'v110-53-ip-protection',
  slug:    'kosame-ip-protection-gate',
};

// ── 禁止パターン（知的財産・事業資産） ──────────────────────────────────────

const IP_PROTECTED_PATTERNS = [
  { label: 'app core design', regex: /アプリ(?:全体|中核)設計|中核設計|全体設計|full architecture|core architecture|overall architecture/i },
  { label: 'business model', regex: /事業モデル|収益モデル|business model|revenue model|monetization model/i },
  { label: 'billing flow', regex: /課金導線|課金(?:モデル|設計|フロー)|billing flow|subscription flow|pricing (?:model|strategy|funnel)/i },
  { label: 'customer management core', regex: /顧客管理(?:ロジック|設計|基盤)?|customer (?:management|database|crm) (?:logic|design|architecture|core)/i },
  { label: 'sales flow core', regex: /営業導線|営業(?:自動化|設計|フロー)|sales automation|lead management/i },
  { label: 'smart router core', regex: /Smart Router(?:全体|中核|core|architecture|設計)|スマートルーター(?:全体|中核|設計)/i },
  { label: 'orchestration core', regex: /orchestration(?:全体| core| architecture| design)|オーケストレーション(?:全体|中核|設計)/i },
  { label: 'ANESTY Board core', regex: /ANESTY Board core|ANESTY Board(?:中核|全体設計|アーキテクチャ)|AI役員会の中核/i },
  { label: 'KOSAME Dev Orchestra core', regex: /KOSAME Dev Orchestra core|KOSAME Dev Orchestra(?:中核|全体設計|アーキテクチャ)|開発OSの中核/i },
];

const IP_FORBIDDEN_KEYWORDS = IP_PROTECTED_PATTERNS.map(p => p.label);

const SAFE_SANITIZED_PATTERNS = [
  /(?:UI|CSS|表示|文言|レイアウト|スタイル|ボタン|フォーム).*(?:修正|微調整|調整|fix|update)/i,
  /(?:docs?|README|ドキュメント|説明|typo|誤字).*(?:修正|整形|更新|追加|fix|update)/i,
  /(?:smoke|test|テスト).*(?:追加|修正|更新|add|fix|update)/i,
  /(?:一般コード|utils?|helper|lint|format).*(?:修正|追加|更新|fix|add|update)/i,
];

// ── 保護判定 ──────────────────────────────────────────────────────────────

/**
 * テキスト内に保護対象のIPキーワードが含まれているか検出する。
 */
function detectProtectedIP(text) {
  const source = String(text || '');
  return IP_PROTECTED_PATTERNS
    .filter(({ regex }) => regex.test(source))
    .map(({ label }) => label);
}

/**
 * 外部workerに渡せる低リスクな作業タイプかを判定する。
 * 保護対象IPが検出された場合の上書き許可には使わない。
 */
function isSafeSanitizedTask(task, context = {}) {
  const fullText = [
    task.title,
    task.description || '',
    context.specText || '',
  ].join(' ');

  return SAFE_SANITIZED_PATTERNS.some(re => re.test(fullText));
}

/**
 * タスクがIP保護の観点で外部ワーカーに許可されているか判定する。
 *
 * @param {object} task - { title, description, ... }
 * @param {object} context - { specText, ... }
 * @returns {{ allowed: boolean, reason: string|null, violations: string[] }}
 */
function isIPProtectedTask(task, context = {}) {
  const fullText = [
    task.title,
    task.description || '',
    context.specText || '',
  ].join(' ');

  const violations = detectProtectedIP(fullText);

  if (violations.length > 0) {
    return {
      allowed: false,
      reason: `IP_PROTECTION_VIOLATION: Protected assets detected (${violations.slice(0, 3).join(', ')})`,
      violations,
    };
  }

  return { allowed: true, reason: null, violations: [] };
}

module.exports = {
  TOOL_META,
  IP_PROTECTED_PATTERNS,
  IP_FORBIDDEN_KEYWORDS,
  SAFE_SANITIZED_PATTERNS,
  detectProtectedIP,
  isSafeSanitizedTask,
  isIPProtectedTask,
};
