#!/usr/bin/env node
'use strict';

/**
 * KOSAME Business Experiment Gate & Ledger v110.74.0
 *
 * 事業施策の検証ゲート兼台帳。
 * YouTube / HP / LP / 記事 / SNS / 広告 / 商品検証 などの施策について、
 * 開始前に予算・仮説・撤退ライン・KPIを定義し、結果ログから
 * GO / SMALL_TEST / STOP / SCALE / HUMAN_GATE を判定する。
 *
 * 【制約】
 *   - 投資助言・金融取引・FXではない
 *   - 実API送信・実課金・広告出稿・外部保存はしない
 *   - Secret / API key / .env / credentials の値は読まない
 *   - 営業DX / transcriber / ANESTY Board / 顧客情報には触れない
 *
 * Usage:
 *   node tools/kosame-business-experiment-gate-ledger.js --experimentName "..." --category youtube --json
 *   npm run business:experiment -- --experimentName "..." --category youtube --dryRun
 */

const TOOL_META = {
  version:       '110.74.0',
  feature:       'v110-74-business-experiment-gate-ledger',
  slug:          'kosame-business-experiment-gate-ledger',
  dryRunOnly:    true,
};

const STATUS = {
  safe:       'safe',
  caution:    'caution',
  blocked:    'blocked',
  human_gate: 'human_gate',
};

const DECISION = {
  GO:           'GO',
  SMALL_TEST:   'SMALL_TEST',
  STOP:         'STOP',
  SCALE:        'SCALE',
  HUMAN_GATE:   'HUMAN_GATE',
};

// ── High-risk patterns (financial/insurance/loan → HUMAN_GATE) ──────────────

const HIGH_RISK_PATTERNS = [
  { re: /(?:金利|利回り|配当|株価|投資収益|資産運用|運用利回り)/,        label: 'financial return' },
  { re: /(?:保険|生命保険|医療保険|火災保険|年金保険|保険金)/,              label: 'insurance' },
  { re: /(?:住宅ローン|ローン審査|借入|融資|借り入れ)/,                     label: 'loan' },
  { re: /\b(FX|外国為替|為替取引|スワップ|レバレッジ)\b/i,                  label: 'forex' },
  { re: /\b(仮想通貨|暗号資産|crypto|bitcoin|イーサリアム)\b/i,             label: 'crypto' },
];

const DANGER_TEXT_PATTERNS = [
  { re: /\b(api[_-]?key|sk-[A-Za-z0-9]|bot[_-]?token|secret|credential|\.env)\b/i, label: 'secret', blocked: true },
  { re: /\b(営業DX|transcriber|sales.?dx)\b/i, label: 'salesDX', blocked: true },
  { re: /\b(ANESTY\s*Board|anesty[_-]?board)\b/i, label: 'anesty_board', blocked: true },
  { re: /\b(顧客情報|個人情報|customer.?data|pii)\b/i, label: 'customer_data', blocked: true },
];

const VALID_CATEGORIES = ['youtube', 'hp', 'lp', 'article', 'sns', 'ad', 'product', 'other'];

// ── Main gate builder ─────────────────────────────────────────────────────────

function buildExperimentGate(plan = {}, result = {}) {
  const name       = String(plan.experimentName || '').trim();
  const category   = String(plan.category || '').trim().toLowerCase();
  const objective  = String(plan.objective || '').trim();
  const hypothesis = String(plan.hypothesis || '').trim();
  const initialBudget = parseFloat(plan.initialBudget) || 0;
  const maxLoss    = parseFloat(plan.maxLoss) || 0;
  const testPeriod = parseInt(plan.testPeriodDays) || 14;
  const kpis       = Array.isArray(plan.kpis) ? plan.kpis : [];
  const stopConds  = Array.isArray(plan.stopConditions) ? plan.stopConditions : [];
  const scaleConds = Array.isArray(plan.scaleConditions) ? plan.scaleConditions : [];
  const channels   = Array.isArray(plan.channels) ? plan.channels : [];

  const actualCost       = parseFloat(result.actualCost) || 0;
  const conversions      = parseInt(result.conversions) || 0;
  const revenue          = parseFloat(result.revenue) || 0;
  const impressions      = parseInt(result.impressions) || 0;
  const leads            = parseInt(result.leads) || 0;
  const inquiries        = parseInt(result.inquiries) || 0;

  const allText = `${name} ${objective} ${hypothesis} ${JSON.stringify(plan)}`;

  // ── Danger checks ────────────────────────────────────────────────────────

  const blockedReasons = [];
  const cautions = [];
  let humanGate = false;

  for (const dp of DANGER_TEXT_PATTERNS) {
    if (dp.re.test(allText)) {
      if (dp.blocked) blockedReasons.push(`[${dp.label}] Detected in experiment plan`);
      else { humanGate = true; cautions.push(`[${dp.label}] Detected in experiment plan`); }
    }
  }

  for (const hp of HIGH_RISK_PATTERNS) {
    if (hp.re.test(allText)) {
      humanGate = true;
      cautions.push(`[${hp.label}] High-risk financial/insurance/loan expression detected`);
    }
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    cautions.push(`Unknown category: ${category}`);
  }

  // ── Decision logic ──────────────────────────────────────────────────────────

  const stopReasons = [];
  const scaleReasons = [];
  let decision;

  // maxLoss exceeded → STOP
  if (maxLoss > 0 && actualCost > maxLoss) {
    stopReasons.push(`Actual cost ${actualCost} exceeds maxLoss ${maxLoss}`);
  }

  // stopConditions check (only when result data matches)
  for (const sc of stopConds) {
    const low = sc.toLowerCase();
    if ((low.includes('ctr') || low.includes('click')) && impressions > 0 && conversions === 0) {
      stopReasons.push(`Stop condition: ${sc}`);
    } else if (low.includes('cost') && actualCost > 0 && actualCost >= maxLoss && maxLoss > 0) {
      stopReasons.push(`Stop condition: ${sc}`);
    }
  }

  // scaleConditions check (only when result data matches)
  for (const sc of scaleConds) {
    const low = sc.toLowerCase();
    if (low.includes('conversion') && conversions >= parseInt(low.match(/\d+/)?.[0] || '999')) {
      scaleReasons.push(`Scale condition: ${sc}`);
    } else if (low.includes('cpa') || low.includes('cost')) {
      scaleReasons.push(`Scale condition: ${sc}`);
    }
  }

  // KPI-based inference
  const roi = initialBudget > 0 ? ((revenue - actualCost) / initialBudget) * 100 : 0;
  const cpa = conversions > 0 ? actualCost / conversions : 0;
  const cpl = leads > 0 ? actualCost / leads : 0;

  if (blockedReasons.length > 0) {
    decision = DECISION.STOP;
  } else if (humanGate) {
    decision = DECISION.HUMAN_GATE;
  } else if (stopReasons.length > 0) {
    decision = DECISION.STOP;
  } else if (scaleReasons.length > 0 || roi > 200) {
    decision = DECISION.SCALE;
  } else if (!name || !objective || !hypothesis || initialBudget === 0) {
    decision = DECISION.SMALL_TEST;
    cautions.push('Insufficient experiment plan definition');
  } else if (actualCost === 0 && conversions === 0 && revenue === 0) {
    decision = DECISION.SMALL_TEST;
    cautions.push('No results yet. Start with small test.');
  } else if (roi < -50) {
    decision = DECISION.STOP;
    stopReasons.push(`ROI ${roi.toFixed(1)}% indicates significant loss`);
  } else if (roi > 50 && conversions >= 10) {
    decision = DECISION.SCALE;
    scaleReasons.push(`Positive ROI ${roi.toFixed(1)}% with ${conversions} conversions`);
  } else {
    decision = DECISION.SMALL_TEST;
  }

  // ── Status determination ────────────────────────────────────────────────────

  let status;
  let nextAllowedAction;
  let humanApprovalRequired = false;

  if (decision === DECISION.HUMAN_GATE) {
    status = STATUS.human_gate;
    humanApprovalRequired = true;
    nextAllowedAction = 'review_and_approve_or_reject_experiment';
  } else if (blockedReasons.length > 0) {
    status = STATUS.blocked;
    nextAllowedAction = 'fix_blocked_items_and_resubmit';
  } else if (decision === DECISION.STOP) {
    status = STATUS.caution;
    nextAllowedAction = 'stop_experiment_and_analyze';
  } else if (decision === DECISION.SCALE) {
    status = STATUS.safe;
    nextAllowedAction = 'scale_up_experiment_with_increased_budget';
  } else {
    status = STATUS.safe;
    nextAllowedAction = decision === DECISION.GO ? 'proceed_with_experiment' : 'start_small_test';
  }

  // ── Spreadsheet row draft ──────────────────────────────────────────────────

  const spreadsheetRowDraft = {
    timestamp:   new Date().toISOString(),
    name,
    category,
    decision,
    initialBudget,
    actualCost,
    maxLoss,
    testPeriodDays: testPeriod,
    conversions,
    revenue,
    leads,
    inquiries,
    roi: parseFloat(roi.toFixed(2)),
    cpa: parseFloat(cpa.toFixed(2)),
    cpl: parseFloat(cpl.toFixed(2)),
    stopReasons: stopReasons.join('; '),
    scaleReasons: scaleReasons.join('; '),
    status,
    nextAction: nextAllowedAction,
  };

  const documentLogDraft = [
    `# Business Experiment Log: ${name}`,
    '',
    `## Plan`,
    `- **Category**: ${category || '(not set)'}`,
    `- **Objective**: ${objective || '(not set)'}`,
    `- **Hypothesis**: ${hypothesis || '(not set)'}`,
    `- **Initial Budget**: ¥${initialBudget.toLocaleString()}`,
    `- **Max Loss**: ¥${maxLoss.toLocaleString()}`,
    `- **Test Period**: ${testPeriod} days`,
    '',
    `## Results`,
    `- **Actual Cost**: ¥${actualCost.toLocaleString()}`,
    `- **Conversions**: ${conversions}`,
    `- **Revenue**: ¥${revenue.toLocaleString()}`,
    `- **ROI**: ${roi.toFixed(1)}%`,
    `- **Leads**: ${leads}`,
    `- **Inquiries**: ${inquiries}`,
    '',
    `## Decision: ${decision}`,
    stopReasons.length ? `\n### Stop Reasons\n${stopReasons.map(r => `- ${r}`).join('\n')}\n` : '',
    scaleReasons.length ? `\n### Scale Reasons\n${scaleReasons.map(r => `- ${r}`).join('\n')}\n` : '',
    '',
    `## Next Action`,
    nextAllowedAction,
    '',
    `(This is a dryRun draft. No real spreadsheet or document was written.)`,
  ].filter(Boolean).join('\n');

  return {
    tool:       TOOL_META.slug,
    version:    TOOL_META.version,
    timestamp:  new Date().toISOString(),
    dryRun:     true,
    status,
    decision,
    experiment: {
      name, category, objective, hypothesis,
      initialBudget, maxLoss, testPeriodDays: testPeriod,
      kpis, stopConditions: stopConds, scaleConditions: scaleConds,
      channels, owner: plan.owner || '',
    },
    resultSummary: {
      actualCost, conversions, revenue, impressions, leads, inquiries,
    },
    kpiSummary: {
      roi: parseFloat(roi.toFixed(2)),
      cpa: parseFloat(cpa.toFixed(2)),
      cpl: parseFloat(cpl.toFixed(2)),
    },
    budgetSummary: {
      initialBudget, actualCost, maxLoss,
      remaining: Math.max(0, initialBudget - actualCost),
      overBudget: actualCost > maxLoss,
    },
    stopReasons,
    scaleReasons,
    blockedReasons,
    cautions,
    nextAllowedAction,
    humanApprovalRequired,
    spreadsheetRowDraft,
    documentLogDraft,
    summaryForDashboard: {
      experimentName: name,
      category,
      decision,
      status,
      roi: parseFloat(roi.toFixed(2)),
      conversions,
      stopCount: stopReasons.length,
      scaleCount: scaleReasons.length,
      overBudget: actualCost > maxLoss,
      nextAllowedAction,
    },
  };
}

// ── Sample fixtures ───────────────────────────────────────────────────────────

const FIXTURES = {
  youtube: () => buildExperimentGate({
    experimentName: 'YouTube予算オーバー共通点動画企画',
    category: 'youtube',
    objective: '注文住宅で予算オーバーする人の共通点をテーマにした動画の反応検証',
    hypothesis: '予算オーバー不安は注文住宅検討者に刺さり視聴維持率向上に寄与する',
    initialBudget: 10000,
    maxLoss: 5000,
    testPeriodDays: 14,
    kpis: ['viewCount', 'retentionRate', 'inquiries'],
    stopConditions: ['CTR < 1% after 5000 impressions'],
    scaleConditions: ['inquiries > 10', 'retentionRate > 60%'],
    channels: ['youtube'],
  }),
  maxLossStop: () => {
    const gate = buildExperimentGate({
      experimentName: 'LP制作検証',
      category: 'lp',
      objective: '新LPの効果検証',
      hypothesis: '改善LPでCVR向上',
      initialBudget: 30000,
      maxLoss: 10000,
      testPeriodDays: 7,
    }, { actualCost: 15000, conversions: 2, revenue: 5000 });
    return gate;
  },
  scaleCondition: () => {
    const gate = buildExperimentGate({
      experimentName: 'SNS広告検証',
      category: 'ad',
      objective: 'SNS広告の効果測定',
      hypothesis: 'ターゲット広告でCPA改善',
      initialBudget: 50000,
      maxLoss: 30000,
      testPeriodDays: 30,
      scaleConditions: ['conversions > 50', 'CPA < 500'],
    }, { actualCost: 25000, conversions: 60, revenue: 200000, impressions: 50000, leads: 30 });
    return gate;
  },
  humanGate: () => buildExperimentGate({
    experimentName: '保険比較サイト検証',
    category: 'other',
    objective: '保険商品の比較検証',
    hypothesis: '保険比較で問い合わせ獲得',
    initialBudget: 50000,
    maxLoss: 20000,
  }),
  blocked: () => buildExperimentGate({
    experimentName: 'API key test',
    category: 'other',
    objective: 'test with api_key=sk-abc123',
    hypothesis: 'test',
    initialBudget: 1000,
    maxLoss: 500,
  }),
};

// ── CLI display ──────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
  gray: '\x1b[90m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

function printGate(result) {
  const dc = result.decision === 'GO' || result.decision === 'SCALE' ? 'green'
    : result.decision === 'SMALL_TEST' ? 'yellow'
    : result.decision === 'STOP' ? 'red'
    : 'magenta';

  console.log(`\n${c('bold', c('blue', '╡ KOSAME Business Experiment Gate & Ledger'))}  ${c('cyan', `v${result.version}`)}`);
  console.log(`  ${c('bold', 'Experiment:')} ${c('cyan', result.experiment.name || '(unnamed)')}  (${result.experiment.category || '-'})`);
  console.log(`  ${c('bold', 'Decision:')} ${c(dc, result.decision)}  |  ${c('bold', 'Status:')} ${c(dc, result.status.toUpperCase())}`);
  console.log(`  ${c('bold', 'Budget:')} ¥${result.budgetSummary.initialBudget.toLocaleString()} used ¥${result.resultSummary.actualCost.toLocaleString()} / max loss ¥${result.experiment.maxLoss.toLocaleString()}`);
  console.log(`  ${c('bold', 'ROI:')} ${result.kpiSummary.roi.toFixed(1)}%  |  ${c('bold', 'Conversions:')} ${result.resultSummary.conversions}`);
  console.log(`  ${c('bold', 'Next:')} ${c('bold', result.nextAllowedAction)}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  if (result.stopReasons.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'STOP REASONS'))}`);
    for (const r of result.stopReasons) console.log(`    ${c('red', '✗')} ${r}`);
  }
  if (result.scaleReasons.length > 0) {
    console.log(`\n  ${c('bold', c('green', 'SCALE REASONS'))}`);
    for (const r of result.scaleReasons) console.log(`    ${c('green', '✓')} ${r}`);
  }
  if (result.blockedReasons.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'BLOCKED'))}`);
    for (const r of result.blockedReasons) console.log(`    ${c('red', '✗')} ${r}`);
  }
  if (result.cautions.length > 0) {
    console.log(`\n  ${c('bold', c('yellow', 'CAUTIONS'))}`);
    for (const r of result.cautions) console.log(`    ${c('yellow', '⚠')} ${r}`);
  }

  console.log(`\n  ${c('bold', 'Spreadsheet Row Draft (dryRun)')}`);
  console.log(`    ${JSON.stringify(result.spreadsheetRowDraft)}`);

  console.log(`\n  ${c('bold', 'Document Log Draft (dryRun)')}`);
  for (const line of result.documentLogDraft.split('\n').slice(0, 8)) {
    console.log(`    ${line}`);
  }
  console.log(`    ${c('gray', '...')}`);

  console.log(`\n  ${c('bold', c('blue', '╡ End of Gate'))} ${c('gray', `decision: ${result.decision}`)}`);
  console.log('');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => {
    const eq = `--${name}=`;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === eq) return '';
      if (args[i].startsWith(eq)) return args[i].slice(eq.length);
    }
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
      return args[idx + 1];
    }
    return null;
  };
  return {
    experimentName: get('experimentName') || get('experiment-name') || '',
    category:       get('category') || '',
    objective:      get('objective') || '',
    hypothesis:     get('hypothesis') || '',
    initialBudget:  parseFloat(get('initialBudget') || get('initial-budget') || '0'),
    maxLoss:        parseFloat(get('maxLoss') || get('max-loss') || '0'),
    testPeriodDays: parseInt(get('testPeriodDays') || get('test-period-days') || '14'),
    json:           args.includes('--json'),
    dryRun:         !args.includes('--no-dry-run'),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  const result = buildExperimentGate({
    experimentName: cliArgs.experimentName,
    category:       cliArgs.category,
    objective:      cliArgs.objective,
    hypothesis:     cliArgs.hypothesis,
    initialBudget:  cliArgs.initialBudget,
    maxLoss:        cliArgs.maxLoss,
    testPeriodDays: cliArgs.testPeriodDays,
  });
  if (cliArgs.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printGate(result);
  }
}

module.exports = {
  TOOL_META,
  STATUS,
  DECISION,
  HIGH_RISK_PATTERNS,
  VALID_CATEGORIES,
  FIXTURES,
  buildExperimentGate,
  printGate,
};
