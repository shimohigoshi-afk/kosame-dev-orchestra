#!/usr/bin/env node
'use strict';

/**
 * KOSAME Difficulty-Based Model Router v110.24.0
 *
 * v110.23: タスク難易度に応じてモデルを自動選択する基本ルーター
 * v110.24: Cheap First Escalation + キーワードベース難易度分類を追加
 *
 * エスカレーション直列:
 *   light  → gemini-2.5-flash → (詰まったら) deepseek-chat
 *   medium → gemini-2.5-pro   → (詰まったら) grok-3
 *   high   → claude-sonnet / gpt-4o  (human_gate=true・コスト警告必須)
 *
 * キーワード判定:
 *   light  : smoke / test / fix / hotfix / patch / docs
 *   medium : 設計 / 実装 / 追加 / add / implement / build
 *   high   : deploy / 本番 / production / Secret / release / auth
 *
 * Usage:
 *   npm run route:task                              # 全難易度ルーティング表
 *   npm run route:task -- --difficulty=light
 *   npm run route:task -- --input="本番デプロイ手順"  # 自動分類 + エスカレーション計画
 *   npm run route:task -- --escalate --difficulty=medium
 *   node tools/kosame-difficulty-model-router.js --classify --input="smoke test fix"
 */

const { getConfig } = require('../providers/provider-config');

const TOOL_META = {
  version: '110.24.0',
  feature: 'v110-24-cheap-first-escalation',
  slug:    'kosame-difficulty-model-router',
};

// ── v110.23 Difficulty routing table (後方互換) ───────────────────────────────

const DIFFICULTY_ROUTING = {
  light: [
    { model: 'gemini-2.5-flash', provider: 'gemini',   keyEnv: 'GEMINI_API_KEY',   costTier: 'low',      notes: '高速・低コスト。ルーティング/ドラフト/バルク向き' },
    { model: 'gpt-4o-mini',      provider: 'openai',   keyEnv: 'OPENAI_API_KEY',   costTier: 'low',      notes: 'OpenAI 軽量モデル。Gemini 不在時のフォールバック' },
    { model: 'deepseek-chat',    provider: 'deepseek', keyEnv: 'DEEPSEEK_API_KEY', costTier: 'very-low', sanitizedAdvisory: true, notes: 'sanitized handoff 用。出力マスク処理が適用される' },
  ],
  medium: [
    { model: 'gemini-2.5-pro', provider: 'gemini', keyEnv: 'GEMINI_API_KEY', costTier: 'medium', notes: '中程度の複雑さ。リファクタ/設計/レビュー向き' },
    { model: 'gpt-4o',         provider: 'openai', keyEnv: 'OPENAI_API_KEY', costTier: 'medium', notes: 'Gemini Pro 不在時のフォールバック' },
  ],
  high: [
    { model: 'claude-sonnet-4-6', provider: 'claude', keyEnv: null,              costTier: 'high', notes: 'ローカルエージェント。常に利用可能。高難度実装・セキュリティ向き' },
    { model: 'gpt-4o',            provider: 'openai', keyEnv: 'OPENAI_API_KEY',  costTier: 'high', notes: 'Claude 以外の上位モデルが必要な場合' },
    { model: 'grok-3',            provider: 'grok',   keyEnv: 'GROK_API_KEY',    costTier: 'high', notes: 'ブレークスルー/代替アプローチが必要な高難度タスク向き' },
  ],
};

// ── v110.24 Escalation chain (Cheap First) ────────────────────────────────────
// primary → stuck → fallback の直列エスカレーション。
// high は human_gate=true + コスト警告必須。

const ESCALATION_CHAIN = {
  light: {
    humanGate:           false,
    costWarningRequired: false,
    steps: [
      { order: 1, model: 'gemini-2.5-flash', provider: 'gemini',   keyEnv: 'GEMINI_API_KEY',   role: 'primary',  sanitizedAdvisory: false },
      { order: 2, model: 'deepseek-chat',    provider: 'deepseek', keyEnv: 'DEEPSEEK_API_KEY', role: 'fallback', sanitizedAdvisory: true  },
    ],
  },
  medium: {
    humanGate:           false,
    costWarningRequired: false,
    steps: [
      { order: 1, model: 'gemini-2.5-pro', provider: 'gemini', keyEnv: 'GEMINI_API_KEY', role: 'primary',  sanitizedAdvisory: false },
      { order: 2, model: 'grok-3',         provider: 'grok',   keyEnv: 'GROK_API_KEY',   role: 'fallback', sanitizedAdvisory: false },
    ],
  },
  high: {
    humanGate:           true,
    costWarningRequired: true,
    steps: [
      { order: 1, model: 'claude-sonnet-4-6', provider: 'claude', keyEnv: null,             role: 'primary',     sanitizedAdvisory: false },
      { order: 2, model: 'gpt-4o',            provider: 'openai', keyEnv: 'OPENAI_API_KEY', role: 'alternative', sanitizedAdvisory: false },
    ],
  },
};

// ── v110.24 Keyword difficulty classifier ─────────────────────────────────────
// 高度キーワードは human_gate を強制する。

const DIFFICULTY_KEYWORDS = {
  // 高度（先に評価）
  high: [
    'deploy', 'デプロイ', '本番', 'production', 'prod',
    'secret', 'Secret', 'release', 'リリース',
    'migrate', 'migration', '移行',
    'auth', '認証', 'credential', 'key-rotation',
  ],
  // 中度
  medium: [
    '設計', '実装', '追加', 'add', 'implement', 'design',
    'build', 'create', 'refactor', 'リファクタ', '機能', 'feature',
    'update', 'upgrade', '改修',
  ],
  // 軽度
  light: [
    'smoke', 'test', 'テスト', 'fix', 'hotfix', 'patch',
    'lint', 'format', 'docs', 'readme', 'log', 'check', 'verify',
    'typo', 'comment', 'cleanup',
  ],
};

/**
 * キーワードベースで難易度を分類する。
 *
 * @param {string} input  タスク説明テキスト
 * @returns {{ difficulty, humanGate, matchedKeywords, confidence }}
 */
function classifyDifficulty(input = '') {
  const text = input.toLowerCase();

  for (const difficulty of ['high', 'medium', 'light']) {
    const matched = DIFFICULTY_KEYWORDS[difficulty].filter(kw => text.includes(kw.toLowerCase()));
    if (matched.length > 0) {
      return {
        difficulty,
        humanGate:       difficulty === 'high',
        matchedKeywords: matched,
        confidence:      matched.length >= 2 ? 'high' : 'medium',
        source:          'keyword',
      };
    }
  }

  // マッチなし → medium をデフォルト
  return {
    difficulty:      'medium',
    humanGate:       false,
    matchedKeywords: [],
    confidence:      'low',
    source:          'default',
  };
}

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

// ── v110.23 Core router (後方互換) ────────────────────────────────────────────

function route(difficulty, opts = {}) {
  const { dryRun = true, input = '', forceModel = null } = opts;

  const candidates = DIFFICULTY_ROUTING[difficulty];
  if (!candidates) {
    throw new Error(`Unknown difficulty: "${difficulty}". Must be one of: ${Object.keys(DIFFICULTY_ROUTING).join(', ')}`);
  }

  const keyMap  = getKeyPresenceMap();
  const checked = candidates.map(c => ({ ...c, available: isAvailable(c, keyMap) }));

  let selected;
  if (forceModel) {
    selected = checked.find(c => c.model === forceModel) || checked[0];
  } else {
    selected = checked.find(c => c.available) || checked[0];
  }

  const fallbackUsed = selected !== checked[0];

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied:     true,
    humanApprovalRequired:      false,
    difficulty,
    difficultyLabel: DIFFICULTY_LABELS[difficulty] || difficulty,
    input:  input.slice(0, 120) || '(未指定)',
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
      model:             c.model,
      provider:          c.provider,
      costTier:          c.costTier,
      available:         c.available,
      sanitizedAdvisory: c.sanitizedAdvisory || false,
    })),
    keyPresence: keyMap,
  };
}

function routeAll(opts = {}) {
  const results = {};
  for (const difficulty of Object.keys(DIFFICULTY_ROUTING)) {
    results[difficulty] = route(difficulty, opts);
  }
  return { tool: TOOL_META.slug, version: TOOL_META.version, dryRun: opts.dryRun !== false, results };
}

// ── v110.24 Escalation plan builder ──────────────────────────────────────────

/**
 * Cheap First エスカレーション計画を構築する。
 *
 * @param {string} difficulty  'light' | 'medium' | 'high'
 * @param {object} opts
 *   dryRun        {boolean}  default true
 *   input         {string}   タスク説明（ログ用）
 *   costEstimate  {object}   { primaryUsd, maxUsd } — cost-guard から渡す
 * @returns {object} escalation plan
 */
function buildEscalationPlan(difficulty, opts = {}) {
  const { dryRun = true, input = '', costEstimate = null } = opts;

  const chain = ESCALATION_CHAIN[difficulty];
  if (!chain) {
    throw new Error(`Unknown difficulty: "${difficulty}". Must be one of: ${Object.keys(ESCALATION_CHAIN).join(', ')}`);
  }

  const keyMap = getKeyPresenceMap();
  const steps  = chain.steps.map(s => ({
    ...s,
    available:    isAvailable(s, keyMap),
    keyEnvLabel:  s.keyEnv || '(local agent)',
  }));

  const firstAvailable = steps.find(s => s.available) || steps[0];

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied:     true,
    humanApprovalRequired:      chain.humanGate,
    difficulty,
    difficultyLabel:     DIFFICULTY_LABELS[difficulty] || difficulty,
    input:               input.slice(0, 120) || '(未指定)',
    humanGate:           chain.humanGate,
    costWarningRequired: chain.costWarningRequired,
    costEstimate:        costEstimate || null,
    startWith:           { model: firstAvailable.model, provider: firstAvailable.provider, available: firstAvailable.available },
    steps,
    keyPresence: keyMap,
  };
}

/**
 * 入力テキストを自動分類してエスカレーション計画を返す（classify + plan のワンショット）。
 */
function autoRoute(input, opts = {}) {
  const classification = classifyDifficulty(input);
  const plan           = buildEscalationPlan(classification.difficulty, { ...opts, input });
  return { classification, plan };
}

// ── CLI printer ───────────────────────────────────────────────────────────────

const DIFFICULTY_LABELS = {
  light:  '軽量  (light)',
  medium: '中程度 (medium)',
  high:   '高難度 (high)',
};

const C = {
  reset:  '\x1b[0m', bold:   '\x1b[1m', dim:    '\x1b[2m',
  green:  '\x1b[32m', yellow: '\x1b[33m', blue:   '\x1b[34m',
  cyan:   '\x1b[36m', red:    '\x1b[31m', gray:   '\x1b[90m',
};
const c = (col, t) => `${C[col]}${t}${C.reset}`;
const COST_COLOR = { 'very-low': 'green', low: 'green', medium: 'yellow', high: 'red' };

function printDecision(decision) {
  const sel = decision.selected;
  const tag   = sel.sanitizedAdvisory ? c('yellow', ' [sanitized-advisory]') : '';
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
      const mark  = cand.model === sel.model ? c('cyan', '▶') : ' ';
      const avTag = cand.available ? c('green', '[KEY ✓]') : c('gray', '[KEY —]');
      const sadv  = cand.sanitizedAdvisory ? c('yellow', '[advisory]') : '';
      console.log(`      ${mark} ${cand.model.padEnd(24)} ${avTag} ${sadv}`);
    }
  }
}

function printEscalationPlan(plan) {
  const gateTag = plan.humanGate
    ? c('red',   ' [HUMAN GATE]')
    : c('green', ' [auto]');
  const warnTag = plan.costWarningRequired ? c('yellow', ' ⚠ コスト警告必須') : '';

  console.log(`\n  ${c('bold', plan.difficultyLabel)}${gateTag}${warnTag}`);
  if (plan.input && plan.input !== '(未指定)') {
    console.log(`  ${c('dim', '入力: ' + plan.input.slice(0, 70))}`);
  }
  if (plan.costEstimate) {
    const ce = plan.costEstimate;
    console.log(`  ${c('yellow', '推定コスト:')} $${ce.primaryUsd?.toFixed(6) || '?'} 〜 $${ce.maxUsd?.toFixed(6) || '?'}`);
  }
  console.log(`  ${c('gray', 'エスカレーション直列:')}`);
  for (const step of plan.steps) {
    const mark  = step.model === plan.startWith.model ? c('cyan', '▶') : ' ';
    const avTag = step.available ? c('green', '[KEY ✓]') : c('gray', '[KEY —]');
    const sadv  = step.sanitizedAdvisory ? c('yellow', '[advisory]') : '';
    const role  = step.role === 'primary' ? '' : c('dim', ` (${step.role})`);
    console.log(`    ${mark} [${step.order}] ${step.model.padEnd(22)} ${avTag}${sadv}${role}`);
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
  for (const decision of Object.values(all.results)) printDecision(decision);
  console.log('');
}

function printEscalationTable(dryRun) {
  const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Cheap First Escalation'))}  ${dryLabel}`);
  console.log(c('dim', `  v${TOOL_META.version}  —  Cheap First エスカレーション計画`));
  for (const difficulty of Object.keys(ESCALATION_CHAIN)) {
    const plan = buildEscalationPlan(difficulty, { dryRun });
    printEscalationPlan(plan);
  }
  console.log('');
}

function printClassification(result) {
  const { classification: cl, plan } = result;
  const conf  = cl.confidence === 'high' ? c('green', cl.confidence) : cl.confidence === 'medium' ? c('yellow', cl.confidence) : c('gray', cl.confidence);
  const gate  = cl.humanGate ? c('red', '⚠ HUMAN GATE 必須') : c('green', '自動実行可');
  console.log(`\n  ${c('bold', '分類結果:')} ${c('bold', DIFFICULTY_LABELS[cl.difficulty] || cl.difficulty)}`);
  console.log(`  信頼度: ${conf}  |  ${gate}`);
  if (cl.matchedKeywords.length > 0) {
    console.log(`  マッチキーワード: ${cl.matchedKeywords.map(k => c('cyan', k)).join(', ')}`);
  } else {
    console.log(`  ${c('dim', 'キーワードマッチなし → デフォルト middle')}`);
  }
  printEscalationPlan(plan);
  console.log('');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let difficulty = null, input = '', dryRun = true, json = false;
  let escalate = false, classify = false;
  for (const a of args) {
    if (a.startsWith('--difficulty=')) difficulty = a.slice(13);
    if (a.startsWith('--input='))      input      = a.slice(8);
    if (a === '--live')                dryRun     = false;
    if (a === '--json')                json       = true;
    if (a === '--escalate')            escalate   = true;
    if (a === '--classify')            classify   = true;
  }
  return { difficulty, input, dryRun, json, escalate, classify };
}

function main() {
  const { difficulty, input, dryRun, json, escalate, classify } = parseArgs(process.argv);

  // --classify: auto-classify input and show escalation plan
  if (classify || (input && !difficulty && !escalate)) {
    const result = autoRoute(input || '(no input)', { dryRun });
    if (json) { console.log(JSON.stringify(result, null, 2)); return; }
    const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
    console.log(`\n${c('bold', c('blue', '⬡ KOSAME Auto Route'))}  ${dryLabel}`);
    printClassification(result);
    return;
  }

  // --escalate [--difficulty=X]: show escalation plan
  if (escalate) {
    if (difficulty) {
      const plan = buildEscalationPlan(difficulty, { dryRun, input });
      if (json) { console.log(JSON.stringify(plan, null, 2)); return; }
      const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
      console.log(`\n${c('bold', c('blue', '⬡ KOSAME Cheap First Escalation'))}  ${dryLabel}`);
      printEscalationPlan(plan);
      console.log('');
    } else {
      printEscalationTable(dryRun);
    }
    return;
  }

  // --difficulty=X: single difficulty routing (v110.23 互換)
  if (difficulty) {
    const decision = route(difficulty, { dryRun, input });
    if (json) { console.log(JSON.stringify(decision, null, 2)); return; }
    const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
    console.log(`\n${c('bold', c('blue', '⬡ KOSAME Difficulty Model Router'))}  ${dryLabel}`);
    printDecision(decision);
    console.log('');
    return;
  }

  // default: show full routing table (v110.23 互換)
  const all = routeAll({ dryRun });
  if (json) { console.log(JSON.stringify(all, null, 2)); return; }
  printAllRouting(all, dryRun);
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
  ESCALATION_CHAIN,
  DIFFICULTY_KEYWORDS,
  classifyDifficulty,
  buildEscalationPlan,
  autoRoute,
  route,
  routeAll,
};
