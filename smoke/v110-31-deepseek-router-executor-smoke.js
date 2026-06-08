'use strict';

/**
 * v110.31 smoke: DeepSeek Router → Executor Pipeline
 *
 * 検証項目:
 *  1. multi-agent-task-router に pipeDeepSeekToExecutor が存在する
 *  2. KOSAME Patch Format を含む DeepSeek レスポンスが executor にパイプされる
 *  3. dryRun デフォルト (write: false) で実際にファイルを書かない
 *  4. human_gate フラグが結果に含まれる
 *  5. 危険パス (Secret/.env/credentials.json/node_modules 等) は拒否される
 *  6. --smoke なしでは smoke が実行されない
 *  7. commit/tag/push/deploy フラグが false
 *  8. kosame-command-inbox が wantsDeepSeek / DeepSeek provider を返す
 *  9. kosame-command-inbox の TOOL_META.version が 110.31.0
 * 10. multi-agent-task-router の parseArgs が --write / --smoke を解釈する
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = require('../tools/multi-agent-task-router');
const inbox  = require('../tools/kosame-command-inbox');
const executor = require('../tools/deepseek-local-patch-executor');

console.log('=== v110.31 deepseek-router-executor smoke ===');

function pass(msg) { console.log('  PASS:', msg); }

// ── 1. router に pipeDeepSeekToExecutor が存在する ───────────────────────────
assert.strictEqual(typeof router.pipeDeepSeekToExecutor, 'function');
pass('pipeDeepSeekToExecutor is exported from multi-agent-task-router');

// ── 2. KOSAME Patch Format → executor パイプ (dryRun) ───────────────────────
const validResponse = `[FILE] tmp/v110-31-test.js
\`\`\`js
'use strict';
console.log('v110.31 ok');
\`\`\`
`;

const mockResults = [
  { task: 'write test file', result: { response: validResponse, success: true, provider: 'deepseek' } }
];

const pipeOut = router.pipeDeepSeekToExecutor(mockResults, { write: false });
assert.strictEqual(pipeOut.length, 1);
assert.strictEqual(pipeOut[0].skipped, undefined);
assert.deepStrictEqual(pipeOut[0].patches, ['tmp/v110-31-test.js']);
assert.strictEqual(pipeOut[0].execResult.dryRun, true);
pass('KOSAME Patch Format response is piped to executor');

// ── 3. dryRun デフォルト — ファイルを書かない ────────────────────────────────
assert.strictEqual(pipeOut[0].execResult.dryRun, true);
assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'tmp/v110-31-test.js')), false);
pass('dryRun default: file is NOT written');

// ── 4. human_gate フラグ ─────────────────────────────────────────────────────
assert.strictEqual(pipeOut[0].human_gate, true);
assert.strictEqual(pipeOut[0].execResult.human_gate, true);
pass('human_gate: true is present in pipe result');

// ── 5. commit/tag/push/deploy は実行されない ─────────────────────────────────
assert.strictEqual(pipeOut[0].realGitActionsExecuted, false);
assert.strictEqual(pipeOut[0].realDeployActionsExecuted, false);
pass('realGitActionsExecuted and realDeployActionsExecuted are false');

// ── 6. 危険パス拒否 ──────────────────────────────────────────────────────────
const blockedPaths = [
  '.env',
  'credentials.json',
  'package-lock.json',
  'node_modules/x.js',
  '.kosame/config.json',
  'secret-key.txt',
];

for (const bp of blockedPaths) {
  assert.strictEqual(executor.isBlockedPath(bp), true, `expected ${bp} to be blocked`);
}
pass('dangerous paths (.env, credentials.json, package-lock, node_modules, .kosame, secret) are rejected');

// ── 7. [FILE] ブロックなしのレスポンスはスキップ ─────────────────────────────
const noPatches = [
  { task: 'normal text task', result: { response: 'このタスクは完了しました。', success: true } }
];
const noPipe = router.pipeDeepSeekToExecutor(noPatches, { write: false });
assert.strictEqual(noPipe[0].skipped, true);
assert.ok(noPipe[0].reason.includes('[FILE]'));
pass('response without [FILE] blocks is skipped gracefully');

// ── 8. レスポンスなしはスキップ ──────────────────────────────────────────────
const noResponse = [
  { task: 'empty response', result: { provider: 'deepseek' } }
];
const noRespPipe = router.pipeDeepSeekToExecutor(noResponse, { write: false });
assert.strictEqual(noRespPipe[0].skipped, true);
assert.strictEqual(noRespPipe[0].reason, 'no response');
pass('missing response is skipped gracefully');

// ── 9. smoke なしでは smoke が実行されない ───────────────────────────────────
const pipeNoSmoke = router.pipeDeepSeekToExecutor(mockResults, { write: false, smoke: '' });
assert.strictEqual(pipeNoSmoke[0].execResult.smoke, undefined);
pass('smoke is NOT executed when --smoke is not specified');

// ── 10. smoke は write: false では実行されない ───────────────────────────────
const pipeWithSmokeNoDryRun = router.pipeDeepSeekToExecutor(mockResults, { write: false, smoke: 'node --version' });
assert.strictEqual(pipeWithSmokeNoDryRun[0].execResult.smoke, undefined);
pass('smoke is NOT executed in dryRun mode even if --smoke is specified');

// ── 11. kosame-command-inbox: TOOL_META.version ──────────────────────────────
assert.strictEqual(inbox.TOOL_META.version, '110.31.0');
pass('kosame-command-inbox TOOL_META.version is 110.31.0');

// ── 12. kosame-command-inbox: wantsDeepSeek ──────────────────────────────────
assert.strictEqual(inbox.wantsDeepSeek('DeepSeekを使って'), true);
assert.strictEqual(inbox.wantsDeepSeek('ローカルパッチ実行'), true);
assert.strictEqual(inbox.wantsDeepSeek('KOSAME Patch Formatを適用'), true);
assert.strictEqual(inbox.wantsDeepSeek('Geminiで実装案'), false);
pass('wantsDeepSeek detects DeepSeek/local-patch/KOSAME Patch intent');

// ── 13. kosame-command-inbox: DeepSeek provider が plan に含まれる ────────────
const deepseekPlan = inbox.buildInboxPlan({ input: 'DeepSeekでパッチを生成して' });
const deepseekProvider = deepseekPlan.providers.find(p => p.provider === 'deepseek');
assert.ok(deepseekProvider, 'deepseek provider should be in plan');
assert.ok(deepseekProvider.action.includes('executor'));
pass('buildInboxPlan includes deepseek provider with executor action');

// ── 14. kosame-command-inbox: nextCommand が router を向く ───────────────────
const deepseekCommand = inbox.buildNextCommand({
  repo: { path: '~/kosame-dev-orchestra' },
  workType: 'implementation_planning',
  input: 'DeepSeekでパッチ生成',
});
assert.ok(deepseekCommand.includes('multi-agent-task-router'));
pass('buildNextCommand routes DeepSeek requests to multi-agent-task-router');

// ── 15. parseArgs: --write / --smoke を解釈 ──────────────────────────────────
const parsed = router.parseArgs(['node', 'router.js', '--input=test', '--write', '--smoke=node --version', '--yes']);
assert.strictEqual(parsed.write, true);
assert.strictEqual(parsed.smoke, 'node --version');
assert.strictEqual(parsed.yes, true);
pass('parseArgs correctly handles --write and --smoke');

const parsedDefault = router.parseArgs(['node', 'router.js', '--input=test']);
assert.strictEqual(parsedDefault.write, false);
assert.strictEqual(parsedDefault.smoke, '');
pass('parseArgs defaults: write=false, smoke=""');

// ── 16. 危険コンテンツは executor で拒否 ─────────────────────────────────────
const dangerousResponse = `[FILE] tmp/danger.js
\`\`\`js
require('child_process').execSync('git push origin main');
\`\`\`
`;
const dangerMock = [
  { task: 'danger task', result: { response: dangerousResponse, success: true } }
];
const dangerPipe = router.pipeDeepSeekToExecutor(dangerMock, { write: false });
assert.strictEqual(dangerPipe[0].execResult.ok, false);
assert.strictEqual(dangerPipe[0].execResult.reason, 'blocked patch target or content');
pass('dangerous content (git push) in patch is rejected by executor');

console.log('\nPASS: v110.31 deepseek-router-executor smoke');
