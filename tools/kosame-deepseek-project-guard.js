'use strict';

/**
 * KOSAME DeepSeek Project Guard v110.41.0
 *
 * プロジェクト別 DeepSeek 使用制限ガード。
 * - 禁止プロジェクトからのリクエストを即ブロック
 * - 禁止キーワード検出時も即ブロック
 * - ブロック時はアメリカ系モデル（cheap_general_worker）へ自動切り替え
 *
 * 設定は ~/.kosame/provider-config.json の project_rules / forbidden_keywords で上書き可能。
 */

const TOOL_META = {
  version: '110.41.0',
  feature: 'v110-41-deepseek-project-guard',
  slug: 'kosame-deepseek-project-guard',
};

// プロジェクト別 DeepSeek ルール（デフォルト）
const DEFAULT_PROJECT_RULES = {
  'kosame-dev-orchestra': {
    deepseek: { allowed: true, restriction: 'general_code_only', description: '一般コードのみOK' },
  },
  'anesty-board': {
    deepseek: { allowed: true, restriction: 'general_code_only', description: '一般コードのみOK' },
  },
  'transcriber': {
    deepseek: { allowed: false, restriction: 'forbidden', description: '営業DX（transcriber）— 完全禁止' },
  },
};

// DeepSeek に送ってはいけないキーワード
const DEFAULT_FORBIDDEN_KEYWORDS = {
  deepseek: [
    // 顧客情報
    '顧客名', '顧客情報', 'customer_name', 'customer_info', 'customerdata',
    // 保険関連ロジック
    '保険', 'insurance',
    // プロンプト関連（独自プロンプト・temperature は社内知財）
    'プロンプト', 'temperature', '独自プロンプト', 'custom_prompt', 'system_prompt',
    // 保険関連ロジック追加
    '保険関連', 'insurance_logic', '保険料', '約款',
  ],
};

// ブロック時のフォールバック（アメリカ系モデル）
const DEEPSEEK_BLOCKED_FALLBACK = 'cheap_general_worker'; // gpt-4o-mini (OpenAI)

function mergeProjectRules(configRules) {
  const result = {};
  for (const [proj, rules] of Object.entries(DEFAULT_PROJECT_RULES)) {
    result[proj] = { ...rules };
  }
  if (configRules && typeof configRules === 'object') {
    for (const [proj, rules] of Object.entries(configRules)) {
      result[proj] = { ...(result[proj] || {}), ...rules };
    }
  }
  return result;
}

function mergeForbiddenKeywords(configKeywords) {
  const result = {};
  for (const [provider, kws] of Object.entries(DEFAULT_FORBIDDEN_KEYWORDS)) {
    result[provider] = [...kws];
  }
  if (configKeywords && typeof configKeywords === 'object') {
    for (const [provider, kws] of Object.entries(configKeywords)) {
      if (Array.isArray(kws)) {
        result[provider] = [...(result[provider] || []), ...kws];
      }
    }
  }
  return result;
}

/**
 * DeepSeek へのリクエストを許可するか判定する。
 *
 * @param {object} opts
 *   project  {string|null}  プロジェクト識別子
 *   provider {string}       'deepseek' 以外は常に allowed=true
 *   prompt   {string}       送信しようとするプロンプトテキスト
 *   config   {object}       provider-config.json の内容（project_rules / forbidden_keywords を参照）
 *
 * @returns {{ allowed, blocked, reason, fallback, hitKeywords?, projectRule? }}
 */
function checkDeepSeekGuard(opts = {}) {
  const {
    project  = null,
    provider = 'deepseek',
    prompt   = '',
    config   = {},
  } = opts;

  if (provider !== 'deepseek') {
    return { allowed: true, blocked: false, reason: null, fallback: null };
  }

  const projectRules       = mergeProjectRules(config.project_rules);
  const forbiddenKeywords  = mergeForbiddenKeywords(config.forbidden_keywords);
  const keywords           = forbiddenKeywords[provider] || [];

  // 1. プロジェクトレベルチェック
  if (project) {
    const rule = projectRules[project]?.[provider];
    if (rule && (!rule.allowed || rule.restriction === 'forbidden')) {
      return {
        allowed:     false,
        blocked:     true,
        reason:      `project "${project}" は DeepSeek 完全禁止 (${rule.description || rule.restriction})`,
        fallback:    DEEPSEEK_BLOCKED_FALLBACK,
        projectRule: rule,
      };
    }
  }

  // 2. 禁止キーワードスキャン
  const lowerPrompt = prompt.toLowerCase();
  const hitKeywords = keywords.filter(kw => lowerPrompt.includes(kw.toLowerCase()));
  if (hitKeywords.length > 0) {
    return {
      allowed:     false,
      blocked:     true,
      reason:      `禁止キーワード検出: ${hitKeywords.join(', ')}`,
      fallback:    DEEPSEEK_BLOCKED_FALLBACK,
      hitKeywords,
    };
  }

  return { allowed: true, blocked: false, reason: null, fallback: null };
}

// CLI テスト用
function main() {
  const cases = [
    { project: 'transcriber',        prompt: 'add retry logic' },
    { project: 'kosame-dev-orchestra', prompt: '保険料の計算ロジックを実装して' },
    { project: 'anesty-board',        prompt: 'sort tasks by priority' },
    { project: null,                  prompt: 'customer_name を保存する関数を作って' },
    { project: 'kosame-dev-orchestra', prompt: 'implement a binary search' },
  ];

  console.log('\n  kosame-deepseek-project-guard  v' + TOOL_META.version);
  console.log('  ' + '─'.repeat(62));

  for (const c of cases) {
    const result = checkDeepSeekGuard({ ...c, provider: 'deepseek', config: {} });
    const mark = result.blocked ? '\x1b[31m✗ BLOCK\x1b[0m' : '\x1b[32m✓ ALLOW\x1b[0m';
    console.log(`  ${mark}  project="${c.project ?? '(none)'}"  prompt="${c.prompt.slice(0, 40)}"`);
    if (result.blocked) console.log(`         reason: ${result.reason}  → ${result.fallback}`);
  }
  console.log('');
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DEFAULT_PROJECT_RULES,
  DEFAULT_FORBIDDEN_KEYWORDS,
  DEEPSEEK_BLOCKED_FALLBACK,
  checkDeepSeekGuard,
};
