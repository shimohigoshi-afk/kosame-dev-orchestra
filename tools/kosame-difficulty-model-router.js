#!/usr/bin/env node
'use strict';

/**
 * KOSAME Difficulty-Based Model Router v110.23.0
 *
 * タスク難易度に応じてモデルを自動選択する。
 * キー在否を確認し、フォールバックチェーンから最初の利用可能モデルを返す。
 *
 * 難易度マッピング:
 *   light  → gemini-2.5-flash / gpt-4o-mini / deepseek-chat
 *   medium → gemini-2.5-pro   / gpt-4o
 *   high   → claude-sonnet    / gpt-4o / grok-3
 *
 * Usage:
 *   npm run route:task                       # 全難易度のルーティング表を表示
 *   npm run route:task -- --difficulty=light
 *   npm run route:task -- --difficulty=high --input="実装タスクの説明"
 *   node tools/kosame-difficulty-model-router.js --difficulty=medium
 *
 * dryRun=true by default. No model is actually invoked here.
 */

const { getConfig } = require('../providers/provider-config');

const TOOL_META = {
  version: '110.23.0',
  feature: 'v110-23-difficulty-model-router',
  slug:    'kosame-difficulty-model-router',
};

// ── Difficulty routing table ──────────────────────────────────────────────────
// 各エントリは左から優先度順。keyEnv=null は常に利用可能（ローカルエージェント）。

const DIFFICULTY_ROUTING = {
  light: [
    {
      model:    'gemini-2.5-flash',
      provider: 'gemini',
      keyEnv:   'GEMINI_API_KEY',
      costTier: 'low',
      notes:    '高速・低コスト。ルーティング/ドラフト/バルク向き',
    },
    {
      model:    'gpt-4o-mini',
      provider: 'openai',
      keyEnv:   'OPENAI_API_KEY',
      costTier: 'low',
      notes:    'OpenAI 軽量モデル。Gemini 不在時のフォールバック',
    },
    {
      model:             'deepseek-chat',
      provider:          'deepseek',
      keyEnv:            'DEEPSEEK_API_KEY',
      costTier:          'very-low',
      sanitizedAdvisory: true,
      notes:             'sanitized handoff 用。出力マスク処理が適用される',
    },
  ],
  medium: [
    {
      model:    'gemini-2.5-pro',
      provider: 'gemini',
      keyEnv:   'GEMINI_API_KEY',
      costTier: 'medium',
      notes:    '中程度の複雑さ。リファクタ/設計/レビュー向き',
    },
    {
      model:    'gpt-4o',
      provider: 'openai',
      keyEnv:   'OPENAI_API_KEY',
      costTier: 'medium',
      notes:    'Gemini Pro 不在時のフォールバック',
    },
  ],
  high: [
    {
      model:    'claude-sonnet-4-6',
      provider: 'claude',
      keyEnv:   null,
      costTier: 'high',
      notes:    'ローカルエージェント。常に利用可能。高難度実装・セキュリティ向き',
    },
    {
      model:    'gpt-4o',
      provider: 'openai',
      keyEnv:   'OPENAI_API_KEY',
      costTier: 'high',
      notes:    'Claude 以外の上位モデルが必要な場合',
    },
    {
      model:    'grok-3',
      provider: 'grok',
      keyEnv:   'GROK_API_KEY',
      costTier: 'high',
      notes:    'ブレークスルー/代替アプローチが必要な高難度タスク向き',
    },
  ],
};

const DIFFICULTY_LABELS = {
  light:  '軽量  (light)',
  medium: '中程度 (medium)',
  high:   '高難度 (high)',
};

// ── Key availability ──────────────────────────────────────────────────────────

function getKeyPresenceMap() {
  const cfg = getConfig();
  return {
    GEMINI_API_KEY:    cfg.geminiKeyPresent,
    OPENAI_API_KEY:    cfg.openaiKeyPresent,
    DEEPSEEK_API_KEY:  !!(process.env.DEEPSEEK_API_KEY  && process.env.DEEPSEEK_API_KEY.length  > 0),
    KIMI_API_KEY:      !!(process.env.KIMI_API_KEY       && process.env.KIMI_API_KEY.length       > 0),
    GROK_API_KEY:      !!(process.env.GROK_API_KEY       && process.env.GROK_API_KEY.length       > 0),
    DISCORD_BOT_TOKEN: !!(process.env.DISCORD_BOT_TOKEN  && process.env.DISCORD_BOT_TOKEN.length  > 0),
  };
}

function isAvailable(candidate, keyMap) {
  if (candidate.keyEnv === null) return true;
  return keyMap[candidate.keyEnv] === true;
}

// ── Core router ───────────────────────────────────────────────────────────────

/**
 * タスク難易度からモデルを選択する。
 *
 * @param {string} difficulty  'light' | 'medium' | 'high'
 * @param {object} opts
 *   dryRun     {boolean}  default true
 *   input      {string}   タスク説明（ログ用）
 *   forceModel {string}   強制指定（テスト用）
 * @returns {object} routing decision
 */
function route(difficulty, opts = {}) {
  const { dryRun = true, input = '', forceModel = null } = opts;

  const candidates = DIFFICULTY_ROUTING[difficulty];
  if (!candidates) {
    throw new Error(`Unknown difficulty: "${difficulty}". Must be one of: ${Object.keys(DIFFICULTY_ROUTING).join(', ')}`);
  }

  const keyMap   = getKeyPresenceMap();
  const checked  = candidates.map(c => ({
    ...c,
    available: isAvailable(c, keyMap),
  }));

  let selected;
  if (forceModel) {
    selected = checked.find(c => c.model === forceModel) || checked[0];
  } else {
    selected = checked.find(c => c.available) || checked[0];
  }

  const fallbackUsed = selected !== checked[0];

  return {
    tool:       TOOL_META.slug,
    version:    TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied:     true,
    humanApprovalRequired:      false,
    difficulty,
    difficultyLabel: DIFFICULTY_LABELS[difficulty] || difficulty,
    input:       input.slice(0, 120) || '(未指定)',
    selected: {
      model:             selected.model,
      provider:          selected.provider,
      costTier:          selected.costTier,
      available:         selected.available,
      sanitizedAdvisory: selected.sanitizedAdvisory || false,
      notes:             selected.notes,
    },
    fallbackUsed,
    fallbackReason: fallbackUsed ? `優先モデル ${checked[0].model} のキーが未設定` : null,
    candidates: checked.map(c => ({
      model:     c.model,
      provider:  c.provider,
      costTier:  c.costTier,
      available: c.available,
      sanitizedAdvisory: c.sanitizedAdvisory || false,
    })),
    keyPresence: keyMap,
  };
}

/**
 * 全難易度のルーティング結果を一括取得する。
 */
function routeAll(opts = {}) {
  const results = {};
  for (const difficulty of Object.keys(DIFFICULTY_ROUTING)) {
    results[difficulty] = route(difficulty, opts);
  }
  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun:  opts.dryRun !== false,
    results,
  };
}

// ── CLI printer ───────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};
const c = (col, t) => `${C[col]}${t}${C.reset}`;

const COST_COLOR = { 'very-low': 'green', low: 'green', medium: 'yellow', high: 'red' };

function printDecision(decision) {
  const sel = decision.selected;
  const tag = sel.sanitizedAdvisory ? c('yellow', ' [sanitized-advisory]') : '';
  const avail = sel.available ? c('green', '✓') : c('red', '✗');
  const tier  = c(COST_COLOR[sel.costTier] || 'gray', sel.costTier);

  console.log(`\n  ${c('bold', DIFFICULTY_LABELS[decision.difficulty] || decision.difficulty)}`);
  console.log(`  → ${c('bold', sel.model)}  (${sel.provider})  cost: ${tier}${tag}  ${avail}`);
  console.log(`    ${c('dim', sel.notes)}`);
  if (decision.fallbackUsed) {
    console.log(`    ${c('yellow', '⚠ フォールバック:')} ${decision.fallbackReason}`);
  }

  const cands = decision.candidates;
  if (cands.length > 1) {
    console.log(`    ${c('gray', 'フォールバックチェーン:')}`);
    for (const cand of cands) {
      const mark = cand.model === sel.model ? c('cyan', '▶') : ' ';
      const avTag = cand.available ? c('green', '[KEY ✓]') : c('gray', '[KEY —]');
      const sadv  = cand.sanitizedAdvisory ? c('yellow', '[advisory]') : '';
      console.log(`      ${mark} ${cand.model.padEnd(24)} ${avTag} ${sadv}`);
    }
  }
}

function printAllRouting(all, dryRun) {
  const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Difficulty Model Router'))}  ${dryLabel}`);
  console.log(c('dim', `  v${TOOL_META.version}  —  タスク難易度ベース自動モデル選択`));

  const keyMap = all.results.light.keyPresence;
  console.log('\n  キー在否:');
  for (const [k, v] of Object.entries(keyMap)) {
    const tag = v ? c('green', '[SET]') : c('gray', '[  ]');
    console.log(`    ${tag}  ${k}`);
  }

  for (const decision of Object.values(all.results)) {
    printDecision(decision);
  }
  console.log('');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args       = argv.slice(2);
  let difficulty   = null;
  let input        = '';
  let dryRun       = true;
  let json         = false;
  for (const a of args) {
    if (a.startsWith('--difficulty=')) difficulty = a.slice(13);
    if (a.startsWith('--input='))      input      = a.slice(8);
    if (a === '--live')                dryRun     = false;
    if (a === '--json')                json       = true;
  }
  return { difficulty, input, dryRun, json };
}

function main() {
  const { difficulty, input, dryRun, json } = parseArgs(process.argv);

  if (difficulty) {
    const decision = route(difficulty, { dryRun, input });
    if (json) {
      console.log(JSON.stringify(decision, null, 2));
    } else {
      const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
      console.log(`\n${c('bold', c('blue', '⬡ KOSAME Difficulty Model Router'))}  ${dryLabel}`);
      printDecision(decision);
      console.log('');
    }
  } else {
    const all = routeAll({ dryRun });
    if (json) {
      console.log(JSON.stringify(all, null, 2));
    } else {
      printAllRouting(all, dryRun);
    }
  }
}

if (require.main === module) {
  try { main(); } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

module.exports = {
  TOOL_META,
  DIFFICULTY_ROUTING,
  route,
  routeAll,
};
