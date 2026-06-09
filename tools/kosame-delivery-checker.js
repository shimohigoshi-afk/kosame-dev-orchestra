#!/usr/bin/env node
'use strict';

/**
 * KOSAME 納品前チェッカー v110.41.0
 *
 * Pipeline:
 *   1. DeepSeek → 実装
 *   2. GPT      → 裁定・レビュー
 *   3. Claude   → 最終品質チェック
 *   4. GPT + Claude → 納品前協議
 *   5. 品質基準クリア → じゅんやさんに提出
 *
 * dryRun デフォルト（--write で実際のAPI呼び出し）
 */

const {
  readConfig,
  callModel,
  callOpenAI,
  callAnthropic,
  TOOL_META: RUNTIME_META,
} = require('./kosame-cheap-first-runtime');

const { checkDeepSeekGuard } = require('./kosame-deepseek-project-guard');

const TOOL_META = {
  version:       '110.41.0',
  feature:       'v110-41-delivery-checker',
  slug:          'kosame-delivery-checker',
  dryRunDefault: true,
};

const DELIVERY_QUALITY_THRESHOLD = 75; // 100点満点中

// ── Colors ───────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', gray: '\x1b[90m',
  magenta: '\x1b[35m', bgGreen: '\x1b[42m', bgRed: '\x1b[41m',
};
const c  = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (len = 64) => '─'.repeat(len);

// ── Stage runners ─────────────────────────────────────────────────────────────

async function runImplementation(task, opts) {
  const { dryRun, config, project, out } = opts;
  out(`\n  ${c('cyan', '◆ Stage 1')} ${c('bold', 'DeepSeek — 実装')}`);
  out(`  ${c('dim', 'worker: cheap_code_worker (deepseek-chat)')}`);

  // DeepSeek ガードチェック
  const guard = checkDeepSeekGuard({ project, provider: 'deepseek', prompt: task, config });
  if (guard.blocked) {
    out(`  ${c('red', '⛔ DeepSeek ブロック')} [${guard.reason}]`);
    out(`  ${c('yellow', '↷')} ${guard.fallback} へ自動切替して実装します`);
    const worker = guard.fallback;
    if (dryRun) {
      return { stage: 'implement', worker, blocked: true, dryRun: true, response: `[DRY-RUN] ${worker} からの模擬実装\n\nfunction example() {\n  // 実装内容\n  return result;\n}` };
    }
    const r = await callModel(worker, `以下のタスクを実装してください:\n${task}`, config, { maxTokens: 2048 });
    return { stage: 'implement', worker, blocked: true, dryRun: false, response: r.response };
  }

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN]')} DeepSeek 模擬実装`);
    return {
      stage: 'implement', worker: 'cheap_code_worker', blocked: false, dryRun: true,
      response: `[DRY-RUN] DeepSeek 模擬実装\n\nfunction solve() {\n  // DeepSeek が生成した実装\n  const result = process(input);\n  return result;\n}`,
    };
  }

  const r = await callModel('cheap_code_worker', `以下のタスクを実装してください:\n${task}`, config, { maxTokens: 2048 });
  out(`  ${c('green', '✓')} 実装完了 (${r.response.length} chars)`);
  return { stage: 'implement', worker: 'cheap_code_worker', blocked: false, dryRun: false, response: r.response };
}

async function runGptArbitration(implResult, task, opts) {
  const { dryRun, config, out } = opts;
  out(`\n  ${c('cyan', '◆ Stage 2')} ${c('bold', 'GPT — 裁定・レビュー')}`);
  out(`  ${c('dim', 'worker: gpt_worker (gpt-4o-mini)')}`);

  const prompt = [
    `以下の実装を技術的にレビューしてください。`,
    `品質スコア(0-100)と改善点を JSON 形式で返してください。`,
    `フォーマット: {"score": <number>, "verdict": "<OK|NG>", "findings": "<所見>", "improvements": ["<改善点1>", ...]}`,
    ``,
    `【タスク】`,
    task.slice(0, 400),
    ``,
    `【実装】`,
    implResult.response.slice(0, 1200),
  ].join('\n');

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN]')} GPT 模擬レビュー`);
    return {
      stage: 'gpt_arbitrate', worker: 'gpt_worker', dryRun: true,
      score: 82,
      verdict: 'OK',
      findings: '[DRY-RUN] コード構造は良好。エラーハンドリングの追加を推奨。',
      improvements: ['エラーハンドリングを追加', '変数名をより説明的に'],
      raw: '[DRY-RUN]',
    };
  }

  const r = await callModel('gpt_worker', prompt, config, { maxTokens: 512 });
  let parsed = { score: 70, verdict: 'OK', findings: r.response, improvements: [] };
  try {
    const match = r.response.match(/\{[\s\S]*\}/);
    if (match) parsed = { ...parsed, ...JSON.parse(match[0]) };
  } catch (_) {}

  out(`  ${c('green', '✓')} GPT レビュー完了  スコア: ${parsed.score}/100  判定: ${parsed.verdict}`);
  return { stage: 'gpt_arbitrate', worker: 'gpt_worker', dryRun: false, ...parsed, raw: r.response };
}

async function runClaudeQualityCheck(implResult, gptResult, task, opts) {
  const { dryRun, config, out } = opts;
  out(`\n  ${c('cyan', '◆ Stage 3')} ${c('bold', 'Claude — 最終品質チェック')}`);
  out(`  ${c('dim', 'worker: claude_sonnet (claude-sonnet-4-6)')}`);

  const prompt = [
    `以下の実装を最終品質チェックしてください。`,
    `品質スコア(0-100)、判定（OK/NG）、所見を JSON 形式で返してください。`,
    `フォーマット: {"score": <number>, "verdict": "<OK|NG>", "quality_assessment": "<総合評価>", "ready_for_delivery": <true|false>}`,
    ``,
    `【タスク】`,
    task.slice(0, 400),
    ``,
    `【実装】`,
    implResult.response.slice(0, 1200),
    ``,
    `【GPTのレビュー結果】`,
    `スコア: ${gptResult.score}/100  判定: ${gptResult.verdict}`,
    `所見: ${gptResult.findings}`,
  ].join('\n');

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN]')} Claude 模擬品質チェック`);
    return {
      stage: 'claude_quality', worker: 'claude_sonnet', dryRun: true,
      score: 85,
      verdict: 'OK',
      quality_assessment: '[DRY-RUN] 実装品質は高い。GPTの指摘事項も妥当。納品可能水準。',
      ready_for_delivery: true,
      raw: '[DRY-RUN]',
    };
  }

  const r = await callModel('claude_sonnet', prompt, config, { maxTokens: 512 });
  let parsed = { score: 75, verdict: 'OK', quality_assessment: r.response, ready_for_delivery: true };
  try {
    const match = r.response.match(/\{[\s\S]*\}/);
    if (match) parsed = { ...parsed, ...JSON.parse(match[0]) };
  } catch (_) {}

  out(`  ${c('green', '✓')} Claude チェック完了  スコア: ${parsed.score}/100  判定: ${parsed.verdict}`);
  return { stage: 'claude_quality', worker: 'claude_sonnet', dryRun: false, ...parsed, raw: r.response };
}

async function runPreDeliveryConsultation(gptResult, claudeResult, task, opts) {
  const { dryRun, config, out } = opts;
  out(`\n  ${c('cyan', '◆ Stage 4')} ${c('bold', 'GPT + Claude — 納品前協議')}`);

  // GPT に Claude の評価を見せて最終判断を問う
  const gptFinalPrompt = [
    `Claudeの品質チェック結果: スコア ${claudeResult.score}/100, 判定 ${claudeResult.verdict}`,
    `評価: ${claudeResult.quality_assessment}`,
    ``,
    `あなた自身のレビュー: スコア ${gptResult.score}/100, 判定 ${gptResult.verdict}`,
    `所見: ${gptResult.findings}`,
    ``,
    `両者の評価を踏まえて、このタスク「${task.slice(0, 100)}」の納品を最終承認しますか？`,
    `JSON で返してください: {"approve": <true|false>, "reason": "<理由>", "final_score": <number>}`,
  ].join('\n');

  // Claude に GPT の評価を見せて最終判断を問う
  const claudeFinalPrompt = [
    `GPTの裁定結果: スコア ${gptResult.score}/100, 判定 ${gptResult.verdict}`,
    `所見: ${gptResult.findings}`,
    ``,
    `あなた自身のチェック: スコア ${claudeResult.score}/100, 判定 ${claudeResult.verdict}`,
    `評価: ${claudeResult.quality_assessment}`,
    ``,
    `両者の評価を踏まえて、このタスク「${task.slice(0, 100)}」の納品を最終承認しますか？`,
    `JSON で返してください: {"approve": <true|false>, "reason": "<理由>", "final_score": <number>}`,
  ].join('\n');

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN]')} GPT + Claude 模擬協議`);
    return {
      stage: 'pre_delivery_consultation', dryRun: true,
      gptFinal: { approve: true, reason: '[DRY-RUN] 実装品質・Claude評価ともに問題なし', final_score: 82 },
      claudeFinal: { approve: true, reason: '[DRY-RUN] GPT評価と一致。納品水準に達している', final_score: 85 },
      consensus: true,
      avgScore: 83.5,
    };
  }

  const [gptFinalRaw, claudeFinalRaw] = await Promise.all([
    callModel('gpt_upper', gptFinalPrompt, config, { maxTokens: 256 }),
    callModel('claude_sonnet', claudeFinalPrompt, config, { maxTokens: 256 }),
  ]);

  let gptFinal   = { approve: true, reason: gptFinalRaw.response,   final_score: gptResult.score   };
  let claudeFinal = { approve: true, reason: claudeFinalRaw.response, final_score: claudeResult.score };
  try {
    const gm = gptFinalRaw.response.match(/\{[\s\S]*\}/);
    if (gm) gptFinal = { ...gptFinal, ...JSON.parse(gm[0]) };
    const cm = claudeFinalRaw.response.match(/\{[\s\S]*\}/);
    if (cm) claudeFinal = { ...claudeFinal, ...JSON.parse(cm[0]) };
  } catch (_) {}

  const consensus = gptFinal.approve === true && claudeFinal.approve === true;
  const avgScore  = (gptFinal.final_score + claudeFinal.final_score) / 2;

  out(`  ${c('green', '✓')} GPT 最終判断: ${gptFinal.approve ? c('green', '✓ 承認') : c('red', '✗ 否決')}`);
  out(`  ${c('green', '✓')} Claude 最終判断: ${claudeFinal.approve ? c('green', '✓ 承認') : c('red', '✗ 否決')}`);
  out(`  合意: ${consensus ? c('green', '✓ 一致') : c('yellow', '△ 不一致')}  平均スコア: ${avgScore.toFixed(1)}/100`);

  return {
    stage: 'pre_delivery_consultation', dryRun: false,
    gptFinal, claudeFinal, consensus, avgScore,
  };
}

function printDeliveryReport(task, stages, deliveryResult, out) {
  out('\n  ' + hr());
  out(`  ${c('bold', '【納品前チェック レポート】')}  v${TOOL_META.version}`);
  out('  ' + hr());

  for (const s of stages) {
    const label = {
      implement:                  'Stage 1: DeepSeek 実装',
      gpt_arbitrate:              'Stage 2: GPT 裁定',
      claude_quality:             'Stage 3: Claude 品質チェック',
      pre_delivery_consultation:  'Stage 4: GPT + Claude 協議',
    }[s.stage] || s.stage;

    if (s.stage === 'pre_delivery_consultation') {
      out(`  ${c('dim', label)}`);
      out(`    GPT最終スコア: ${s.gptFinal?.final_score ?? 'n/a'}/100  Claude最終スコア: ${s.claudeFinal?.final_score ?? 'n/a'}/100`);
      out(`    合意: ${s.consensus ? '✓ あり' : '△ なし'}  平均スコア: ${s.avgScore?.toFixed(1) ?? 'n/a'}/100`);
    } else if (s.score !== undefined) {
      out(`  ${c('dim', label)}  スコア: ${s.score}/100  判定: ${s.verdict}`);
    } else {
      out(`  ${c('dim', label)}  (実装 ${s.response?.length ?? 0} chars)`);
    }
  }

  out('\n  ' + hr());
  if (deliveryResult.approved) {
    out(`  ${c('bgGreen', c('bold', '  ✓ 納品承認  '))}  最終スコア: ${deliveryResult.finalScore?.toFixed(1) ?? 'n/a'}/100`);
    out(`\n  ${c('bold', '📬 じゅんやさんへの提出')}`);
    out(`  タスク: ${task.slice(0, 80)}`);
    out(`  実装は品質基準 (${DELIVERY_QUALITY_THRESHOLD}/100) をクリアしました。`);
    out(`  GPT・Claude 両者が納品を承認しています。`);
    if (deliveryResult.dryRun) {
      out(`  ${c('yellow', '[DRY-RUN] 実際の提出はスキップされています。--write で実行してください。')}`);
    }
  } else {
    out(`  ${c('bgRed', c('bold', '  ✗ 納品却下  '))}  最終スコア: ${deliveryResult.finalScore?.toFixed(1) ?? 'n/a'}/100`);
    out(`  理由: ${deliveryResult.reason}`);
    out(`  品質基準 (${DELIVERY_QUALITY_THRESHOLD}/100) を満たしていません。実装の見直しが必要です。`);
  }
  out('');
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function runDeliveryCheck(task, opts = {}) {
  const {
    dryRun  = true,
    silent  = false,
    project = null,
  } = opts;

  const out    = silent ? () => {} : console.log;
  const config = readConfig();

  out('\n' + c('bold', c('blue', '⬡ KOSAME 納品前チェッカー')) + `  v${TOOL_META.version}`);
  out(`  タスク: ${task.slice(0, 80)}`);
  out(`  project: ${project ?? '(未指定)'}  dryRun: ${dryRun}`);
  out('  ' + hr());

  const stages  = [];
  const stageOpts = { dryRun, config, project, out };

  // Stage 1: DeepSeek 実装
  const implResult = await runImplementation(task, stageOpts);
  stages.push(implResult);

  // Stage 2: GPT 裁定
  const gptResult = await runGptArbitration(implResult, task, stageOpts);
  stages.push(gptResult);

  // Stage 3: Claude 最終品質チェック
  const claudeResult = await runClaudeQualityCheck(implResult, gptResult, task, stageOpts);
  stages.push(claudeResult);

  // Stage 4: GPT + Claude 納品前協議
  const consultResult = await runPreDeliveryConsultation(gptResult, claudeResult, task, stageOpts);
  stages.push(consultResult);

  // 納品判定
  const finalScore = consultResult.avgScore;
  const qualityOk  = finalScore >= DELIVERY_QUALITY_THRESHOLD;
  const consensusOk = consultResult.consensus !== false;
  const approved   = qualityOk && consensusOk;

  const deliveryResult = {
    approved,
    finalScore,
    reason: !qualityOk
      ? `平均スコア ${finalScore.toFixed(1)} が基準値 ${DELIVERY_QUALITY_THRESHOLD} 未満`
      : !consensusOk
        ? 'GPT・Claude の合意が得られませんでした'
        : null,
    dryRun,
  };

  if (!silent) printDeliveryReport(task, stages, deliveryResult, out);

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    ok:      approved,
    dryRun,
    task:    task.slice(0, 120),
    project,
    stages,
    delivery: deliveryResult,
    realProductActionsExecuted: !dryRun && approved,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const get = (name) => { const p = `--${name}=`; const a = argv.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  const has = (name) => argv.includes(`--${name}`);
  return {
    task:    get('task') || '',
    project: get('project') || null,
    dryRun:  !has('write'),
    silent:  has('silent'),
    json:    has('json'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.task) {
    console.log(`
${c('bold', 'Usage:')}
  node tools/kosame-delivery-checker.js --task="<タスク説明>"
  node tools/kosame-delivery-checker.js --task="..." --project=anesty-board
  node tools/kosame-delivery-checker.js --task="..." --write   # 実際のAPI呼び出し

Flags:
  --task=<str>     納品対象のタスク説明（必須）
  --project=<str>  プロジェクト識別子 (DeepSeekガード用)
  --write          dryRun を無効化（実際のAPI呼び出し）
  --silent         コンソール出力を抑制
  --json           JSON 出力
`);
    return;
  }

  const result = await runDeliveryCheck(args.task, {
    dryRun:  args.dryRun,
    silent:  args.silent || args.json,  // --json は stdout を JSON 専用にする
    project: args.project,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
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
  DELIVERY_QUALITY_THRESHOLD,
  runDeliveryCheck,
};
