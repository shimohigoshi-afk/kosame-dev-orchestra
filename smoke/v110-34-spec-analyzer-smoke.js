'use strict';

/**
 * v110.34 smoke: kosame-spec-analyzer
 *
 * 検証項目:
 *  1. TOOL_META (version / slug / dryRunDefault)
 *  2. tokenize: 見出し抽出
 *  3. tokenize: チェックボックス抽出
 *  4. tokenize: 番号付きリスト・箇条書き抽出
 *  5. tokenize: コードブロック抽出
 *  6. extractTaskCandidates: 見出しベース候補生成
 *  7. extractTaskCandidates: 親子関係設定
 *  8. assignDifficultyAndAI: 難易度割り当て済み
 *  9. assignDifficultyAndAI: assignedAI.model / provider 存在
 * 10. assignDifficultyAndAI: escalationSteps 存在
 * 11. resolveDependencies: 依存関係配列が存在
 * 12. resolveDependencies: 番号付きリスト連番依存
 * 13. assignExecutionOrder: executionOrder 付与
 * 14. assignExecutionOrder: canParallel 付与
 * 15. analyzeSpec: 基本 dryRun 動作
 * 16. analyzeSpec: taskCount > 0
 * 17. analyzeSpec: summary.difficultyBreakdown 存在
 * 18. analyzeSpec: summary.executionPhases >= 1
 * 19. analyzeSpec: realProductActionsExecuted = false
 * 20. analyzeSpec: 空文字でエラー
 * 21. analyzeSpec: Markdownサンプル → 正しくタスク分解
 * 22. analyzeSpec: タスクに assignedAI が全件存在
 * 23. analyzeSpec: humanGate は high 難易度タスクのみ
 * 24. appendLearningLog: 例外なく実行（dryRun）
 * 25. autoRecord: learningLogAppended=true
 */

const assert = require('node:assert');
const spec   = require('../tools/kosame-spec-analyzer');

console.log('=== v110.34 spec-analyzer smoke ===');

let passed = 0;
function pass(msg) { passed++; console.log('  PASS:', msg); }
function fail(msg) { console.error('  FAIL:', msg); process.exit(1); }

// ── 1. TOOL_META ──────────────────────────────────────────────────────────────
assert.strictEqual(spec.TOOL_META.version,       '110.34.0');
assert.strictEqual(spec.TOOL_META.slug,          'kosame-spec-analyzer');
assert.strictEqual(spec.TOOL_META.dryRunDefault,  true);
pass('TOOL_META: version / slug / dryRunDefault');

// ── 2. tokenize: 見出し抽出 ───────────────────────────────────────────────────
const headingTokens = spec.tokenize('# Epic\n## Feature A\n### Task 1');
const headings = headingTokens.filter(t => t.type === 'heading');
assert.strictEqual(headings.length, 3);
assert.strictEqual(headings[0].level, 1);
assert.strictEqual(headings[0].text,  'Epic');
assert.strictEqual(headings[1].level, 2);
assert.strictEqual(headings[1].text,  'Feature A');
assert.strictEqual(headings[2].level, 3);
assert.strictEqual(headings[2].text,  'Task 1');
pass('tokenize: 見出しH1/H2/H3を正しく抽出');

// ── 3. tokenize: チェックボックス ────────────────────────────────────────────
const cbTokens = spec.tokenize('- [ ] TODO item A\n- [x] Done item B\n* [ ] Another');
const cbs      = cbTokens.filter(t => t.type === 'checkbox');
assert.strictEqual(cbs.length, 3);
assert.strictEqual(cbs[0].text, 'TODO item A');
assert.strictEqual(cbs[1].text, 'Done item B');
pass('tokenize: チェックボックス (- [ ] / - [x] / * [ ])');

// ── 4. tokenize: 番号付きリスト・箇条書き ────────────────────────────────────
const listTokens = spec.tokenize('1. 番号付き\n2. リスト\n- 箇条書き');
const nums    = listTokens.filter(t => t.type === 'numbered');
const bullets = listTokens.filter(t => t.type === 'bullet');
assert.strictEqual(nums.length, 2);
assert.strictEqual(bullets.length, 1);
assert.strictEqual(nums[0].text, '番号付き');
pass('tokenize: 番号付きリスト / 箇条書き');

// ── 5. tokenize: コードブロック ───────────────────────────────────────────────
const codeTokens = spec.tokenize('```js\nconsole.log("hello");\n```');
const codeToks   = codeTokens.filter(t => t.type === 'code');
assert.strictEqual(codeToks.length, 1);
assert.ok(codeToks[0].text.includes('console.log'));
pass('tokenize: コードブロック抽出');

// ── 6. extractTaskCandidates: 見出しベース ────────────────────────────────────
const md6 = '# Epic\n## Feature A\n### Task 1\n### Task 2';
const toks6 = spec.tokenize(md6);
const cands6 = spec.extractTaskCandidates(toks6);
assert.ok(cands6.length >= 4, `expected >=4 candidates, got ${cands6.length}`);
const epic = cands6.find(c => c.title === 'Epic');
assert.ok(epic, 'Epic task candidate exists');
assert.strictEqual(epic.headingLevel, 1);
pass('extractTaskCandidates: 見出しからタスク候補生成');

// ── 7. extractTaskCandidates: 親子関係 ────────────────────────────────────────
const featureA = cands6.find(c => c.title === 'Feature A');
const task1    = cands6.find(c => c.title === 'Task 1');
assert.ok(featureA, 'Feature A exists');
assert.ok(task1,    'Task 1 exists');
assert.strictEqual(task1.parentId, featureA.id);
pass('extractTaskCandidates: H3のparentIdがH2を指す');

// ── 8-10. assignDifficultyAndAI ───────────────────────────────────────────────
const md8  = '# 本番デプロイ手順\n## smoke test実行\n- [ ] implement: APIを実装する';
const toks8 = spec.tokenize(md8);
const cands8 = spec.extractTaskCandidates(toks8);
const withAI = spec.assignDifficultyAndAI(cands8, { dryRun: true });

assert.ok(withAI.every(t => ['light', 'medium', 'high'].includes(t.difficulty)));
pass('assignDifficultyAndAI: 全タスクに難易度設定');

assert.ok(withAI.every(t => t.assignedAI && t.assignedAI.model && t.assignedAI.provider));
pass('assignDifficultyAndAI: assignedAI.model / provider が全件存在');

assert.ok(withAI.every(t => Array.isArray(t.escalationSteps) && t.escalationSteps.length > 0));
pass('assignDifficultyAndAI: escalationSteps が全件存在');

// high 難易度（デプロイ含む見出し）
const deployTask = withAI.find(t => t.title.includes('デプロイ'));
assert.ok(deployTask, 'deploy task found');
assert.strictEqual(deployTask.difficulty, 'high');
assert.strictEqual(deployTask.humanGate,   true);

// smoke は light
const smokeTask = withAI.find(t => t.title.includes('smoke'));
assert.ok(smokeTask, 'smoke task found');
assert.strictEqual(smokeTask.difficulty, 'light');
pass('assignDifficultyAndAI: デプロイ→high/humanGate=true, smoke→light');

// ── 11-12. resolveDependencies ────────────────────────────────────────────────
const md11 = '## Setup\n1. DB初期化\n2. サーバー起動\n3. 動作確認';
const toks11 = spec.tokenize(md11);
const cands11 = spec.extractTaskCandidates(toks11);
const withDep = spec.resolveDependencies(spec.assignDifficultyAndAI(cands11, { dryRun: true }));

assert.ok(withDep.every(t => Array.isArray(t.dependencies)));
pass('resolveDependencies: 全タスクに dependencies 配列存在');

// 番号付きリスト: サーバー起動はDB初期化に依存
const dbTask     = withDep.find(t => t.title === 'DB初期化');
const serverTask = withDep.find(t => t.title === 'サーバー起動');
const verifyTask = withDep.find(t => t.title === '動作確認');
assert.ok(dbTask,     'DB初期化 task exists');
assert.ok(serverTask, 'サーバー起動 task exists');
assert.ok(verifyTask, '動作確認 task exists');
assert.ok(serverTask.dependencies.includes(dbTask.id), 'サーバー起動 depends on DB初期化');
assert.ok(verifyTask.dependencies.includes(serverTask.id), '動作確認 depends on サーバー起動');
pass('resolveDependencies: 番号付きリストの連番依存が正しく設定');

// ── 13-14. assignExecutionOrder ───────────────────────────────────────────────
const ordered = spec.assignExecutionOrder(withDep);
assert.ok(ordered.every(t => typeof t.executionOrder === 'number' && t.executionOrder >= 1));
pass('assignExecutionOrder: 全タスクに executionOrder >= 1');

assert.ok(ordered.every(t => typeof t.canParallel === 'boolean'));
pass('assignExecutionOrder: canParallel が boolean');

// DB初期化 < サーバー起動 < 動作確認
const ordDbTask  = ordered.find(t => t.title === 'DB初期化');
const ordSrvTask = ordered.find(t => t.title === 'サーバー起動');
const ordVerTask = ordered.find(t => t.title === '動作確認');
assert.ok(ordDbTask.executionOrder  < ordSrvTask.executionOrder, 'DB初期化 < サーバー起動');
assert.ok(ordSrvTask.executionOrder < ordVerTask.executionOrder, 'サーバー起動 < 動作確認');
pass('assignExecutionOrder: DB初期化→サーバー起動→動作確認の順序が正しい');

// ── 15-20. analyzeSpec ────────────────────────────────────────────────────────
const SAMPLE_SPEC = `
# ユーザー認証基盤 設計書

## 概要
ユーザーのログイン・ログアウト・セッション管理機能を実装する。

## 実装タスク

### フェーズ1: DB設計
1. usersテーブル設計
2. sessionsテーブル設計
3. マイグレーション作成

### フェーズ2: API実装
- [ ] ログインAPIを実装する
- [ ] ログアウトAPIを実装する
- [ ] セッション検証middlewareを実装する

### フェーズ3: テスト
- smoke test実行
- E2Eテスト実行

## デプロイ
本番環境へのデプロイ手順。
`;

// 15. dryRun動作
const result15 = spec.analyzeSpec(SAMPLE_SPEC, { dryRun: true });
assert.strictEqual(result15.dryRun,                    true);
assert.strictEqual(result15.realProductActionsExecuted, false);
assert.strictEqual(result15.dangerousActionsDenied,     true);
pass('analyzeSpec: dryRun / realProductActionsExecuted=false / dangerousActionsDenied=true');

// 16. taskCount > 0
assert.ok(result15.taskCount > 0, `taskCount=${result15.taskCount}`);
pass(`analyzeSpec: taskCount > 0 (${result15.taskCount}タスク検出)`);

// 17. summary.difficultyBreakdown
assert.ok(result15.summary.difficultyBreakdown, 'difficultyBreakdown exists');
const total = Object.values(result15.summary.difficultyBreakdown).reduce((a, b) => a + b, 0);
assert.strictEqual(total, result15.taskCount, 'difficulty breakdown合計=taskCount');
pass('analyzeSpec: summary.difficultyBreakdown 存在・合計一致');

// 18. executionPhases >= 1
assert.ok(result15.summary.executionPhases >= 1);
pass(`analyzeSpec: executionPhases >= 1 (${result15.summary.executionPhases}フェーズ)`);

// 19. realProductActionsExecuted = false（再確認）
assert.strictEqual(result15.realProductActionsExecuted, false);
pass('analyzeSpec: realProductActionsExecuted=false (dryRun)');

// 20. 空文字でエラー
assert.throws(() => spec.analyzeSpec(''), /non-empty/);
assert.throws(() => spec.analyzeSpec('   '), /non-empty/);
pass('analyzeSpec: 空文字・空白のみはエラー');

// ── 21. Markdownサンプル → タスク分解 ────────────────────────────────────────
const tasks = result15.tasks;
assert.ok(tasks.every(t => t.id && t.title && t.difficulty && t.assignedAI));
pass('analyzeSpec: 全タスクに id/title/difficulty/assignedAI が存在');

// 22. 全タスクに assignedAI
assert.ok(tasks.every(t => t.assignedAI && typeof t.assignedAI.model === 'string'));
pass('analyzeSpec: 全タスクに assignedAI.model が存在');

// 23. humanGate は high 難易度のみ
const humanGateTasks = tasks.filter(t => t.humanGate);
const nonHighHumanGate = humanGateTasks.filter(t => t.difficulty !== 'high');
assert.strictEqual(nonHighHumanGate.length, 0, 'humanGate=true は high 難易度のみ');
pass('analyzeSpec: humanGate=true は difficulty=high のタスクのみ');

// デプロイタスクが high
const deployResult = tasks.find(t => t.title.includes('デプロイ'));
assert.ok(deployResult, 'デプロイタスク存在');
assert.strictEqual(deployResult.difficulty, 'high');
pass('analyzeSpec: デプロイ含むタスクが difficulty=high');

// ── 24. appendLearningLog ──────────────────────────────────────────────────────
assert.doesNotThrow(() =>
  spec.appendLearningLog(result15, { dryRun: true })
);
pass('appendLearningLog: 例外なく実行される (dryRun)');

// ── 25. autoRecord ────────────────────────────────────────────────────────────
async function runAsync() {
  const rec = await spec.autoRecord(result15, { dryRun: true });
  assert.strictEqual(rec.learningLogAppended, true);
  assert.ok(rec.autoRecording);
  pass('autoRecord: learningLogAppended=true, autoRecording present');

  console.log(`\nPASS: v110.34 spec-analyzer smoke (${passed} checks)`);
}

runAsync().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
