#!/usr/bin/env node
'use strict';

/**
 * KOSAME Human Gate Inbox v110.63.0
 *
 * 危険・中核・判断待ちタスクを人間承認箱に集約する。
 * HUMAN_GATE_REQUIRED フラグを持つ全決定を一覧化し、
 * 理由・対象ファイル・推奨対応・承認可否を1画面で確認できる。
 *
 * Usage:
 *   node tools/kosame-human-gate-inbox.js
 *   node tools/kosame-human-gate-inbox.js --json
 *   node tools/kosame-human-gate-inbox.js --summary
 */

const TOOL_META = {
  version: '110.63.0',
  feature: 'v110-63-human-gate-inbox',
  slug: 'kosame-human-gate-inbox',
};

const HUMAN_GATE = 'HUMAN_GATE_REQUIRED';

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
  gray: '\x1b[90m', bgRed: '\x1b[41m', bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m', white: '\x1b[37m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (n = 72) => '─'.repeat(n);

// ── Gate categories ───────────────────────────────────────────────────────────

const GATE_CATEGORIES = {
  security: {
    label: 'SECURITY',
    color: 'red',
    priority: 1,
    defaultAction: 'deny',
    defaultActionReason: 'セキュリティ違反タスクは原則否認。内容を精査の上、修正して再提出。',
  },
  ip_core: {
    label: 'IP/CORE',
    color: 'magenta',
    priority: 2,
    defaultAction: 'approve_with_review',
    defaultActionReason: 'IP・コアロジックは人間レビュー必須。承認前に差分確認を実施。',
  },
  high_cost: {
    label: 'HIGH COST',
    color: 'yellow',
    priority: 3,
    defaultAction: 'approve_with_review',
    defaultActionReason: '高コストプロバイダ使用は明示承認が必要。予算確認後に承認。',
  },
  external_worker: {
    label: 'EXT WORKER',
    color: 'cyan',
    priority: 4,
    defaultAction: 'approve_with_review',
    defaultActionReason: '外部ワーカーへのルーティングは sanitized_only 確認の上承認。',
  },
  provider_blocked: {
    label: 'BLOCKED',
    color: 'yellow',
    priority: 5,
    defaultAction: 'escalate',
    defaultActionReason: 'プロバイダがブロック状態。代替プロバイダを指定して再試行。',
  },
  dangerous_task: {
    label: 'DANGEROUS',
    color: 'red',
    priority: 1,
    defaultAction: 'deny',
    defaultActionReason: '本番影響・破壊的操作を含む。安全確認後にのみ承認。',
  },
  other: {
    label: 'OTHER',
    color: 'gray',
    priority: 6,
    defaultAction: 'request_more_info',
    defaultActionReason: '追加情報が必要。詳細確認の上で承認可否を判断。',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => (Array.isArray(part) ? part.join(' ') : String(part)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  if (!value) return [];
  const text = String(value).trim();
  return text ? [text] : [];
}

function uniqueList(values) {
  return [...new Set(normalizeList(values))];
}

function nowIso() {
  return new Date().toISOString();
}

let _gateSeq = 0;
function nextGateId() {
  _gateSeq += 1;
  return `GATE-${String(_gateSeq).padStart(3, '0')}`;
}

function classifyGateCategory(decision = {}, task = {}) {
  const gateReason = compactText(
    decision.humanGateReason,
    decision.gateReason,
    decision.securityViolation ? JSON.stringify(decision.securityViolation) : '',
    decision.reason,
  ).toLowerCase();

  const taskType = String(
    decision.taskType
    || decision.costPolicy?.taskType
    || task.taskType
    || '',
  ).toLowerCase();

  const hasProdImpact = !!(task.hasProdImpact || decision.hasProdImpact || task.isProd);
  const isDestructive = !!(task.isDestructive || decision.isDestructive);

  if (hasProdImpact || isDestructive
    || /destroy|delete.*prod|drop.*table|rm\s+-rf|force.?push/i.test(gateReason)) {
    return 'dangerous_task';
  }
  if (/security|violation|secret|credential|ip.?leak|personal.?data|個人情報/i.test(gateReason)
    || taskType === 'security') {
    return 'security';
  }
  if (/ip[/_\s]core|core.?logic|proprietary|機密|営業dX/i.test(gateReason)
    || taskType === 'ip_core') {
    return 'ip_core';
  }
  if (/high.?cost|gpt.?5\.5|claude.*approval|高コスト/i.test(gateReason)
    || decision.blockedHighCost
    || decision.providerBudgetBucket === 'high_cost_human_approval') {
    return 'high_cost';
  }
  if (/external.?worker|deepseek|opencode|sanitized/i.test(gateReason)
    || decision.primary === 'cheap_code_worker') {
    return 'external_worker';
  }
  if (/block|unavailable|state=/i.test(gateReason)
    || decision.providerBudgetBlockedHighCost) {
    return 'provider_blocked';
  }
  return 'other';
}

// ── Core builders ─────────────────────────────────────────────────────────────

/**
 * ルーター / レジャー / 任意の decision オブジェクトから単一ゲートエントリを生成する。
 * humanGateRequired が false の場合は null を返す（スキップ）。
 *
 * @param {object} task     - タスクオブジェクト
 * @param {object} decision - assignWorkerByRules / buildLedgerRecord 等の出力
 * @param {object} context  - 追加コンテキスト
 * @returns {object|null}
 */
function buildGateEntry(task = {}, decision = {}, context = {}) {
  const humanGateRequired = !!(
    decision.humanGate
    || decision.humanGateRequired
    || decision.costPolicy?.humanGateRequired
    || decision.costPolicy?.selectionBlocked
    || decision.providerBudgetHumanGateRequired
    || (Array.isArray(decision.providerBudgetBucketPath)
      && decision.providerBudgetBucketPath.includes(HUMAN_GATE))
    || (Array.isArray(decision.safetyPath)
      && decision.safetyPath.includes(HUMAN_GATE))
    || context.forceGate
  );

  if (!humanGateRequired) return null;

  const gateReason = compactText(
    decision.humanGateReason,
    decision.gateReason,
    decision.costPolicy?.humanGateReason,
    decision.providerBudgetHumanGateReason,
    decision.reason && /gate|block|セキュリティ|危険|禁止|violation/i.test(decision.reason)
      ? decision.reason
      : '',
    decision.securityViolation
      ? `違反: ${normalizeList(decision.securityViolation).join(', ')}`
      : '',
  ) || 'HUMAN_GATE_REQUIRED (詳細理由不明)';

  const category = context.gateCategory || classifyGateCategory(decision, task);
  const meta = GATE_CATEGORIES[category] || GATE_CATEGORIES.other;

  const targetFiles = uniqueList([
    ...(normalizeList(task.file_scope || task.fileScope || task.files)),
    ...(normalizeList(decision.targetFiles || decision.affectedFiles)),
    ...(normalizeList(context.targetFiles)),
  ]);

  const recommendedAction = context.recommendedAction || meta.defaultAction;
  const recommendedActionReason = compactText(
    meta.defaultActionReason,
    decision.recommendedNextAction ? `→ next: ${decision.recommendedNextAction}` : '',
    decision.providerBudgetBucketReason,
  );

  return {
    id: nextGateId(),
    taskId: String(task.id || context.taskId || '—'),
    taskTitle: String(task.title || task.description || context.taskTitle || '(無題)').slice(0, 80),
    gateReason,
    gateCategory: category,
    gateCategoryLabel: meta.label,
    gateCategoryColor: meta.color,
    gatePriority: meta.priority,
    targetFiles,
    recommendedAction,
    recommendedActionReason,
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    deniedBy: null,
    deniedAt: null,
    denialReason: null,
    createdAt: nowIso(),
    decision: {
      primary: decision.primary || decision.selectedProvider || null,
      selectedModel: decision.selectedModel || decision.costPolicy?.selectedModel || null,
      providerBudgetBucket: decision.providerBudgetBucket || decision.costPolicy?.providerBudgetBucket || null,
      taskType: decision.taskType || decision.costPolicy?.taskType || null,
      blockedHighCost: decision.blockedHighCost || decision.providerBudgetBlockedHighCost || false,
      securityViolation: normalizeList(decision.securityViolation),
    },
  };
}

/**
 * ルーティング済みタスク配列（routeSpec 等の出力）から全ゲートエントリを収集する。
 *
 * @param {object[]} routedTasks
 * @param {object}   context
 * @returns {object[]}
 */
function collectGateEntries(routedTasks = [], context = {}) {
  const entries = [];
  for (const t of routedTasks) {
    const assignment = t.assignment || t;
    const entry = buildGateEntry(t, assignment, context);
    if (entry) entries.push(entry);
  }
  return entries.sort((a, b) => a.gatePriority - b.gatePriority);
}

/**
 * ゲートエントリ配列から Inbox スナップショットを構築する。
 *
 * @param {object[]} entries
 * @returns {object}
 */
function buildInboxSnapshot(entries = []) {
  const pending  = entries.filter(e => e.status === 'pending');
  const approved = entries.filter(e => e.status === 'approved');
  const denied   = entries.filter(e => e.status === 'denied');

  const categoryCounts = {};
  for (const e of pending) {
    categoryCounts[e.gateCategory] = (categoryCounts[e.gateCategory] || 0) + 1;
  }

  const priorityGates = pending
    .filter(e => e.gatePriority <= 2)
    .map(e => ({ id: e.id, taskId: e.taskId, category: e.gateCategory, reason: e.gateReason.slice(0, 60) }));

  return {
    version: TOOL_META.version,
    timestamp: nowIso(),
    totalEntries: entries.length,
    pendingCount: pending.length,
    approvedCount: approved.length,
    deniedCount: denied.length,
    categoryCounts,
    priorityGates,
    pending,
    approved,
    denied,
    allEntries: entries,
  };
}

// ── Approval / Denial actions ─────────────────────────────────────────────────

/**
 * ゲートエントリを承認する（イミュータブル: 新オブジェクトを返す）。
 *
 * @param {object} entry
 * @param {string} operator
 * @param {string} [reason]
 * @returns {object}
 */
function approveGate(entry, operator = 'human', reason = '') {
  return {
    ...entry,
    status: 'approved',
    approvedBy: String(operator),
    approvedAt: nowIso(),
    approvalReason: reason || '人間オペレータによる承認',
  };
}

/**
 * ゲートエントリを否認する（イミュータブル: 新オブジェクトを返す）。
 *
 * @param {object} entry
 * @param {string} operator
 * @param {string} [reason]
 * @returns {object}
 */
function denyGate(entry, operator = 'human', reason = '') {
  return {
    ...entry,
    status: 'denied',
    deniedBy: String(operator),
    deniedAt: nowIso(),
    denialReason: reason || '人間オペレータによる否認',
  };
}

// ── Dashboard display ─────────────────────────────────────────────────────────

function statusBadge(status) {
  if (status === 'approved') return c('green', '✓ APPROVED');
  if (status === 'denied')   return c('red',   '✗ DENIED  ');
  return c('yellow', '⏳ PENDING ');
}

function actionBadge(action) {
  const map = {
    approve_with_review: c('cyan',    'APPROVE+REVIEW'),
    deny:                c('red',     'DENY          '),
    request_more_info:   c('yellow',  'MORE INFO     '),
    escalate:            c('magenta', 'ESCALATE      '),
  };
  return map[action] || c('gray', action);
}

/**
 * Inbox スナップショットを1画面でコンソール表示する。
 *
 * @param {object} snapshot - buildInboxSnapshot の返り値
 * @param {object} opts     - { showApproved, showDenied, compact }
 */
function printInboxDashboard(snapshot, opts = {}) {
  const { showApproved = false, showDenied = false, compact = false } = opts;

  console.log('');
  console.log(`${c('bold', c('blue', '⬡ KOSAME Human Gate Inbox'))}  v${TOOL_META.version}`);
  console.log(`  ${c('dim', snapshot.timestamp)}`);
  console.log('  ' + hr());

  // ── Summary bar ──
  const summaryParts = [
    `Total: ${c('bold', String(snapshot.totalEntries))}`,
    snapshot.pendingCount  > 0
      ? c('yellow', `⏳ Pending: ${snapshot.pendingCount}`)
      : c('dim', `Pending: 0`),
    snapshot.approvedCount > 0
      ? c('green',  `✓ Approved: ${snapshot.approvedCount}`)
      : c('dim', `Approved: 0`),
    snapshot.deniedCount   > 0
      ? c('red',    `✗ Denied: ${snapshot.deniedCount}`)
      : c('dim', `Denied: 0`),
  ];
  console.log(`  ${summaryParts.join('  ')}`);

  if (Object.keys(snapshot.categoryCounts).length > 0) {
    const catParts = Object.entries(snapshot.categoryCounts).map(([cat, n]) => {
      const meta = GATE_CATEGORIES[cat] || GATE_CATEGORIES.other;
      return c(meta.color, `${meta.label}: ${n}`);
    });
    console.log(`  ${catParts.join('  ')}`);
  }

  // ── Priority alerts ──
  if (snapshot.priorityGates.length > 0) {
    console.log('');
    console.log(`  ${c('bgRed', c('white', '  !! PRIORITY GATES !!  '))} (security / IP-core)`);
    for (const pg of snapshot.priorityGates) {
      console.log(`  ${c('red', pg.id)}  ${c('bold', pg.taskId.padEnd(10))}  ${c('red', pg.category.padEnd(14))}  ${pg.reason}`);
    }
  }

  console.log('');
  console.log('  ' + hr());

  // ── Pending entries ──
  if (snapshot.pending.length === 0) {
    console.log(`  ${c('green', '✓ 承認待ちゲートなし — すべてクリア')}`);
  } else {
    console.log(`  ${c('bold', 'PENDING GATES')}`);
    console.log('');
    for (const entry of snapshot.pending) {
      printGateEntry(entry, compact);
    }
  }

  // ── Approved (optional) ──
  if (showApproved && snapshot.approved.length > 0) {
    console.log('  ' + hr());
    console.log(`  ${c('bold', 'APPROVED GATES')}`);
    console.log('');
    for (const entry of snapshot.approved) {
      printGateEntry(entry, true);
    }
  }

  // ── Denied (optional) ──
  if (showDenied && snapshot.denied.length > 0) {
    console.log('  ' + hr());
    console.log(`  ${c('bold', 'DENIED GATES')}`);
    console.log('');
    for (const entry of snapshot.denied) {
      printGateEntry(entry, true);
    }
  }

  console.log('  ' + hr());
  if (snapshot.pendingCount > 0) {
    console.log(`  ${c('yellow', `${snapshot.pendingCount}件の承認待ちゲートが存在します。上記タスクを確認して承認/否認してください。`)}`);
  } else {
    console.log(`  ${c('green', '全ゲートが処理済みです。')}`);
  }
  console.log('');
}

function printGateEntry(entry, compact = false) {
  const catMeta = GATE_CATEGORIES[entry.gateCategory] || GATE_CATEGORIES.other;

  const idStr    = c('bold', entry.id.padEnd(10));
  const catBadge = c(catMeta.color, `[${entry.gateCategoryLabel}]`.padEnd(13));
  const status   = statusBadge(entry.status);
  const taskLine = `${c('cyan', entry.taskId.padEnd(12))}${c('bold', entry.taskTitle.slice(0, 50))}`;

  console.log(`  ${idStr}${catBadge}${status}  ${taskLine}`);
  console.log(`  ${''.padEnd(10)}${c('dim', '理由:')}  ${entry.gateReason.slice(0, 80)}`);

  if (!compact) {
    if (entry.targetFiles.length > 0) {
      const files = entry.targetFiles.slice(0, 4).join(', ');
      const more  = entry.targetFiles.length > 4 ? ` +${entry.targetFiles.length - 4}` : '';
      console.log(`  ${''.padEnd(10)}${c('dim', 'ファイル:')}${c('gray', files + more)}`);
    }

    const action = actionBadge(entry.recommendedAction);
    console.log(`  ${''.padEnd(10)}${c('dim', '推奨:')}  ${action}  ${c('dim', entry.recommendedActionReason.slice(0, 60))}`);

    if (entry.decision.selectedModel) {
      console.log(`  ${''.padEnd(10)}${c('dim', 'モデル:')} ${c('gray', entry.decision.selectedModel)}`);
    }
    if (entry.status === 'approved') {
      console.log(`  ${''.padEnd(10)}${c('green', `承認: ${entry.approvedBy} @ ${entry.approvedAt?.slice(0, 19) || '?'} — ${entry.approvalReason || ''}`)}`);
    }
    if (entry.status === 'denied') {
      console.log(`  ${''.padEnd(10)}${c('red', `否認: ${entry.deniedBy} @ ${entry.deniedAt?.slice(0, 19) || '?'} — ${entry.denialReason || ''}`)}`);
    }
  }
  console.log('');
}

// ── Integration helpers ───────────────────────────────────────────────────────

/**
 * routeSpec 等の出力を直接受け取り、Inbox スナップショットを返す。
 * Smart Task Router / Auto Dev との統合用エントリポイント。
 *
 * @param {object[]} routedTasks
 * @param {object}   context
 * @returns {object}
 */
function buildInboxFromRoutedTasks(routedTasks = [], context = {}) {
  const entries  = collectGateEntries(routedTasks, context);
  return buildInboxSnapshot(entries);
}

/**
 * ダッシュボードサーバー等への統合: サマリオブジェクトを返す。
 *
 * @param {object[]} routedTasks
 * @returns {object}
 */
function getDashboardSummary(routedTasks = []) {
  const snapshot = buildInboxFromRoutedTasks(routedTasks);
  return {
    humanGateInbox: {
      pendingCount:  snapshot.pendingCount,
      approvedCount: snapshot.approvedCount,
      deniedCount:   snapshot.deniedCount,
      totalEntries:  snapshot.totalEntries,
      priorityGates: snapshot.priorityGates,
      categoryCounts: snapshot.categoryCounts,
      hasUrgent: snapshot.priorityGates.length > 0,
    },
  };
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonMode    = args.includes('--json');
  const summaryMode = args.includes('--summary');
  const showAll     = args.includes('--all');

  // デモ用サンプルタスク生成
  const sampleTasks = [
    {
      id: 'T-SEC-01',
      title: 'Auth token を外部ワーカーに渡す（ブロック）',
      file_scope: ['tools/kosame-key-setup.js', 'providers/openai.js'],
      assignment: {
        primary: 'cheap_code_worker',
        humanGate: true,
        humanGateRequired: true,
        humanGateReason: 'security violation: auth token leak detected in task description',
        securityViolation: ['auth_token_in_task', 'external_worker_blocked'],
        reason: 'DeepSeek禁止 → セキュリティ制限',
        taskType: 'security',
      },
    },
    {
      id: 'T-IP-02',
      title: 'Sales DX 営業導線ロジックを変更',
      file_scope: ['tools/kosame-sales-dx-router.js'],
      isSalesDx: true,
      assignment: {
        primary: 'general_worker',
        humanGate: true,
        humanGateRequired: true,
        humanGateReason: '営業DX・IP_core タスクは人間ゲート必須',
        taskType: 'ip_core',
        reason: 'salesDx: IP/core 変更には人間ゲートが必要',
      },
    },
    {
      id: 'T-COST-03',
      title: 'GPT-5.5 を使ったブレークスルー提案生成',
      file_scope: ['tools/kosame-breakthrough-generator.js'],
      assignment: {
        primary: 'gpt_upper',
        humanGateRequired: true,
        humanGateReason: 'gpt-5.5 requires explicit human approval — high cost provider',
        blockedHighCost: true,
        selectedModel: 'gpt-5.5',
        providerBudgetBucket: 'high_cost_human_approval',
        taskType: 'breakthrough_review',
        reason: '高コストプロバイダ: 明示承認が必要',
      },
    },
    {
      id: 'T-EXT-04',
      title: 'DeepSeek で sanitized docs を生成',
      file_scope: ['docs/api-overview.md'],
      assignment: {
        primary: 'cheap_code_worker',
        humanGateRequired: true,
        humanGateReason: 'DeepSeek/opencode requires sanitized_only task pack — not yet confirmed',
        taskType: 'routine_docs',
        reason: 'external worker: sanitized_only 未確認',
      },
    },
  ];

  const snapshot = buildInboxFromRoutedTasks(sampleTasks);

  if (jsonMode) {
    console.log(JSON.stringify(snapshot, null, 2));
    process.exit(0);
  }

  if (summaryMode) {
    const summary = getDashboardSummary(sampleTasks);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  printInboxDashboard(snapshot, {
    showApproved: showAll,
    showDenied: showAll,
    compact: false,
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  TOOL_META,
  HUMAN_GATE,
  GATE_CATEGORIES,
  buildGateEntry,
  collectGateEntries,
  buildInboxSnapshot,
  buildInboxFromRoutedTasks,
  getDashboardSummary,
  approveGate,
  denyGate,
  printInboxDashboard,
  printGateEntry,
};
