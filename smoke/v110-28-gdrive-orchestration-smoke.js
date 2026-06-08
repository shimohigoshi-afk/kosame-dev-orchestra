#!/usr/bin/env node
'use strict';

/**
 * Smoke Test: Google Drive Writer Orchestration v110.28.0
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { run } = require('../tools/multi-agent-task-router');

const KOSAME_DIR = path.join(os.homedir(), '.kosame');
const LOG_FILE   = path.join(KOSAME_DIR, 'learning-log.jsonl');

async function main() {
  console.log('--- Smoke Test: v110.28 Google Drive Orchestration ---');

  // 1. 保存前のログファイルサイズを取得（存在しない場合は0）
  const initialSize = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;

  // 2. Router 実行 (dryRun)
  // --yes なしなので dryRun モード。recordTaskExecution も dryRun で動くはず。
  console.log('\n[Action] Running multi-agent-task-router...');
  const task = 'Implement v110.28 orchestration smoke test and update docs';
  const summary = await run(['node', 'tools/multi-agent-task-router.js', `--input=${task}`]);

  // 3. 検証: ローカルログが更新されたか
  if (!fs.existsSync(LOG_FILE)) {
    throw new Error('FAILED: Learning log file was not created.');
  }
  const finalSize = fs.statSync(LOG_FILE).size;
  if (finalSize <= initialSize) {
    throw new Error('FAILED: Learning log file was not updated.');
  }
  console.log('\n✅ Local learning log update verified.');

  // 4. 検証: ログ内容の妥当性
  const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
  const lastEntry = JSON.parse(lines[lines.length - 1]);
  
  console.log('  Last entry preview:', JSON.stringify(lastEntry));
  
  if (lastEntry.taskType !== 'multi-agent-route') throw new Error('FAILED: taskType mismatch');
  if (!lastEntry.difficulty) throw new Error('FAILED: difficulty missing');
  if (lastEntry.dryRun !== true) throw new Error('FAILED: dryRun flag mismatch');

  console.log('\n✅ Orchestration smoke test PASSED (dryRun mode)');
}

main().catch(err => {
  console.error('\n❌ Smoke test FAILED:', err.message);
  process.exit(1);
});
