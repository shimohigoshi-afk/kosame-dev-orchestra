#!/usr/bin/env node
'use strict';

/**
 * KOSAME Worker Security Policy v110.51.0
 *
 * DeepSeek / opencode系ワーカーのセキュリティポリシー。
 * - sanitized_only: 一般コード、smoke、docs、UI表示のみ許可
 * - 禁止パス・コマンド・キーワード検出時は HUMAN_GATE_REQUIRED を返す
 * - Secret / 顧客情報 / 営業DX 領域へのアクセスを厳格に制限
 */

const TOOL_META = {
  version: '110.51.0',
  feature: 'v110-51-worker-security-policy',
  slug: 'kosame-worker-security-policy',
};

// ── 禁止対象の定義 ──────────────────────────────────────────────────────────

const FORBIDDEN_PATHS = [
  '.env',
  '.pem',
  '.key',
  'credentials.json',
  '.credentials.json',
  '/home/lavie/.claude',
  '/home/lavie/.claude/.credentials.json',
  '.kosame/provider-config.json',
];

const FORBIDDEN_COMMANDS = [
  'gcloud secrets',
  'printenv',
  'env',
  'cat .env',
  'Secret Manager',
];

const FORBIDDEN_KEYWORDS = [
  'KOSAME_API_KEY',
  'KOSAME_IDENTITY_TOKEN',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROK_API_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  '営業DX',
  'transcriber',
  '顧客情報',
  'customer_info',
  'customer_name',
  'customerinfo',
  'customerdata',
  '保険提案',
  '議事録',
  '機密',
  'secret',
  'credential',
];

// ── セキュリティチェック ──────────────────────────────────────────────────────

/**
 * テキスト内に禁止パスが含まれているか検出する。
 */
function detectForbiddenPaths(text) {
  const lower = text.toLowerCase().replace(/[\s_-]/g, '');
  return FORBIDDEN_PATHS.filter(p => lower.includes(p.toLowerCase().replace(/[\s_-]/g, '')));
}

/**
 * テキスト内に禁止コマンドが含まれているか検出する。
 */
function detectForbiddenCommands(text) {
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  return FORBIDDEN_COMMANDS.filter(c => lower.includes(c.toLowerCase()));
}

/**
 * テキスト内に機密情報に近いキーワードが含まれているか検出する。
 */
function detectSecretLikeText(text) {
  const lower = text.toLowerCase().replace(/[\s_-]/g, '');
  return FORBIDDEN_KEYWORDS.filter(k => lower.includes(k.toLowerCase().replace(/[\s_-]/g, '')));
}

/**
 * タスクが DeepSeek/opencode系ワーカーに許可されているか判定する。
 *
 * @param {object} task - { title, description, project, ... }
 * @param {object} context - { specText, ... }
 * @returns {{ allowed: boolean, reason: string|null, violations: string[] }}
 */
function isDeepSeekAllowedTask(task, context = {}) {
  const fullText = [
    task.title,
    task.description || '',
    context.specText || '',
    task.project || '',
  ].join(' ');

  const pathViolations = detectForbiddenPaths(fullText);
  const cmdViolations  = detectForbiddenCommands(fullText);
  const keyViolations  = detectSecretLikeText(fullText);

  const violations = [...pathViolations, ...cmdViolations, ...keyViolations];

  if (violations.length > 0) {
    return {
      allowed: false,
      reason: `SECURITY_VIOLATION: Forbidden content detected (${violations.slice(0, 3).join(', ')})`,
      violations,
    };
  }

  // 営業DXプロジェクト（transcriber等）は一律禁止
  if (task.project && task.project.toLowerCase() === 'transcriber') {
    return {
      allowed: false,
      reason: 'PROJECT_VIOLATION: transcriber project is forbidden for DeepSeek',
      violations: ['transcriber'],
    };
  }

  return { allowed: true, reason: null, violations: [] };
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

/**
 * ワーカーへの割り当てがセキュリティポリシーに適合するか確認し、
 * 違反がある場合は HUMAN_GATE_REQUIRED を推奨する。
 */
function validateWorkerAssignment(worker, task, context = {}) {
  const isDeepSeek = worker === 'cheap_code_worker' || worker.includes('deepseek');
  
  if (!isDeepSeek) {
    return { ok: true, humanGateRequired: false };
  }

  const check = isDeepSeekAllowedTask(task, context);
  if (!check.allowed) {
    return {
      ok: false,
      humanGateRequired: true,
      reason: check.reason,
      violations: check.violations,
    };
  }

  return { ok: true, humanGateRequired: false };
}

module.exports = {
  TOOL_META,
  FORBIDDEN_PATHS,
  FORBIDDEN_COMMANDS,
  FORBIDDEN_KEYWORDS,
  detectForbiddenPaths,
  detectForbiddenCommands,
  detectSecretLikeText,
  isDeepSeekAllowedTask,
  validateWorkerAssignment,
};
