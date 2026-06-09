#!/usr/bin/env node
'use strict';

/**
 * KOSAME Spec Analyzer v110.34.0
 *
 * 設計書（テキスト/Markdown）を自動解析してタスクに分解する。
 *
 * 機能:
 *   - Markdown/テキストの設計書からタスクを自動抽出
 *   - タスクごとに難易度・担当AIを自動割り当て（v110.24連携）
 *   - 依存関係を解析して実行順序を自動決定（トポロジカルソート）
 *   - 結果を learning-log / autoRecording に記録
 *
 * Usage:
 *   npm run spec:analyze -- --input="設計書テキスト"
 *   npm run spec:analyze -- --file=./spec.md
 *   npm run spec:analyze -- --input="..." --json
 *   npm run spec:analyze -- --input="..." --write   # learning-log書き込み
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const TOOL_META = {
  version:      '110.34.0',
  feature:      'v110-34-spec-analyzer',
  slug:         'kosame-spec-analyzer',
  dryRunDefault: true,
};

const KOSAME_DIR = path.join(os.homedir(), '.kosame');
const LOG_FILE   = path.join(KOSAME_DIR, 'learning-log.jsonl');

// ── 依存関係キーワード ──────────────────────────────────────────────────────────

const DEP_KEYWORDS_JA = [
  'の後', 'が前提', 'を前提', 'に依存', 'の完了後',
  'が完了したら', 'の実装後', 'を利用', 'を使って',
  'を使用して', 'の結果を', 'のあと',
];
const DEP_KEYWORDS_EN = [
  'after', 'depends on', 'requires', 'following', 'once',
  'needs', 'based on', 'uses', 'with result of',
];

// ステップ順序パターン（これがあれば前のタスクへの依存を自動追加）
const STEP_PATTERNS = [
  /^(step|ステップ|フェーズ|phase|stage)\s*[\d１２３４５６７８９]+/i,
  /^\d+\.\s/,
  /^第[\d一二三四五六七八九十]+[段回章節]/,
];

// ── Markdownパーサー ────────────────────────────────────────────────────────────

/**
 * Markdownテキストをトークン列に変換する。
 *
 * @param {string} text
 * @returns {Array<{type, level, text, raw, indent}>}
 */
function tokenize(text) {
  const lines   = text.split('\n');
  const tokens  = [];
  let inCode    = false;
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // コードブロック開閉
    if (/^```/.test(line)) {
      if (inCode) {
        tokens.push({ type: 'code', text: codeLines.join('\n'), raw: line, indent: 0 });
        codeLines = [];
        inCode    = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    // 見出し
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      tokens.push({ type: 'heading', level: hMatch[1].length, text: hMatch[2].trim(), raw: line, indent: 0 });
      continue;
    }

    // チェックボックス
    const cbMatch = line.match(/^(\s*)[-*]\s+\[[ xX]\]\s+(.+)$/);
    if (cbMatch) {
      tokens.push({ type: 'checkbox', level: 0, text: cbMatch[2].trim(), raw: line, indent: cbMatch[1].length });
      continue;
    }

    // 番号付きリスト
    const numMatch = line.match(/^(\s*)\d+[.)]\s+(.+)$/);
    if (numMatch) {
      tokens.push({ type: 'numbered', level: 0, text: numMatch[2].trim(), raw: line, indent: numMatch[1].length });
      continue;
    }

    // 箇条書き
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      tokens.push({ type: 'bullet', level: 0, text: bulletMatch[2].trim(), raw: line, indent: bulletMatch[1].length });
      continue;
    }

    // 空白以外のテキスト行
    const trimmed = line.trim();
    if (trimmed) {
      tokens.push({ type: 'text', level: 0, text: trimmed, raw: line, indent: 0 });
    }
  }

  return tokens;
}

// ── タスク候補抽出 ──────────────────────────────────────────────────────────────

/**
 * トークン列からタスク候補を抽出する。
 * 見出し・チェックボックス・番号付きリスト・箇条書きを対象とする。
 *
 * @param {Array} tokens
 * @returns {Array<{id, title, description, source, parentId, tokens}>}
 */
function extractTaskCandidates(tokens) {
  const candidates = [];
  let idCounter    = 1;

  // 見出しスタックで親子関係を管理
  const headingStack = []; // [{ level, id }]

  // 前の番号付きリストID（同インデント内の前タスクを参照）
  const numberedStack = {}; // indent → last id

  function makeId() {
    return `T${String(idCounter++).padStart('3', '0')}`;
  }

  function findParentId(currentLevel) {
    for (let i = headingStack.length - 1; i >= 0; i--) {
      if (headingStack[i].level < currentLevel) return headingStack[i].id;
    }
    return null;
  }

  for (const tok of tokens) {
    if (tok.type === 'heading') {
      const id       = makeId();
      const parentId = findParentId(tok.level);

      // 同レベル以上のスタックをクリア
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= tok.level) {
        headingStack.pop();
      }
      headingStack.push({ level: tok.level, id });

      candidates.push({
        id,
        title:       tok.text,
        description: '',
        source:      `heading-h${tok.level}`,
        parentId,
        isHeading:   true,
        headingLevel: tok.level,
        rawKeywords: tok.text,
      });

    } else if (tok.type === 'checkbox' || tok.type === 'bullet' || tok.type === 'numbered') {
      const id       = makeId();
      const parentId = headingStack.length > 0 ? headingStack[headingStack.length - 1].id : null;

      // 番号付きリストの連番依存を追跡
      let prevNumberedId = null;
      if (tok.type === 'numbered') {
        prevNumberedId = numberedStack[tok.indent] || null;
        numberedStack[tok.indent] = id;
      } else {
        // 番号付き以外はindentのカウンタをリセット
        delete numberedStack[tok.indent];
      }

      candidates.push({
        id,
        title:          tok.text,
        description:    '',
        source:         tok.type,
        parentId,
        prevNumberedId,
        isHeading:      false,
        rawKeywords:    tok.text,
      });

    } else if (tok.type === 'code') {
      // コードブロックは実装タスクとして追加（親見出しがあれば）
      if (headingStack.length > 0) {
        const parent = candidates.find(c => c.id === headingStack[headingStack.length - 1].id);
        if (parent) {
          parent.description += `\n[実装コードブロックあり]`;
          parent.hasCodeBlock = true;
        }
      }

    } else if (tok.type === 'text') {
      // テキスト行は最後の候補の説明に追加
      if (candidates.length > 0) {
        candidates[candidates.length - 1].description += ' ' + tok.text;
      }
    }
  }

  // 見出しのみでリーフでないタスクを除去するか判断
  // → 子タスクが存在する見出しはエピック/グループとして残す
  for (const c of candidates) {
    c.description = c.description.trim();
    c.children    = candidates.filter(x => x.parentId === c.id).map(x => x.id);
    c.isLeaf      = c.children.length === 0;
  }

  return candidates;
}

// ── 難易度・担当AI割り当て ────────────────────────────────────────────────────

const { classifyDifficulty, buildEscalationPlan, TOOL_META: ROUTER_META } = require('./kosame-difficulty-model-router');

/**
 * タスク候補リストに難易度・担当AIを割り当てる。
 *
 * コンテキスト加重:
 *   - 見出しレベルが浅い (H1/H2) → 難易度を medium 以上に強制
 *   - コードブロックあり → medium 以上
 *   - チェックボックス/箇条書きの軽量タスク → light を許可
 *
 * @param {Array} candidates
 * @param {object} opts { dryRun }
 * @returns {Array}
 */
function assignDifficultyAndAI(candidates, opts = {}) {
  const { dryRun = true } = opts;

  return candidates.map(c => {
    const text    = `${c.title} ${c.description}`.trim();
    let result    = classifyDifficulty(text);

    // コンテキスト補正: H1のみ light→medium 強制（H2以下は本来の判定を尊重）
    if (c.isHeading && c.headingLevel === 1 && result.difficulty === 'light') {
      result = { ...result, difficulty: 'medium', confidence: 'medium', source: 'context-heading' };
    }
    if (c.hasCodeBlock && result.difficulty === 'light') {
      result = { ...result, difficulty: 'medium', confidence: 'medium', source: 'context-code' };
    }

    const plan = buildEscalationPlan(result.difficulty, { dryRun, input: c.title });
    const primary = plan.startWith;

    return {
      ...c,
      difficulty:      result.difficulty,
      difficultyConf:  result.confidence,
      difficultySource: result.source,
      matchedKeywords: result.matchedKeywords,
      humanGate:       plan.humanGate,
      assignedAI: {
        model:    primary.model,
        provider: primary.provider,
      },
      escalationSteps: plan.steps.map(s => ({
        order:    s.order,
        model:    s.model,
        provider: s.provider,
        role:     s.role,
        available: s.available,
      })),
    };
  });
}

// ── 依存関係解析 ────────────────────────────────────────────────────────────────

/**
 * テキスト中に別タスクのタイトルへの参照・依存キーワードがあるか検出する。
 *
 * @param {string} text  検索対象テキスト
 * @param {Array}  others  他タスク候補リスト
 * @returns {string[]} 依存しているタスクIDリスト
 */
function detectKeywordDeps(text, others) {
  const lower  = text.toLowerCase();
  const depIds = new Set();

  const allKws = [...DEP_KEYWORDS_JA, ...DEP_KEYWORDS_EN];
  const hasDep = allKws.some(kw => lower.includes(kw.toLowerCase()));
  if (!hasDep) return [];

  // 他タスクのタイトルと一致するものを依存として記録
  for (const other of others) {
    const otherTitle = other.title.toLowerCase();
    if (otherTitle.length >= 4 && lower.includes(otherTitle)) {
      depIds.add(other.id);
    }
  }

  return [...depIds];
}

/**
 * ステップパターンを持つか確認する。
 * @param {string} title
 */
function isStepTask(title) {
  return STEP_PATTERNS.some(p => p.test(title.trim()));
}

/**
 * タスク候補に依存関係を解析して設定する。
 *
 * 依存ソース:
 *   1. 親子構造（子は親に依存）
 *   2. 番号付きリストの連番（前の番号付きに依存）
 *   3. ステップパターン（Step1→Step2→...の連番内で依存）
 *   4. キーワードベースのタイトル参照
 *
 * @param {Array} tasks
 * @returns {Array}
 */
function resolveDependencies(tasks) {
  const result = tasks.map(t => ({ ...t, dependencies: [] }));
  const byId   = Object.fromEntries(result.map(t => [t.id, t]));

  // 同一親の兄弟をグループ化（ステップ検出に使用）
  const siblings = {};
  for (const t of result) {
    const key = t.parentId || '__root__';
    if (!siblings[key]) siblings[key] = [];
    siblings[key].push(t.id);
  }

  for (const t of result) {
    const deps = new Set();

    // 1. 親子依存（子は親に依存）
    if (t.parentId && byId[t.parentId]) {
      // 直接親が見出しの場合は依存に追加（実行順序のため）
      if (byId[t.parentId].isHeading) {
        deps.add(t.parentId);
      }
    }

    // 2. 番号付きリスト連番依存
    if (t.prevNumberedId && byId[t.prevNumberedId]) {
      deps.add(t.prevNumberedId);
    }

    // 3. 同一親内のステップパターン（Step N → Step N+1）
    if (isStepTask(t.title)) {
      const sibGroup = siblings[t.parentId || '__root__'] || [];
      const myIdx    = sibGroup.indexOf(t.id);
      if (myIdx > 0) {
        const prevSib = sibGroup[myIdx - 1];
        if (isStepTask(byId[prevSib]?.title || '')) {
          deps.add(prevSib);
        }
      }
    }

    // 4. キーワードベース依存（自分以外のタスクを対象に）
    const others   = result.filter(x => x.id !== t.id);
    const kwDeps   = detectKeywordDeps(`${t.title} ${t.description}`, others);
    for (const d of kwDeps) deps.add(d);

    t.dependencies = [...deps];
  }

  return result;
}

// ── トポロジカルソート（実行順序決定）─────────────────────────────────────────

/**
 * Kahn's algorithmでトポロジカルソートし、実行順序を割り当てる。
 * 同一順序（依存がない or 同じ依存セット）のタスクはcanParallel=true。
 *
 * @param {Array} tasks
 * @returns {Array} executionOrder と canParallel を付与したタスクリスト
 */
function assignExecutionOrder(tasks) {
  const ids    = tasks.map(t => t.id);
  const byId   = Object.fromEntries(tasks.map(t => [t.id, t]));

  // In-degree計算
  const inDeg  = Object.fromEntries(ids.map(id => [id, 0]));
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (byId[dep]) inDeg[t.id] = (inDeg[t.id] || 0) + 1;
    }
  }

  // Reverse adj（誰に依存されているか）
  const revAdj = Object.fromEntries(ids.map(id => [id, []]));
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (revAdj[dep]) revAdj[dep].push(t.id);
    }
  }

  const result     = tasks.map(t => ({ ...t, executionOrder: 0, canParallel: false }));
  const byIdResult = Object.fromEntries(result.map(t => [t.id, t]));
  const queue      = ids.filter(id => inDeg[id] === 0);
  let   order      = 1;

  while (queue.length > 0) {
    // 同じ順序を同時付与
    const batch = [...queue];
    queue.length = 0;

    for (const id of batch) {
      byIdResult[id].executionOrder = order;
      byIdResult[id].canParallel    = batch.length > 1;
    }

    for (const id of batch) {
      for (const next of revAdj[id]) {
        inDeg[next]--;
        if (inDeg[next] === 0) queue.push(next);
      }
    }
    order++;
  }

  // 循環依存があった場合（order=0のまま）→ 最後に追加
  for (const t of result) {
    if (t.executionOrder === 0) t.executionOrder = order;
  }

  return result.sort((a, b) => a.executionOrder - b.executionOrder);
}

// ── メイン解析関数 ─────────────────────────────────────────────────────────────

/**
 * 設計書テキストを解析してタスクリストを返す。
 *
 * @param {string} specText  設計書テキスト（Markdown or プレーンテキスト）
 * @param {object} opts
 *   dryRun   {boolean}  default true
 *   maxTasks {number}   タスク上限 (default 50)
 * @returns {object} analyzeResult
 */
function analyzeSpec(specText, opts = {}) {
  const { dryRun = true, maxTasks = 50 } = opts;

  if (!specText || typeof specText !== 'string' || !specText.trim()) {
    throw new Error('specText must be a non-empty string');
  }

  const tokens     = tokenize(specText);
  let   candidates = extractTaskCandidates(tokens);

  // 上限カット（見出しタスクを優先して残す）
  if (candidates.length > maxTasks) {
    const headings = candidates.filter(c => c.isHeading);
    const leaves   = candidates.filter(c => !c.isHeading);
    candidates     = [...headings, ...leaves].slice(0, maxTasks);
  }

  const withAI   = assignDifficultyAndAI(candidates, { dryRun });
  const withDeps = resolveDependencies(withAI);
  const ordered  = assignExecutionOrder(withDeps);

  // サマリー集計
  const diffCounts = { light: 0, medium: 0, high: 0 };
  const aiCounts   = {};
  let   humanGateCount = 0;

  for (const t of ordered) {
    diffCounts[t.difficulty] = (diffCounts[t.difficulty] || 0) + 1;
    const key = `${t.assignedAI.provider}/${t.assignedAI.model}`;
    aiCounts[key] = (aiCounts[key] || 0) + 1;
    if (t.humanGate) humanGateCount++;
  }

  const maxOrder     = Math.max(...ordered.map(t => t.executionOrder));
  const parallelSets = [];
  for (let o = 1; o <= maxOrder; o++) {
    const batch = ordered.filter(t => t.executionOrder === o);
    if (batch.length > 1) {
      parallelSets.push({ order: o, taskIds: batch.map(t => t.id), count: batch.length });
    }
  }

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied:     true,
    specLength:  specText.length,
    taskCount:   ordered.length,
    tasks:       ordered,
    summary: {
      totalTasks:     ordered.length,
      difficultyBreakdown: diffCounts,
      aiAssignment:   aiCounts,
      humanGateCount,
      executionPhases:  maxOrder,
      parallelSets,
      routerVersion:  ROUTER_META.version,
    },
  };
}

// ── Learning-log / autoRecording ──────────────────────────────────────────────

function appendLearningLog(result, opts = {}) {
  const { dryRun = true } = opts;
  const entry = {
    ts:         new Date().toISOString(),
    taskType:   'implement',
    difficulty: 'medium',
    model:      'n/a',
    provider:   'spec-analyzer',
    costUsd:    null,
    durationMs: null,
    success:    result.taskCount > 0,
    escalated:  false,
    dryRun,
    taskInput:  `spec:analyze specLength=${result.specLength} tasks=${result.taskCount}`.slice(0, 120),
    meta: { feature: TOOL_META.feature, taskCount: result.taskCount },
  };

  try {
    if (!fs.existsSync(KOSAME_DIR)) fs.mkdirSync(KOSAME_DIR, { recursive: true });
    if (!dryRun) fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch { /* non-fatal */ }
}

async function autoRecord(result, opts = {}) {
  const { dryRun = true } = opts;
  appendLearningLog(result, { dryRun });

  let sheetRes = null;
  let docRes   = null;

  try {
    const gdriveWriter = require('./kosame-gdrive-writer');
    const content = [
      `SpecAnalyzer v${TOOL_META.version}`,
      `specLength=${result.specLength} tasks=${result.taskCount}`,
      `phases=${result.summary.executionPhases}`,
      `humanGates=${result.summary.humanGateCount}`,
    ].join(' | ');

    const writerOpts = {
      dryRun:  true,
      tail:    1,
      content,
      version: TOOL_META.version,
    };

    if (typeof gdriveWriter.writeSheetLog === 'function') {
      sheetRes = await gdriveWriter.writeSheetLog(writerOpts);
    }
    if (typeof gdriveWriter.writeDocLog === 'function') {
      docRes = await gdriveWriter.writeDocLog(writerOpts);
    }
  } catch { /* non-fatal: gdrive optional */ }

  return { learningLogAppended: true, autoRecording: { sheetRes, docRes } };
}

// ── CLI printer ───────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m', bold:   '\x1b[1m', dim:    '\x1b[2m',
  green:  '\x1b[32m', yellow: '\x1b[33m', blue:   '\x1b[34m',
  cyan:   '\x1b[36m', red:    '\x1b[31m', gray:   '\x1b[90m', magenta: '\x1b[35m',
};
const c = (col, t) => `${C[col]}${t}${C.reset}`;

const DIFF_COLOR = { light: 'green', medium: 'yellow', high: 'red' };

function printResult(result) {
  const dryLabel = result.dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Spec Analyzer'))}  ${dryLabel}  v${result.version}`);
  console.log(`  設計書 ${result.specLength} 文字 → ${c('bold', String(result.taskCount))} タスクに分解`);

  const s = result.summary;
  console.log(`\n  ${c('bold', '難易度内訳:')}`);
  for (const [d, n] of Object.entries(s.difficultyBreakdown)) {
    if (n > 0) console.log(`    ${c(DIFF_COLOR[d] || 'gray', d.padEnd(8))} ${n} タスク`);
  }

  if (s.humanGateCount > 0) {
    console.log(`  ${c('red', `⚠ HUMAN GATE 必須: ${s.humanGateCount} タスク`)}`);
  }

  console.log(`\n  ${c('bold', '担当AI:')}`);
  for (const [ai, n] of Object.entries(s.aiAssignment)) {
    console.log(`    ${c('cyan', ai.padEnd(36))} ${n} タスク`);
  }

  console.log(`\n  ${c('bold', '実行順序')} (${s.executionPhases} フェーズ):`);

  let lastOrder = 0;
  for (const t of result.tasks) {
    if (t.executionOrder !== lastOrder) {
      console.log(`\n  ${c('magenta', `── Phase ${t.executionOrder}`)} ${t.canParallel ? c('green', '[並列実行可]') : ''}`);
      lastOrder = t.executionOrder;
    }

    const diff   = c(DIFF_COLOR[t.difficulty] || 'gray', t.difficulty.padEnd(7));
    const ai     = c('cyan', `${t.assignedAI.provider}/${t.assignedAI.model}`.slice(0, 30));
    const gate   = t.humanGate ? c('red', ' [GATE]') : '';
    const depStr = t.dependencies.length > 0 ? c('dim', ` ← ${t.dependencies.join(',')}`) : '';
    const leaf   = !t.isLeaf ? c('dim', ' [グループ]') : '';

    console.log(`    ${c('gray', t.id)}  ${diff}  ${ai}${gate}  ${c('bold', t.title.slice(0, 50))}${leaf}${depStr}`);
  }

  if (s.parallelSets.length > 0) {
    console.log(`\n  ${c('bold', '並列実行セット:')}`);
    for (const ps of s.parallelSets) {
      console.log(`    Phase ${ps.order}: ${ps.taskIds.join(', ')} (${ps.count} タスク同時)`);
    }
  }

  console.log('');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args  = argv.slice(2);
  const get   = prefix => (args.find(a => a.startsWith(prefix)) ?? '').slice(prefix.length) || null;
  const has   = flag   => args.includes(flag);

  return {
    input:    get('--input='),
    file:     get('--file='),
    json:     has('--json'),
    write:    has('--write'),
    record:   has('--record'),
    maxTasks: parseInt(get('--max-tasks=') || '50', 10),
  };
}

async function main() {
  const args = parseArgs(process.argv);

  let specText = args.input || '';
  if (!specText && args.file) {
    const filePath = path.resolve(args.file);
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: file not found: ${filePath}`);
      process.exit(1);
    }
    specText = fs.readFileSync(filePath, 'utf8');
  }

  if (!specText) {
    console.log(JSON.stringify({
      tool:    TOOL_META,
      usage: [
        'npm run spec:analyze -- --input="設計書テキスト"',
        'npm run spec:analyze -- --file=./spec.md',
        'npm run spec:analyze -- --input="..." --json',
        'npm run spec:analyze -- --input="..." --write   # learning-log書き込み',
        'npm run spec:analyze -- --input="..." --record  # autoRecording有効',
      ],
    }, null, 2));
    return;
  }

  const dryRun = !args.write;
  const result = analyzeSpec(specText, { dryRun, maxTasks: args.maxTasks });

  if (args.record || !args.json) {
    const recording = await autoRecord(result, { dryRun });
    result._recording = recording;
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }

  process.exit(result.taskCount > 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}

module.exports = {
  TOOL_META,
  tokenize,
  extractTaskCandidates,
  assignDifficultyAndAI,
  resolveDependencies,
  assignExecutionOrder,
  analyzeSpec,
  appendLearningLog,
  autoRecord,
};
