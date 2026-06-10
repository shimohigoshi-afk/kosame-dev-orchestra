#!/usr/bin/env node
'use strict';

/**
 * KOSAME Auto Dev v110.42.0
 *
 * 設計書 → Claude Code 自動実行パイプライン
 *
 * フロー（タスク単位）:
 *   1. spec-analyzer でタスク自動分解
 *   2. human_gate (high難度 / 破壊的操作)
 *   3. Claude Code CLI (-p) で実装
 *   4. autoVerify (品質チェック)
 *      PASS → learning-log + GDrive 記録
 *      FAIL → project-guard 経由で許可モデルに修正依頼 → 再verify
 *   5. 全タスク完了 → GPT 裁定 → Claude 品質チェック
 *   6. じゅんやさんに Discord 報告
 *
 * 制約:
 *   - commit/push/deploy/Secret/IAM は自動実行禁止 → human_gate 必須
 *   - DeepSeek は project-guard 経由のみ (transcriber 完全禁止)
 *   - Claude Code 停止時 → 失敗分類 → 許可済みモデルで fallback
 *
 * Usage:
 *   npm run auto:dev -- --spec="設計書テキスト"
 *   npm run auto:dev -- --file=./spec.md
 *   npm run auto:dev -- --spec="..." --write          # 実際のAPI呼び出し
 *   npm run auto:dev -- --spec="..." --project=anesty-board
 *   npm run auto:dev -- --spec="..." --json           # JSON 出力
 */

const fs        = require('node:fs');
const path      = require('node:path');
const readline  = require('node:readline');
const { spawnSync } = require('node:child_process');

const TOOL_META = {
  version:       '110.42.0',
  feature:       'v110-42-auto-dev',
  slug:          'kosame-auto-dev',
  dryRunDefault: true,
};

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan:  '\x1b[36m', red:   '\x1b[31m', magenta: '\x1b[35m',
  bgRed: '\x1b[41m', bgYellow: '\x1b[43m', bgGreen: '\x1b[42m',
};
const c  = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (n = 64) => '─'.repeat(n);

// ── Destructive operation patterns (auto-force human_gate) ────────────────────

const DESTRUCTIVE_RE = /commit|push|deploy|リリース|本番|production|secret|iam|credentials|権限|delete|drop|truncate|rm\s|削除/i;

function requiresHumanGate(task) {
  return task.humanGate === true
    || task.difficulty === 'high'
    || DESTRUCTIVE_RE.test(task.title + ' ' + (task.description || ''));
}

// ── Claude Code failure classification ───────────────────────────────────────

const CLAUDE_FAILURE = {
  AUTH:       'auth',          // 認証切れ → cheapFirstRun fallback
  RATE_LIMIT: 'rate_limit',    // 利用上限 → wait & fallback
  HUMAN_GATE: 'human_gate',    // 承認プロンプトで停止 → human_gate 必須
  TIMEOUT:    'timeout',       // タイムアウト → fallback
  GENERIC:    'generic',       // その他 → fallback
};

function classifyClaudeFailure(error, stderr, status) {
  const msg = ((error?.message || '') + ' ' + (stderr || '')).toLowerCase();
  if (/authentication|api.?key|401|unauthorized/.test(msg))
    return { type: CLAUDE_FAILURE.AUTH,       fallback: 'cheapFirstRun' };
  if (/rate.?limit|quota|429|too many/.test(msg))
    return { type: CLAUDE_FAILURE.RATE_LIMIT, fallback: 'cheapFirstRun' };
  if (/permission|approval|human.*gate|approve/.test(msg))
    return { type: CLAUDE_FAILURE.HUMAN_GATE, fallback: null };
  if (error?.code === 'ETIMEDOUT' || error?.code === 'ENOBUFS')
    return { type: CLAUDE_FAILURE.TIMEOUT,    fallback: 'cheapFirstRun' };
  return { type: CLAUDE_FAILURE.GENERIC,      fallback: 'cheapFirstRun' };
}

// ── Task prompt builder ───────────────────────────────────────────────────────

function buildTaskPrompt(task, project) {
  const parts = [
    `## タスク: ${task.title}`,
    task.description ? task.description : '',
    task.dependencies?.length > 0 ? `依存タスク: ${task.dependencies.join(', ')}` : '',
    project ? `プロジェクト: ${project}` : '',
    `難易度: ${task.difficulty}`,
    '',
    '上記タスクを実装してください。コードと実装の説明を返してください。',
  ].filter(Boolean);
  return parts.join('\n');
}

// ── Claude Code CLI execution ─────────────────────────────────────────────────

async function executeClaude(task, opts = {}) {
  const { dryRun = true, project = null, out = console.log } = opts;
  const startMs = Date.now();

  if (dryRun) {
    out(`     ${c('yellow', '[DRY-RUN]')} Claude Code 模擬実装`);
    return {
      success: true, dryRun: true,
      output:  `[DRY-RUN] claude -p 模擬実装\n\nfunction ${task.title.replace(/\s+/g, '_').slice(0, 20)}() {\n  // 実装\n}`,
      model:    'claude-sonnet-4-6',
      provider: 'anthropic',
      durationMs: 400 + Math.round(Math.random() * 400),
    };
  }

  const prompt = buildTaskPrompt(task, project);
  const result = spawnSync(
    'claude',
    ['--print', '--output-format', 'text', prompt],
    { encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }
  );
  const durationMs = Date.now() - startMs;

  if (result.error || (result.status !== 0 && result.status !== null)) {
    const failure = classifyClaudeFailure(result.error, result.stderr, result.status);
    out(`     ${c('red', '✗')} Claude Code 失敗 [${failure.type}]: ${(result.error?.message || result.stderr || '').slice(0, 80)}`);
    return { success: false, dryRun: false, failure, output: result.stderr || result.error?.message || '', durationMs };
  }

  return {
    success: true, dryRun: false,
    output:   result.stdout || '',
    model:    'claude-sonnet-4-6',
    provider: 'anthropic',
    durationMs,
  };
}

// ── Auto verify ───────────────────────────────────────────────────────────────

function autoVerify(task, output, opts = {}) {
  const { checkQuality } = require('./kosame-cheap-first-runtime');
  const taskType = task.difficulty === 'high' ? 'code' : 'implement';

  // 基本品質チェック（runtime共通）
  const quality = checkQuality(output, taskType);
  if (!quality.ok) {
    return { pass: false, score: 30, reason: `品質不足 [${quality.reason}]` };
  }

  // 明らかなエラーパターン
  if (/^(Error|エラー|Failed|失敗|Exception)/im.test(output.trim())) {
    return { pass: false, score: 20, reason: 'エラーレスポンス検出' };
  }

  // コードタスクの長さ確認
  if (['code', 'implement'].includes(taskType) && output.length < 100) {
    return { pass: false, score: 40, reason: 'コード実装が短すぎる' };
  }

  const score = Math.min(100, 60 + Math.round(output.length / 100));
  return { pass: true, score, reason: 'OK' };
}

// ── Fix with project-guard-aware model ───────────────────────────────────────

async function fixWithPermittedModel(task, output, failReason, opts = {}) {
  const { dryRun = true, project = null, config, out = console.log } = opts;
  const { callModel, readConfig } = require('./kosame-cheap-first-runtime');
  const { checkDeepSeekGuard }    = require('./kosame-deepseek-project-guard');

  const cfg = config || readConfig();

  const fixPrompt = [
    `以下のタスクの実装に問題があります。修正してください。`,
    `タスク: ${task.title}`,
    `問題: ${failReason}`,
    `現在の実装:`,
    output.slice(0, 1200),
  ].join('\n');

  // DeepSeek プロジェクトガード
  const guard = checkDeepSeekGuard({ project, provider: 'deepseek', prompt: fixPrompt, config: cfg });
  const worker = guard.blocked ? guard.fallback : 'cheap_code_worker';
  if (guard.blocked) {
    out(`     ${c('yellow', '↷')} DeepSeek ブロック [${guard.reason}] → ${worker} で修正`);
  } else {
    out(`     ${c('cyan', '↷')} ${worker} (DeepSeek) で修正中...`);
  }

  if (dryRun) {
    return {
      dryRun: true, worker,
      output: `[DRY-RUN] ${worker} 修正応答\n\nfunction fixed() {\n  // 修正済み実装\n}`,
    };
  }

  const r = await callModel(worker, fixPrompt, cfg, { maxTokens: 2048 });
  return { dryRun: false, worker, output: r.response };
}

// ── Learning log + GDrive recording ──────────────────────────────────────────

function recordTaskResult(task, result, opts = {}) {
  const { dryRun = true } = opts;
  try {
    const { appendLog } = require('./kosame-learning-log');
    appendLog({
      taskInput:  task.title.slice(0, 120),
      taskType:   'implement',
      difficulty: task.difficulty,
      model:      result.model    || 'claude-sonnet-4-6',
      provider:   result.provider || 'anthropic',
      costUsd:    result.costUsd  ?? null,
      durationMs: result.durationMs ?? null,
      success:    result.success  ?? false,
      escalated:  result.fixed    ?? false,
      dryRun,
      meta: { feature: TOOL_META.feature, taskId: task.id, autoDev: true, verifyPass: result.verifyPass },
    }, { dryRun });
  } catch (_) {}
}

async function recordToGDrive(runResult, opts = {}) {
  const { dryRun = true } = opts;
  const writer = (() => { try { return require('./kosame-gdrive-writer'); } catch { return null; } })();
  if (!writer) return { ok: false, reason: 'kosame-gdrive-writer not found' };
  const content = [
    `AutoDev v${TOOL_META.version}`,
    `tasks=${runResult.taskCount}`,
    `pass=${runResult.passCount}`,
    `fixed=${runResult.fixedCount}`,
    `failed=${runResult.failedCount}`,
  ].join(' | ');
  let sheetRes = null, docRes = null;
  try { sheetRes = await writer.writeSheetsRows({ dryRun, tail: runResult.taskCount + 1 }); } catch (e) { sheetRes = { ok: false, error: e.message }; }
  try { docRes   = await writer.writeDocsEntry({ dryRun, version: TOOL_META.version, content }); } catch (e) { docRes   = { ok: false, error: e.message }; }
  return { ok: true, dryRun, sheetRes, docRes };
}

// ── GPT arbitration + Claude quality review (final) ──────────────────────────

async function reviewAllResults(taskResults, opts = {}) {
  const { dryRun = true, config, out = console.log } = opts;
  const { callModel, readConfig } = require('./kosame-cheap-first-runtime');
  const cfg = config || readConfig();

  const summary = taskResults.map((r, i) =>
    `タスク${i + 1}: ${r.title.slice(0, 60)} — ${r.verifyPass ? '✓ PASS' : '✗ FAIL'}${r.fixed ? ' (修正済)' : ''}`
  ).join('\n');

  out(`\n  ${c('cyan', '◆ Final Review')} ${c('bold', 'GPT 裁定 + Claude 品質チェック')}`);

  const gptPrompt = [
    `以下の自動開発セッションの全タスク実装結果を裁定してください。`,
    `品質スコア(0-100)と総合所見を JSON で返してください。`,
    `フォーマット: {"score": <number>, "verdict": "<OK|NG>", "summary": "<所見>"}`,
    ``, `【実装結果サマリー】`, summary,
  ].join('\n');

  const claudePrompt = [
    `以下の自動開発セッションの最終品質チェックをしてください。`,
    `品質スコア(0-100)と納品可否を JSON で返してください。`,
    `フォーマット: {"score": <number>, "ready": <true|false>, "assessment": "<評価>"}`,
    ``, `【実装結果サマリー】`, summary,
  ].join('\n');

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN]')} GPT + Claude 模擬レビュー`);
    return {
      gpt:     { score: 82, verdict: 'OK', summary: '[DRY-RUN] 全タスク品質水準クリア' },
      claude:  { score: 85, ready: true, assessment: '[DRY-RUN] 実装品質は高く納品可能水準' },
      avgScore: 83.5,
      approved: true,
      dryRun:   true,
    };
  }

  const [gptRaw, claudeRaw] = await Promise.all([
    callModel('gpt_upper',    gptPrompt,    cfg, { maxTokens: 512 }).catch(e => ({ response: e.message })),
    callModel('claude_sonnet', claudePrompt, cfg, { maxTokens: 512 }).catch(e => ({ response: e.message })),
  ]);

  let gpt    = { score: 70, verdict: 'OK',  summary:    gptRaw.response };
  let claude = { score: 70, ready:   true,  assessment: claudeRaw.response };
  try { const m = gptRaw.response.match(/\{[\s\S]*\}/);    if (m) gpt    = { ...gpt,    ...JSON.parse(m[0]) }; } catch (_) {}
  try { const m = claudeRaw.response.match(/\{[\s\S]*\}/); if (m) claude = { ...claude, ...JSON.parse(m[0]) }; } catch (_) {}

  const avgScore = (gpt.score + claude.score) / 2;
  const approved = avgScore >= 75 && claude.ready !== false && gpt.verdict !== 'NG';

  out(`  GPT スコア: ${gpt.score}/100  Claude スコア: ${claude.score}/100  平均: ${avgScore.toFixed(1)}`);
  out(`  判定: ${approved ? c('bgGreen', c('bold', ' ✓ 承認 ')) : c('bgRed', c('bold', ' ✗ 否決 '))}`);

  return { gpt, claude, avgScore, approved, dryRun: false };
}

// ── Discord report ────────────────────────────────────────────────────────────

async function sendDiscordReport(summary, opts = {}) {
  const { dryRun = true, out = console.log } = opts;
  const { notify } = (() => { try { return require('./real-time-progress-notifier'); } catch { return { notify: null }; } })();
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  const lines = [
    `⬡ KOSAME Auto Dev v${TOOL_META.version} — 完了報告`,
    `タスク: ${summary.taskCount}件 / PASS: ${summary.passCount} / 修正: ${summary.fixedCount} / FAIL: ${summary.failedCount}`,
    `最終スコア: ${summary.reviewScore?.toFixed(1) ?? '-'}/100  判定: ${summary.approved ? '✓ 承認' : '✗ 否決'}`,
    summary.approved
      ? `じゅんやさん、全タスクの実装と品質チェックが完了しました。commit 承認をお願いします。`
      : `じゅんやさん、品質基準に満たないタスクがあります。確認をお願いします。`,
  ];
  const message = lines.join('\n');
  out(`\n  ${c('bold', '📬 じゅんやさんへの報告')}`);
  out(`  ${message.replace(/\n/g, '\n  ')}`);

  if (!notify || !webhookUrl) {
    if (!dryRun && !webhookUrl) out(`  ${c('yellow', '⚠  DISCORD_WEBHOOK_URL 未設定 — Discord 通知スキップ')}`);
    return { ok: false, reason: !notify ? 'notifier unavailable' : 'no webhook url', dryRun };
  }

  const r = await notify('done', { message }, { discord: { url: webhookUrl } }, { dryRun, silent: true });
  out(`  Discord: ${r.results?.[0]?.sent ? c('green', '✓ 送信済み') : c('dim', '[DRY-RUN]')}`);
  return { ok: true, dryRun, sent: r.results?.[0]?.sent ?? false };
}

// ── Human gate ────────────────────────────────────────────────────────────────

async function waitForHumanGate(task, opts = {}) {
  const { dryRun = true, out = console.log } = opts;

  out(`\n  ${c('bgRed', c('bold', '  ⛔ HUMAN GATE  '))}`);
  out(`  タスク: ${c('bold', task.title.slice(0, 60))}`);
  out(`  難易度: ${c('red', task.difficulty)}  ID: ${task.id}`);
  if (DESTRUCTIVE_RE.test(task.title + ' ' + (task.description || ''))) {
    out(`  ${c('yellow', '⚠  破壊的操作パターン検出 — 自動実行禁止')}`);
  }

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN] 承認をスキップ')}`);
    return true;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(`  ${c('bold', 'このタスクを承認しますか？')} (yes/no) > `, answer => {
      rl.close();
      const ok = /^y(es)?$/i.test(answer.trim());
      out(ok ? `  ${c('green', '✓ 承認')}` : `  ${c('red', '✗ 却下')}`);
      resolve(ok);
    });
  });
}

// ── Single task pipeline ──────────────────────────────────────────────────────

async function runTask(task, opts = {}) {
  const { dryRun = true, project = null, config, out = console.log } = opts;
  const startMs = Date.now();

  out(`\n    ${c('gray', task.id)}  ${c(task.difficulty === 'high' ? 'red' : task.difficulty === 'medium' ? 'yellow' : 'green', task.difficulty.padEnd(7))}  ${c('bold', task.title.slice(0, 60))}`);

  // 1. Human gate
  if (requiresHumanGate(task)) {
    const approved = await waitForHumanGate(task, { dryRun, out });
    if (!approved) {
      return { taskId: task.id, title: task.title, difficulty: task.difficulty, success: false, skipped: true, reason: '却下', durationMs: Date.now() - startMs, verifyPass: false };
    }
  }

  // 2. Claude Code 実装
  out(`     ${c('dim', 'Claude Code へ投げ中...')}`);
  const claudeResult = await executeClaude(task, { dryRun, project, out });

  // Claude Code 失敗 → fallback
  let implOutput  = claudeResult.output;
  let implModel   = claudeResult.model   ?? 'claude-sonnet-4-6';
  let implProvider = claudeResult.provider ?? 'anthropic';
  let usedFallback = false;

  if (!claudeResult.success) {
    const failure = claudeResult.failure;
    if (failure?.type === CLAUDE_FAILURE.HUMAN_GATE) {
      out(`     ${c('red', '⛔ Claude Code 承認プロンプト停止 → human_gate 必須')}`);
      const approved = await waitForHumanGate(task, { dryRun, out });
      if (!approved) {
        return { taskId: task.id, title: task.title, difficulty: task.difficulty, success: false, skipped: true, reason: 'Claude Code HUMAN_GATE', durationMs: Date.now() - startMs, verifyPass: false };
      }
    }
    if (failure?.fallback === 'cheapFirstRun') {
      out(`     ${c('yellow', '↷')} Claude Code ${failure?.type ?? 'error'} → cheapFirstRun で代替実行`);
      const { cheapFirstRun, readConfig } = require('./kosame-cheap-first-runtime');
      const cfg = config || readConfig();
      const cf = await cheapFirstRun(buildTaskPrompt(task, project), task.difficulty, {
        dryRun, silent: true, skipHumanGate: true,
        taskInput: task.title.slice(0, 120), taskType: 'implement', project,
      });
      implOutput   = cf.response ?? '';
      implModel    = cf.usedModel  ?? 'unknown';
      implProvider = require('./kosame-cheap-first-runtime').PRICE_TABLE[implModel]?.provider ?? 'unknown';
      usedFallback = true;
      if (!cf.ok) {
        return { taskId: task.id, title: task.title, difficulty: task.difficulty, success: false, skipped: false, reason: cf.error ?? 'cheapFirstRun failed', durationMs: Date.now() - startMs, verifyPass: false, model: implModel, provider: implProvider };
      }
    }
  }

  // 3. Auto verify
  const verify1 = autoVerify(task, implOutput, {});
  out(`     verify: ${verify1.pass ? c('green', `✓ PASS (${verify1.score})`) : c('red', `✗ FAIL (${verify1.score}) [${verify1.reason}]`)}`);

  let verifyPass   = verify1.pass;
  let finalOutput  = implOutput;
  let fixedModel   = null;
  let fixedProvider = null;
  let fixed        = false;

  if (!verify1.pass) {
    // 4. project-guard 経由で修正
    const fixResult = await fixWithPermittedModel(task, implOutput, verify1.reason, {
      dryRun, project, config, out,
    });
    fixedModel    = fixResult.worker;
    fixedProvider = fixResult.worker === 'cheap_code_worker' ? 'deepseek' : 'openai';
    finalOutput   = fixResult.output;
    fixed         = true;

    // 再verify
    const verify2 = autoVerify(task, finalOutput, {});
    verifyPass = verify2.pass;
    out(`     re-verify: ${verify2.pass ? c('green', `✓ PASS (${verify2.score})`) : c('red', `✗ FAIL (${verify2.score})`)}`);
  }

  // 5. 記録
  const taskResult = {
    taskId:    task.id,
    title:     task.title,
    difficulty: task.difficulty,
    model:     fixed ? fixedModel    : implModel,
    provider:  fixed ? fixedProvider : implProvider,
    success:   true,
    skipped:   false,
    verifyPass,
    fixed,
    usedFallback,
    output:    finalOutput,
    costUsd:   claudeResult.costUsd ?? null,
    durationMs: Date.now() - startMs,
    timestamp: new Date().toISOString(),
  };

  if (verifyPass) {
    recordTaskResult(task, taskResult, { dryRun });
    out(`     ${c('dim', '記録済 → learning-log / GDrive')}`);
  }

  return taskResult;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

async function runAutoDev(specText, opts = {}) {
  const {
    dryRun  = true,
    silent  = false,
    project = null,
    jsonMode = false,
    maxTasks = 50,
  } = opts;

  const out = (silent || jsonMode)
    ? (...a) => process.stderr.write(a.join(' ') + '\n')
    : console.log;

  const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  out(`\n${c('bold', c('blue', '⬡ KOSAME Auto Dev'))}  ${dryLabel}  v${TOOL_META.version}`);
  out(`  project: ${project ?? '(未指定)'}  maxTasks: ${maxTasks}`);
  out('  ' + hr());

  // Step 1: spec-analyzer でタスク分解
  out(`\n  ${c('bold', '📋 設計書解析中...')}`);
  const { analyzeSpec } = require('./kosame-spec-analyzer');
  const { readConfig }  = require('./kosame-cheap-first-runtime');
  const config = readConfig();

  const analysis = analyzeSpec(specText, { dryRun, maxTasks });
  out(`  ${c('green', '✓')} ${analysis.taskCount} タスク / ${analysis.summary.executionPhases} フェーズ`);
  const { difficultyBreakdown: diff, humanGateCount } = analysis.summary;
  const diffParts = Object.entries(diff).filter(([, n]) => n > 0)
    .map(([d, n]) => `${c(d === 'high' ? 'red' : d === 'medium' ? 'yellow' : 'green', d)}:${n}`).join('  ');
  if (diffParts) out(`  難易度: ${diffParts}`);
  if (humanGateCount > 0) out(`  ${c('red', `⚠  HUMAN GATE: ${humanGateCount} タスク`)}`);

  // Step 2: フェーズ別タスク実行
  out(`\n  ${c('bold', '🚀 実行開始')}`);
  const allResults = [];
  const maxOrder   = analysis.summary.executionPhases;

  for (let order = 1; order <= maxOrder; order++) {
    const batch = analysis.tasks.filter(t => t.executionOrder === order);
    if (batch.length === 0) continue;
    out(`\n  ${c('magenta', `── Phase ${order}`)} (${batch.length} タスク)`);

    for (const task of batch) {
      const result = await runTask(task, { dryRun, project, config, out });
      allResults.push(result);
    }
  }

  // Step 3: 集計
  const passCount   = allResults.filter(r => r.verifyPass && !r.skipped).length;
  const fixedCount  = allResults.filter(r => r.fixed).length;
  const failedCount = allResults.filter(r => !r.verifyPass && !r.skipped).length;
  const skippedCount = allResults.filter(r => r.skipped).length;

  out(`\n  ${c('bold', '📊 集計')}`);
  out(`  PASS: ${c('green', String(passCount))}  修正後PASS: ${c('yellow', String(fixedCount))}  FAIL: ${c('red', String(failedCount))}  スキップ: ${skippedCount}`);

  // Step 4: GPT裁定 + Claude品質チェック
  const review = await reviewAllResults(allResults, { dryRun, config, out });

  // Step 5: GDrive 全体記録
  const runSummary = {
    taskCount: allResults.length,
    passCount, fixedCount, failedCount, skippedCount,
    reviewScore: review.avgScore,
    approved: review.approved,
  };
  const gdrive = await recordToGDrive(runSummary, { dryRun });

  // Step 6: Discord 報告
  await sendDiscordReport(runSummary, { dryRun, out });

  const runResult = {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    project,
    specLength: specText.length,
    taskCount:  allResults.length,
    passCount, fixedCount, failedCount, skippedCount,
    review,
    gdrive,
    tasks: allResults,
    realProductActionsExecuted: !dryRun,
  };

  return runResult;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const get = (name) => { const p = `--${name}=`; const a = argv.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  const has = (name) => argv.includes(`--${name}`);
  return {
    spec:     get('spec')     || null,
    file:     get('file')     || null,
    project:  get('project')  || null,
    maxTasks: parseInt(get('max-tasks') || '50', 10),
    dryRun:   !has('write'),
    silent:   has('silent'),
    json:     has('json'),
  };
}

async function main() {
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
  npm run auto:dev -- --spec="設計書テキスト"
  npm run auto:dev -- --file=./spec.md
  npm run auto:dev -- --spec="..." --write          # 実際のAPI呼び出し
  npm run auto:dev -- --spec="..." --project=anesty-board
  npm run auto:dev -- --spec="..." --json

Flags:
  --spec=<str>      設計書テキスト（必須 or --file）
  --file=<path>     設計書ファイルパス
  --project=<str>   プロジェクト識別子 (DeepSeekガード用)
  --max-tasks=<n>   最大タスク数 (default: 50)
  --write           dryRun 無効化（実際の API 呼び出し）
  --silent          コンソール出力抑制
  --json            JSON 出力
`);
    return;
  }

  const result = await runAutoDev(specText, {
    dryRun:   args.dryRun,
    silent:   args.silent || args.json,
    project:  args.project,
    jsonMode: args.json,
    maxTasks: args.maxTasks,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!args.silent) {
    console.log('\n  ' + hr());
    if (result.review.approved) {
      console.log(`  ${c('bgGreen', c('bold', '  ✓ 全タスク完了・承認  '))}  スコア: ${result.review.avgScore?.toFixed(1)}/100`);
    } else {
      console.log(`  ${c('bgRed', c('bold', '  要確認  '))}  スコア: ${result.review.avgScore?.toFixed(1)}/100`);
    }
    console.log('');
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
  runAutoDev,
  runTask,
  executeClaude,
  autoVerify,
  fixWithPermittedModel,
  reviewAllResults,
  sendDiscordReport,
  classifyClaudeFailure,
};
