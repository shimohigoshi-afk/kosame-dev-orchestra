'use strict';

/**
 * Multi-Agent Work Log v110.12.0
 *
 * 誰が何をやったか時系列で記録する。
 * Gemini実装・Claude補修・GPT裁定を可視化。
 * セッション別・プロダクト別のログ出力に対応。
 *
 * 安全原則:
 *   - dryRun=true (デフォルト) — ファイル書き込みなし
 *   - 全ての出力は構造化JSON + colored section logger
 */

const { sectionStart, sectionEnd, log } = require('./colored-section-logger');

const TOOL_META = {
  version: '110.12.0',
  title:   'Multi-Agent Work Log',
  slug:    'multi-agent-work-log'
};

const AGENT_ROLE = {
  GEMINI:  'gemini',   // 実装担当
  CLAUDE:  'claude',   // 補修・レビュー担当
  GPT:     'gpt',      // 裁定・ルーティング担当
  HUMAN:   'human',    // 承認・監視担当
  UNKNOWN: 'unknown'
};

const ACTION_TYPE = {
  IMPLEMENT:  'implement',   // 新規実装
  REPAIR:     'repair',      // 補修・修正
  ARBITRATE:  'arbitrate',   // 裁定・決定
  REVIEW:     'review',      // レビュー
  APPROVE:    'approve',     // 承認
  REJECT:     'reject',      // 却下
  HANDOFF:    'handoff',     // 引き継ぎ
  START:      'start',       // 開始
  COMPLETE:   'complete'     // 完了
};

// ── Log entry builder ─────────────────────────────────────────────────────────

function buildEntry(agent, action, opts) {
  const {
    taskId, sessionId, productId,
    description, input, output,
    durationMs, meta, dryRun = true
  } = opts || {};

  return {
    ts:          new Date().toISOString(),
    agent,
    role:        _agentRole(agent),
    action,
    taskId:      taskId    || null,
    sessionId:   sessionId || null,
    productId:   productId || null,
    description: description || null,
    input:       input  || null,
    output:      output || null,
    durationMs:  durationMs !== undefined ? durationMs : null,
    meta:        meta || null,
    dryRun
  };
}

function _agentRole(agent) {
  const a = (agent || '').toLowerCase();
  if (a.startsWith('gemini'))  return AGENT_ROLE.GEMINI;
  if (a.startsWith('claude'))  return AGENT_ROLE.CLAUDE;
  if (a.startsWith('gpt') || a.startsWith('openai')) return AGENT_ROLE.GPT;
  if (a === 'human')           return AGENT_ROLE.HUMAN;
  return AGENT_ROLE.UNKNOWN;
}

// ── Session work log ──────────────────────────────────────────────────────────

/**
 * Create an in-memory work log session.
 *
 * @param {object} opts  { sessionId, productId, dryRun=true }
 */
function createWorkLog(opts) {
  const { sessionId, productId, dryRun = true } = opts || {};
  const entries = [];

  /**
   * Append one work log entry.
   */
  function append(agent, action, entryOpts) {
    const entry = buildEntry(agent, action, {
      sessionId,
      productId,
      dryRun,
      ...entryOpts
    });
    entries.push(entry);
    return entry;
  }

  /**
   * Shortcut helpers.
   */
  const implement  = (agent, o) => append(agent, ACTION_TYPE.IMPLEMENT,  o);
  const repair     = (agent, o) => append(agent, ACTION_TYPE.REPAIR,     o);
  const arbitrate  = (agent, o) => append(agent, ACTION_TYPE.ARBITRATE,  o);
  const review     = (agent, o) => append(agent, ACTION_TYPE.REVIEW,     o);
  const approve    = (agent, o) => append(agent, ACTION_TYPE.APPROVE,    o);
  const handoff    = (agent, o) => append(agent, ACTION_TYPE.HANDOFF,    o);
  const complete   = (agent, o) => append(agent, ACTION_TYPE.COMPLETE,   o);

  /**
   * Filter log by session.
   */
  function bySession(sid) {
    return entries.filter(e => e.sessionId === sid);
  }

  /**
   * Filter log by product.
   */
  function byProduct(pid) {
    return entries.filter(e => e.productId === pid);
  }

  /**
   * Timeline view — sorted by ts.
   */
  function timeline() {
    return [...entries].sort((a, b) => a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
  }

  /**
   * Agent contribution summary.
   */
  function agentSummary() {
    const map = {};
    for (const e of entries) {
      const key = e.agent;
      if (!map[key]) {
        map[key] = { agent: e.agent, role: e.role, actionCount: 0, actions: {} };
      }
      map[key].actionCount++;
      map[key].actions[e.action] = (map[key].actions[e.action] || 0) + 1;
    }
    return Object.values(map).sort((a, b) => b.actionCount - a.actionCount);
  }

  /**
   * Build a structured report for the current session.
   */
  function report(reportOpts) {
    const { silent = false } = reportOpts || {};
    const emit = silent ? () => {} : log;

    const tl      = timeline();
    const summary = agentSummary();

    emit('info', `entries: ${entries.length}  agents: ${summary.length}`);

    for (const s of summary) {
      const actionStr = Object.entries(s.actions)
        .map(([a, c]) => `${a}×${c}`)
        .join(', ');
      emit('info', `  ${s.agent} (${s.role}): ${s.actionCount} actions [${actionStr}]`);
    }

    return {
      tool:    TOOL_META.slug,
      version: TOOL_META.version,
      dryRun,
      realProductActionsExecuted: false,
      dangerousActionsDenied:     true,
      humanApprovalRequired:      true,
      sessionId:    sessionId || null,
      productId:    productId || null,
      entryCount:   entries.length,
      agentSummary: summary,
      timeline:     tl
    };
  }

  return {
    append, implement, repair, arbitrate,
    review, approve, handoff, complete,
    bySession, byProduct, timeline, agentSummary,
    report, entries
  };
}

// ── Visualizer ────────────────────────────────────────────────────────────────

const ROLE_ICON = {
  [AGENT_ROLE.GEMINI]:  'G',
  [AGENT_ROLE.CLAUDE]:  'C',
  [AGENT_ROLE.GPT]:     'P',
  [AGENT_ROLE.HUMAN]:   'H',
  [AGENT_ROLE.UNKNOWN]: '?'
};

/**
 * Render a compact ASCII timeline for display.
 */
function renderTimeline(entries) {
  const lines = ['', '  TIMELINE', '  ' + '─'.repeat(60)];
  for (const e of entries) {
    const icon = ROLE_ICON[e.role] || '?';
    const time = e.ts.slice(11, 19);
    const task = e.taskId ? `[${e.taskId}]` : '';
    const desc = e.description ? ` ${e.description.slice(0, 40)}` : '';
    lines.push(`  ${time} [${icon}] ${e.agent.padEnd(18)} ${e.action.padEnd(12)}${task}${desc}`);
  }
  lines.push('  ' + '─'.repeat(60));
  return lines.join('\n');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

async function main() {
  sectionStart('Multi-Agent Work Log デモ');

  const workLog = createWorkLog({
    sessionId: 'session-demo-001',
    productId: 'anesty-board',
    dryRun: true
  });

  workLog.arbitrate('gpt-4o',            { taskId: 'task-1', description: 'タスク分析・ルーティング決定' });
  workLog.implement('gemini-1.5-pro',    { taskId: 'task-1', description: 'UIコンポーネント実装', durationMs: 12000 });
  workLog.repair   ('claude-sonnet-4-6', { taskId: 'task-1', description: 'TypeScript型エラー修正', durationMs: 3000 });
  workLog.review   ('claude-opus-4-8',   { taskId: 'task-1', description: '最終レビュー・品質確認' });
  workLog.approve  ('human',             { taskId: 'task-1', description: 'ゲート承認' });
  workLog.handoff  ('claude-sonnet-4-6', { taskId: 'task-1', description: 'コミット候補パケット生成' });
  workLog.arbitrate('gpt-4o',            { taskId: 'task-2', description: '次タスク裁定' });
  workLog.implement('gemini-2.0-flash',  { taskId: 'task-2', description: 'APIルート実装', durationMs: 8000 });
  workLog.complete ('gemini-2.0-flash',  { taskId: 'task-2', description: 'タスク完了マーク' });

  const rep = workLog.report({ silent: false });

  console.log(renderTimeline(rep.timeline));
  console.log('');
  console.log(JSON.stringify(rep, null, 2));

  sectionEnd('Multi-Agent Work Log デモ');
}

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  AGENT_ROLE,
  ACTION_TYPE,
  buildEntry,
  createWorkLog,
  renderTimeline
};
