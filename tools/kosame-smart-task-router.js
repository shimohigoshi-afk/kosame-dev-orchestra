#!/usr/bin/env node
'use strict';

/**
 * KOSAME Smart Task Router v110.54.0
 *
 * タスクを難易度・リスク・機密性に応じて最適なAIワーカーに自動ルーティング。
 * kosame-auto-dev と統合し、Claude Code 固定を廃止。
 *
 * 【ルーティングポリシー】
 *   light/単純   → cheap_code_worker (DeepSeek) / general_worker (Gemini Flash)
 *   medium/一般  → general_worker → 失敗時 cheap_general_worker / claude_haiku
 *   high/複雑    → gpt_upper 裁定 → Claude Code / GPT 実装補助
 *   最終品質     → claude_sonnet（温存）
 *   営業DX       → DeepSeek 禁止・許可済みモデルのみ
 *   cost ledger  → Cheap First / Expensive Last の推奨と台帳記録
 *
 * 【3モード】
 *   --simple   : ルールベース分解のみ（最速・最安）
 *   --smart    : GPT が設計書を読んで担当割りを裁定（デフォルト）
 *   --council  : GPT+Claude で協議してから分解（重要案件用）
 *
 * 【GPT裁定が必要な条件】
 *   - 設計書が曖昧
 *   - 複数 repo にまたがる
 *   - 営業DX・秘密情報に近い
 *   - 失敗が2回以上続く
 *   - 本番影響がある
 *
 * Usage:
 *   npm run smart:route -- --spec="設計書テキスト"
 *   npm run smart:route -- --file=./spec.md --mode=council
 *   npm run smart:route -- --spec="..." --json
 */

const TOOL_META = {
  version:       '110.54.0',
  feature:       'v110-54-cost-token-ledger',
  slug:          'kosame-smart-task-router',
  dryRunDefault: true,
};

const costLedger = require('./kosame-cost-token-ledger');

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m', bold:    '\x1b[1m', dim:    '\x1b[2m',
  green:   '\x1b[32m', yellow: '\x1b[33m', blue:   '\x1b[34m',
  cyan:    '\x1b[36m', red:    '\x1b[31m', magenta:'\x1b[35m',
  gray:    '\x1b[90m', bgRed:  '\x1b[41m', bgGreen:'\x1b[42m',
  bgYellow:'\x1b[43m',
};
const c  = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (n = 64)  => '─'.repeat(n);

// ── Routing policy table ──────────────────────────────────────────────────────
//
// variant: 'default' | 'salesDx' | 'confidential'
//
// primary  : 最初に試みるワーカー
// fallback : 失敗時に使うワーカー（auto-dev の cheapFirstRun 連鎖先）
// reason   : ダッシュボード表示用の理由（なぜこのAIか）

const ROUTING_TABLE = {
  light: {
    default:      { primary: 'cheap_code_worker',    fallback: 'general_worker',       reason: 'light/単純 → DeepSeek / Gemini Flash（最安）'      },
    salesDx:      { primary: 'cheap_general_worker', fallback: 'general_worker',       reason: 'light × 営業DX → DeepSeek禁止 → GPT-mini'         },
    confidential: { primary: 'general_worker',       fallback: 'cheap_general_worker', reason: 'light × 機密 → DeepSeek禁止 → Gemini Flash'        },
  },
  medium: {
    default:      { primary: 'general_worker',       fallback: 'claude_haiku',         reason: 'medium/一般 → Gemini Flash → Claude Haiku'         },
    salesDx:      { primary: 'general_worker',       fallback: 'claude_haiku',         reason: 'medium × 営業DX → DeepSeek禁止 → Gemini Flash'     },
    confidential: { primary: 'general_worker',       fallback: 'claude_haiku',         reason: 'medium × 機密 → Gemini Flash → Claude Haiku'       },
  },
  high: {
    default:      { primary: 'gpt_upper',            fallback: 'claude_sonnet',        reason: 'high/複雑 → GPT-4o 裁定 → Claude Code / GPT補助'  },
    salesDx:      { primary: 'gpt_upper',            fallback: 'claude_sonnet',        reason: 'high × 営業DX → GPT-4o 裁定（DeepSeek禁止）'      },
    confidential: { primary: 'gpt_upper',            fallback: 'claude_sonnet',        reason: 'high × 機密 → GPT-4o 裁定（DeepSeek禁止）'        },
  },
  quality: {
    default:      { primary: 'claude_sonnet',        fallback: 'gpt_upper',            reason: '最終品質チェック → Claude Sonnet 温存'             },
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SALES_DX_PROJECTS = new Set(['transcriber', 'sales-dx', 'anesty-sales', 'sales', 'crm']);

const SALES_DX_KEYWORDS = [
  '営業', 'sales', 'transcriber', 'crm', '顧客', 'customer',
  'outreach', 'pitch', 'アポ', '商談', '見込み客', '営業dx',
];

const MULTI_REPO_RE    = /\b(cross.?repo|別.?repo|複数.?repo|multiple.?repo|他.?リポジトリ)\b/i;
const PROD_IMPACT_RE   = /\b(本番|production|prod|deploy|リリース|release|migrat|データベース.*(本番|prod)|本番.*データ)\b/i;
const AMBIGUOUS_RE     = /\b(未定|TBD|TODO|検討|要確認|unclear|ambiguous|後で|あとで|仮|不明)\b/i;
const CONFIDENTIAL_RE  = /\b(機密|confidential|秘密|secret|顧客情報|customer.?data|個人情報|PII|jwt|auth.*token|api.?key)\b/i;

const WORKER_META = {
  cheap_code_worker:    { label: 'DeepSeek (sanitized_only)', color: 'cyan',    provider: 'deepseek'   },
  cheap_general_worker: { label: 'GPT-mini',        color: 'yellow',  provider: 'openai'     },
  general_worker:       { label: 'Gemini Flash',    color: 'blue',    provider: 'gemini'     },
  code_pro_worker:      { label: 'Claude Haiku',    color: 'magenta', provider: 'anthropic'  },
  claude_haiku:         { label: 'Claude Haiku',    color: 'magenta', provider: 'anthropic'  },
  gpt_upper:            { label: 'GPT-4o',          color: 'yellow',  provider: 'openai'     },
  claude_sonnet:        { label: 'Claude Sonnet',   color: 'green',   provider: 'anthropic'  },
  claude_code:          { label: 'Claude Code CLI', color: 'green',   provider: 'anthropic'  },
};

// ── Task classification ───────────────────────────────────────────────────────

/**
 * タスクに属性を付与する（API呼び出しなし）。
 *
 * @param {object} task         - { id, title, description, difficulty, ... }
 * @param {object} opts
 *   project      {string}  プロジェクト識別子
 *   specText     {string}  設計書全文（先頭500文字で判定）
 *   failureCount {number}  連続失敗回数
 * @returns {object} 属性付き task
 */
function classifyTask(task, opts = {}) {
  const { project = null, specText = '', failureCount = 0 } = opts;

  // タスク固有テキスト（salesDx / confidential / multi-repo はタスク単位で判定）
  const taskText = [task.title, task.description || ''].join(' ');
  const taskLc   = taskText.toLowerCase();

  // 設計書全体コンテキスト（ambiguous / prodImpact は広域判定OK）
  const fullText = [taskText, specText.slice(0, 500)].join(' ');

  const isSalesDx = (project && SALES_DX_PROJECTS.has(project.toLowerCase()))
    || SALES_DX_KEYWORDS.some(kw => taskLc.includes(kw.toLowerCase()));

  return {
    ...task,
    isSalesDx,
    isMultiRepo:    MULTI_REPO_RE.test(taskText),
    hasProdImpact:  PROD_IMPACT_RE.test(fullText),
    isAmbiguous:    AMBIGUOUS_RE.test(fullText),
    isConfidential: CONFIDENTIAL_RE.test(taskText),
    failureCount,
    repo:       task.repo   || project || null,
    file_scope: task.file_scope || task.files || [],
  };
}

function attachCostPolicy(task, result, context = {}) {
  return {
    ...result,
    costPolicy: costLedger.buildLedgerRecord(task, {
      verifyRunCount: task.failureCount || 0,
      ...context,
    }),
  };
}

// ── GPT arbiter need check ────────────────────────────────────────────────────

/**
 * GPT 裁定が必要かどうかを判定する（API呼び出しなし）。
 *
 * @param {object} task - classified task (from classifyTask)
 * @returns {{ needed: boolean, reasons: string[] }}
 */
function gptArbiterNeeded(task) {
  const reasons = [];

  if (task.isAmbiguous)              reasons.push('設計書が曖昧');
  if (task.isMultiRepo)              reasons.push('複数repoにまたがる');
  if (task.isSalesDx)                reasons.push('営業DX案件');
  if (task.isConfidential)           reasons.push('機密情報に近い');
  if ((task.failureCount || 0) >= 2) reasons.push(`連続失敗 ${task.failureCount} 回`);
  if (task.hasProdImpact)            reasons.push('本番影響あり');
  if (task.difficulty === 'high')    reasons.push('難易度 high');

  return { needed: reasons.length > 0, reasons };
}

// ── Rule-based worker assignment ──────────────────────────────────────────────

/**
 * ルールベースでワーカーを割り当てる（GPT呼び出しなし）。
 *
 * @param {object} task - classified task
 * @returns {{ primary, fallback, reason, variant, deepseekBlocked }}
 */
function assignWorkerByRules(task, context = {}) {
  const security = require('./kosame-worker-security-policy');

  // 最終品質チェックタスク
  if (task.isQualityCheck || task.type === 'quality') {
    return attachCostPolicy(task, { ...ROUTING_TABLE.quality.default, variant: 'quality', deepseekBlocked: false }, context);
  }

  const diff = task.difficulty || 'medium';

  let variant = 'default';
  if (task.isSalesDx)           variant = 'salesDx';
  else if (task.isConfidential) variant = 'confidential';

  const tier   = ROUTING_TABLE[diff] || ROUTING_TABLE.medium;
  const policy = tier[variant] || tier.default;

  // DeepSeek 禁止チェック（営業DX・機密はcheap_code_worker禁止）
  let primary = policy.primary;
  let reason  = policy.reason;
  
  const isDeepSeek = primary === 'cheap_code_worker' || (primary && primary.includes('deepseek'));
  const deepseekBlocked = isDeepSeek && (task.isSalesDx || task.isConfidential);

  // v110.51/v110.52: セキュリティポリシーによる詳細チェック（全ワーカー対象）
  const secCheck = security.validateWorkerAssignment(primary, task, context);
  if (secCheck.humanGateRequired) {
    const newPrimary = isDeepSeek ? (policy.fallback || 'general_worker') : primary;
    return attachCostPolicy(task, {
      primary:        newPrimary,
      fallback:       policy.fallback || 'general_worker',
      reason:         `${policy.reason} → セキュリティ制限: ${secCheck.reason}`,
      variant,
      deepseekBlocked: isDeepSeek,
      humanGate:      true,
      securityViolation: secCheck.violations,
    }, context);
  }

  // DeepSeek ブロック時は safe フォールバックへ
  if (deepseekBlocked) {
    const safe = tier.salesDx || tier.default;
    return attachCostPolicy(task, {
      primary:        safe.fallback || 'cheap_general_worker',
      fallback:       safe.fallback || 'general_worker',
      reason:         `${policy.reason} → DeepSeek禁止 → ${safe.fallback}`,
      variant,
      deepseekBlocked: true,
    }, context);
  }

  return attachCostPolicy(task, {
    primary:        policy.primary,
    fallback:       policy.fallback,
    reason:         policy.reason,
    variant,
    deepseekBlocked: false,
  }, context);
}

// ── GPT assignment (smart mode) ───────────────────────────────────────────────

/**
 * GPT にタスクのワーカー割り当てを裁定させる。
 * dryRun の場合はルールベース結果を返す（API呼び出しなし）。
 *
 * @param {object} task          - classified task
 * @param {string[]} reasons     - gptArbiterNeeded から得た理由リスト
 * @param {object} config        - provider config
 * @param {object} opts
 * @returns {{ primary, fallback, reason, method, dryRun }}
 */
async function askGptForAssignment(task, reasons, config, opts = {}) {
  const { dryRun = true } = opts;

  if (dryRun) {
    const rules = assignWorkerByRules(task, { specText: task.specText || '' });
    return {
      dryRun:   true,
      primary:  rules.primary,
      fallback: rules.fallback,
      reason:   `[DRY-RUN] GPT裁定スキップ → ルールベース: ${rules.reason}`,
      method:   'rule_dryrun',
      costPolicy: rules.costPolicy,
    };
  }

  const { callModel } = require('./kosame-cheap-first-runtime');

  const workerChoices = [
    'cheap_code_worker (DeepSeek — 最安)',
    'cheap_general_worker (GPT-mini — 軽量汎用)',
    'general_worker (Gemini Flash — 中品質汎用)',
    'claude_haiku (Claude Haiku — 高品質軽量)',
    'gpt_upper (GPT-4o — 高品質・設計)',
    'claude_sonnet (Claude Sonnet — 最高品質)',
    'claude_code (Claude Code CLI — 実装特化)',
  ].join('\n');

  const prompt = [
    '以下のタスクを担当するAIワーカーを1つ選んでください。',
    '',
    `タスク: ${task.title}`,
    task.description ? `説明: ${task.description.slice(0, 200)}` : '',
    `難易度: ${task.difficulty || 'medium'}`,
    `営業DX: ${task.isSalesDx   ? 'あり（cheap_code_worker禁止）' : 'なし'}`,
    `機密性: ${task.isConfidential ? '機密あり（cheap_code_worker禁止）' : '非機密'}`,
    `本番影響: ${task.hasProdImpact ? 'あり' : 'なし'}`,
    `裁定理由: ${reasons.join(', ')}`,
    '',
    '選択肢:',
    workerChoices,
    '',
    '回答形式（JSONのみ）: {"worker": "<worker_name>", "reason": "<選択理由 30字以内>"}',
  ].filter(Boolean).join('\n');

  try {
    const result = await callModel('gpt_upper', prompt, config, { maxTokens: 150 });
    const m = result.response.match(/\{[\s\S]*?\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (parsed.worker && WORKER_META[parsed.worker]) {
        const fallback = assignWorkerByRules(task).fallback;
        return {
          dryRun:   false,
          primary:  parsed.worker,
          fallback,
          reason:   `GPT裁定: ${parsed.reason || parsed.worker}`,
          method:   'gpt_arbiter',
          costPolicy: costLedger.buildLedgerRecord(task, { verifyRunCount: task.failureCount || 0 }),
        };
      }
    }
  } catch (_) {
    // fall through to rules
  }

  const rules = assignWorkerByRules(task, { specText: task.specText || '' });
  return {
    dryRun:   false,
    primary:  rules.primary,
    fallback: rules.fallback,
    reason:   `GPT裁定失敗 → ルールベース: ${rules.reason}`,
    method:   'rule_fallback',
    costPolicy: rules.costPolicy,
  };
}

// ── Council decision (council mode) ──────────────────────────────────────────

/**
 * GPT + Claude 双方に割り当てを依頼し、合意を採用する。
 * dryRun の場合はルールベース結果を返す（API呼び出しなし）。
 *
 * @param {object} task    - classified task
 * @param {string[]} reasons
 * @param {object} config
 * @param {object} opts
 * @returns {{ primary, fallback, reason, method, gptVote, claudeVote, dryRun }}
 */
async function councilDecide(task, reasons, config, opts = {}) {
  const { dryRun = true } = opts;

  if (dryRun) {
    const rules = assignWorkerByRules(task);
    return {
      dryRun:    true,
      primary:   rules.primary,
      fallback:  rules.fallback,
      reason:    `[DRY-RUN] Council協議スキップ → ルールベース: ${rules.reason}`,
      method:    'rule_dryrun',
      gptVote:   null,
      claudeVote:null,
      costPolicy: rules.costPolicy,
    };
  }

  const { callModel } = require('./kosame-cheap-first-runtime');

  const makePrompt = () => [
    '以下のタスクを担当するAIワーカーを1つ選んでください。',
    `タスク: ${task.title}  難易度: ${task.difficulty || 'medium'}`,
    `営業DX: ${task.isSalesDx ? 'あり（cheap_code_worker禁止）' : 'なし'}  本番影響: ${task.hasProdImpact ? 'あり' : 'なし'}`,
    `裁定理由: ${reasons.join(', ')}`,
    '',
    '回答形式（JSONのみ）: {"worker": "<worker_name>", "reason": "<30字以内>"}',
    '選択肢: cheap_code_worker / cheap_general_worker / general_worker / claude_haiku / gpt_upper / claude_sonnet / claude_code',
  ].join('\n');

  const [gptRaw, claudeRaw] = await Promise.allSettled([
    callModel('gpt_upper',    makePrompt(), config, { maxTokens: 120 }),
    callModel('claude_sonnet', makePrompt(), config, { maxTokens: 120 }),
  ]);

  function parseVote(raw) {
    if (raw.status !== 'fulfilled') return null;
    const m = raw.value.response.match(/\{[\s\S]*?\}/);
    if (!m) return null;
    try {
      const parsed = JSON.parse(m[0]);
      return WORKER_META[parsed.worker] ? parsed : null;
    } catch (_) { return null; }
  }

  const gptVote    = parseVote(gptRaw);
  const claudeVote = parseVote(claudeRaw);
  const fallback   = assignWorkerByRules(task).fallback;

  let primary, reason, method;

  if (gptVote?.worker && claudeVote?.worker && gptVote.worker === claudeVote.worker) {
    primary = gptVote.worker;
    reason  = `Council合意: ${gptVote.reason}`;
    method  = 'council_unanimous';
  } else if (gptVote?.worker || claudeVote?.worker) {
    // 不一致時は安全側（Claude 優先）
    const adopted = claudeVote ?? gptVote;
    const src     = claudeVote ? 'Claude' : 'GPT';
    primary = adopted.worker;
    reason  = `Council不一致 → ${src}採用: ${adopted.reason}`;
    method  = 'council_split';
  } else {
    const rules = assignWorkerByRules(task);
    primary = rules.primary;
    reason  = `Council失敗 → ルールベース: ${rules.reason}`;
    method  = 'rule_fallback';
  }

  return {
    dryRun: false,
    primary,
    fallback,
    reason,
    method,
    gptVote,
    claudeVote,
    costPolicy: costLedger.buildLedgerRecord(task, { verifyRunCount: task.failureCount || 0 }),
  };
}

// ── Main assign worker ────────────────────────────────────────────────────────

/**
 * タスクにワーカーを割り当てる（モード対応）。
 * このルーターの主要エントリポイント。
 *
 * @param {object} task - raw task または classifyTask 済み task
 * @param {object} opts
 *   mode     {string}  'simple' | 'smart' | 'council'  (default: 'smart')
 *   dryRun   {boolean}
 *   config   {object}  provider config (省略時は readConfig() で読み込み)
 *   project  {string}  プロジェクト識別子
 *   specText {string}  設計書テキスト（分類精度向上）
 *   failureCount {number}
 * @returns {{ primary, fallback, reason, method, needsGptArbiter, arbiterReasons, dryRun }}
 */
async function assignWorker(task, opts = {}) {
  const {
    mode         = 'smart',
    dryRun       = true,
    config       = null,
    project      = null,
    specText     = '',
    failureCount = 0,
  } = opts;

  // 分類済みでなければ分類
  const classified = (task.isSalesDx !== undefined)
    ? task
    : classifyTask(task, { project, specText, failureCount });

  const arbiter = gptArbiterNeeded(classified);

  // simple: ルールベースのみ
  if (mode === 'simple') {
    return {
      ...assignWorkerByRules(classified),
      method:          'rule_simple',
      needsGptArbiter: false,
      arbiterReasons:  [],
      dryRun,
    };
  }

  // council: GPT + Claude 協議
  if (mode === 'council') {
    const { readConfig } = require('./kosame-cheap-first-runtime');
    const cfg = config || readConfig();
    const decision = await councilDecide(classified, arbiter.reasons, cfg, { dryRun });
    return {
      ...decision,
      needsGptArbiter: true,
      arbiterReasons:  arbiter.reasons,
    };
  }

  // smart (default): 裁定条件を満たす場合のみ GPT 呼び出し
  if (arbiter.needed) {
    const { readConfig } = require('./kosame-cheap-first-runtime');
    const cfg = config || readConfig();
    const decision = await askGptForAssignment({ ...classified, specText }, arbiter.reasons, cfg, { dryRun });
    return {
      ...decision,
      needsGptArbiter: true,
      arbiterReasons:  arbiter.reasons,
    };
  }

  // smart: 裁定不要 → ルールベース
  return {
    ...assignWorkerByRules(classified, { specText }),
    method:          'rule',
    needsGptArbiter: false,
    arbiterReasons:  [],
    dryRun,
  };
}

// ── Route entire spec ─────────────────────────────────────────────────────────

/**
 * タスクリスト全体をルーティングし、アサインテーブルを返す。
 *
 * @param {object[]} tasks
 * @param {object}   opts - { mode, dryRun, project, config, specText, failureCounts }
 * @returns {object[]} tasks with .assignment property
 */
async function routeSpec(tasks, opts = {}) {
  const {
    mode          = 'smart',
    dryRun        = true,
    project       = null,
    config        = null,
    specText      = '',
    failureCounts = {},
  } = opts;

  const results = [];

  for (const task of tasks) {
    const classified = classifyTask(task, {
      project,
      specText,
      failureCount: failureCounts[task.id] || 0,
    });

    const assignment = await assignWorker(classified, { mode, dryRun, config, project, specText });

    results.push({ ...classified, assignment });
  }

  return results;
}

// ── Dashboard display ─────────────────────────────────────────────────────────

function workerLabel(workerName) {
  const d = WORKER_META[workerName];
  if (!d) return c('dim', workerName);
  return c(d.color, d.label);
}

/**
 * ルーティング結果をダッシュボード形式で表示する。
 * 「なぜこのAIが担当か」を各タスクに明示。
 *
 * @param {object[]} routedTasks - routeSpec の返り値
 * @param {object}   opts        - { mode, dryRun }
 */
function printDashboard(routedTasks, opts = {}) {
  const { mode = 'smart', dryRun = true } = opts;

  const dryLabel = dryRun ? c('yellow', '[DRY-RUN]') : c('green', '[LIVE]');
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Smart Task Router'))}  ${dryLabel}  v${TOOL_META.version}  mode: ${c('cyan', mode)}`);
  console.log('  ' + hr(72));

  console.log(`  ${'ID'.padEnd(7)}${'タスク'.padEnd(28)}${'担当AI'.padEnd(20)}理由`);
  console.log('  ' + hr(72));

  let humanGateCount  = 0;
  let deepseekCount   = 0;
  let gptArbiterCount = 0;
  let salesDxCount    = 0;

  for (const t of routedTasks) {
    const { assignment } = t;
    const idStr    = (t.id || '?').slice(0, 6).padEnd(7);
    const titleStr = (t.title || '').slice(0, 26).padEnd(28);
    const wLabel   = workerLabel(assignment.primary).padEnd(20 + 9); // +9 for ANSI escape codes
    const arbTag   = assignment.needsGptArbiter ? c('dim', '★裁') : '  ';
    const sdxTag   = t.isSalesDx        ? c('red',    ' DX') : '';
    const prodTag  = t.hasProdImpact    ? c('red',    ' 本番') : '';

    const reasonStr = assignment.reason.slice(0, 38);
    const arbReasons = assignment.arbiterReasons?.length > 0
      ? c('dim', ` [${assignment.arbiterReasons.slice(0, 2).join('/')}]`)
      : '';

    console.log(`  ${idStr}${titleStr}${wLabel}${arbTag}${sdxTag}${prodTag}  ${reasonStr}${arbReasons}`);

    if (t.difficulty === 'high' || t.humanGate)         humanGateCount++;
    if (assignment.primary === 'cheap_code_worker')     deepseekCount++;
    if (assignment.needsGptArbiter)                     gptArbiterCount++;
    if (t.isSalesDx)                                    salesDxCount++;
  }

  console.log('  ' + hr(72));

  const parts = [
    `総タスク: ${c('bold', String(routedTasks.length))}`,
    humanGateCount  > 0 ? c('red',    `HUMAN GATE: ${humanGateCount}`)      : null,
    salesDxCount    > 0 ? c('red',    `営業DX: ${salesDxCount}`)            : null,
    deepseekCount   > 0 ? c('cyan',   `DeepSeek: ${deepseekCount}`)         : null,
    gptArbiterCount > 0 ? c('yellow', `GPT裁定: ${gptArbiterCount}`)        : null,
  ].filter(Boolean);

  console.log(`  ${parts.join('  ')}`);
  console.log('');
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * 設計書テキストからタスクを分解し、全タスクをルーティングしてダッシュボード表示する。
 *
 * @param {string} specText
 * @param {object} opts - { mode, dryRun, project, jsonMode, maxTasks, silent }
 * @returns {object} run result
 */
async function runSmartRouter(specText, opts = {}) {
  const {
    mode     = 'smart',
    dryRun   = true,
    project  = null,
    jsonMode = false,
    maxTasks = 50,
    silent   = false,
  } = opts;

  const { analyzeSpec } = require('./kosame-spec-analyzer');
  const { readConfig  } = require('./kosame-cheap-first-runtime');
  const config = readConfig();

  const analysis  = analyzeSpec(specText, { dryRun, maxTasks });
  const leafTasks = analysis.tasks.filter(t => t.isLeaf !== false);

  const routedTasks = await routeSpec(leafTasks, {
    mode, dryRun, project, config, specText,
  });

  if (!silent && !jsonMode) {
    printDashboard(routedTasks, { mode, dryRun });
  }

  return {
    tool:      TOOL_META.slug,
    version:   TOOL_META.version,
    mode,
    dryRun,
    project,
    specLength: specText.length,
    taskCount:  routedTasks.length,
    tasks:      routedTasks,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const get = (name) => { const p = `--${name}=`; const a = argv.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  const has = (name) => argv.includes(`--${name}`);

  const rawMode = get('mode') || (has('simple') ? 'simple' : has('council') ? 'council' : 'smart');

  return {
    spec:     get('spec')    || null,
    file:     get('file')    || null,
    project:  get('project') || null,
    mode:     rawMode,
    maxTasks: parseInt(get('max-tasks') || '50', 10),
    dryRun:   !has('write'),
    silent:   has('silent'),
    json:     has('json'),
  };
}

async function main() {
  const fs   = require('node:fs');
  const path = require('node:path');
  const args = parseArgs(process.argv.slice(2));

  let specText = args.spec;
  if (!specText && args.file) {
    try { specText = fs.readFileSync(path.resolve(args.file), 'utf8'); } catch (e) {
      console.error(c('red', `ERROR: ファイル読み込み失敗 — ${e.message}`));
      process.exit(1);
    }
  }

  if (!specText) {
    console.log(`
${c('bold', 'Usage:')}
  npm run smart:route -- --spec="設計書テキスト"
  npm run smart:route -- --file=./spec.md
  npm run smart:route -- --mode=council --spec="..."

Modes:
  (default)  --smart    GPT が裁定条件を満たすタスクのみ裁定（デフォルト）
             --simple   ルールベースのみ（最速・最安・API呼び出しなし）
             --council  全タスクを GPT+Claude 協議（重要案件用）

Flags:
  --write        dryRun 無効化（実際の API 呼び出し）
  --json         JSON 出力
  --silent       コンソール出力抑制
  --project=<p>  プロジェクト識別子（DeepSeekガード用）
  --max-tasks=n  最大タスク数 (default: 50)
`);
    return;
  }

  const result = await runSmartRouter(specText, {
    mode:     args.mode,
    dryRun:   args.dryRun,
    project:  args.project,
    maxTasks: args.maxTasks,
    jsonMode: args.json,
    silent:   args.silent || args.json,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!args.silent) {
    console.log(`  ${c('dim', '完了')}  mode: ${args.mode}  タスク: ${result.taskCount}`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(c('red', 'ERROR:'), err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  ROUTING_TABLE,
  WORKER_META,
  classifyTask,
  gptArbiterNeeded,
  assignWorkerByRules,
  assignWorker,
  routeSpec,
  runSmartRouter,
  printDashboard,
  workerLabel,
};
