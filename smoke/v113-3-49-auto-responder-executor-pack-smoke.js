#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('=== v113.3.49 Auto-Responder / Executor Pack smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.49'), `version >= 113.3.49 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-49'], 'smoke:v113-3-49 must exist');
  console.log('  PASS package wiring');

  // ── ① Auto-Responder ──────────────────────────────────────
  const arPath = path.join(ROOT, 'tools', 'kosame-auto-responder.js');
  assert.ok(fs.existsSync(arPath), 'tools/kosame-auto-responder.js must exist');
  const arSrc = fs.readFileSync(arPath, 'utf8');

  // 自動YES パターン確認
  assert.ok(arSrc.includes('Continue?') || arSrc.includes('Continue\\?'), 'must handle Continue?');
  assert.ok(arSrc.includes('Proceed?') || arSrc.includes('Proceed\\?'), 'must handle Proceed?');
  assert.ok(arSrc.includes('y\\/') || arSrc.includes('y/N') || arSrc.includes('[Nn]'), 'must handle (y/N)');
  assert.ok(arSrc.includes('Do you want to'), 'must handle "Do you want to"');
  assert.ok(arSrc.includes('Press Enter'), 'must handle "Press Enter"');
  assert.ok(arSrc.includes('確認'), 'must handle 確認');
  assert.ok(arSrc.includes('続行'), 'must handle 続行');
  assert.ok(arSrc.includes('よろしいですか'), 'must handle よろしいですか');
  console.log('  PASS ① Auto-Responder 自動YES パターン（8種類）');

  // Safety Stop パターン確認
  assert.ok(arSrc.includes('SAFETY_STOP_PATTERNS'), 'must define SAFETY_STOP_PATTERNS');
  assert.ok(arSrc.includes('本番'), 'must detect 本番デプロイ');
  assert.ok(arSrc.includes('force'), 'must detect force-push');
  assert.ok(arSrc.includes('rm'), 'must detect rm -rf');
  assert.ok(arSrc.includes('SAFETY STOP'), 'must log SAFETY STOP');
  console.log('  PASS ② Safety Stop 条件（本番deploy/force push/rm -rf）手動確認維持');

  // ログ記録確認
  assert.ok(arSrc.includes('AUTO-YES'), 'must log AUTO-YES');
  assert.ok(arSrc.includes('appendFileSync') || arSrc.includes('log('), 'must write log file');
  assert.ok(arSrc.includes('auto-responder.log'), 'must log to auto-responder.log');
  console.log('  PASS ③ 自動応答ログ記録');

  // child_process spawn 確認
  assert.ok(arSrc.includes("require('node:child_process')"), 'must use node:child_process');
  assert.ok(arSrc.includes('spawn('), 'must use spawn');
  assert.ok(arSrc.includes("stdio: ['pipe'"), 'must pipe stdio');
  console.log('  PASS ④ 子プロセス stdout 監視（spawn + pipe）');

  // ── ② Executor Packet ────────────────────────────────────
  const generatorPath = path.join(ROOT, 'scripts', 'kosame-run-latest.sh');
  const entryPath = path.join(ROOT, '.kosame-executor', 'run-latest.sh');
  assert.ok(fs.existsSync(generatorPath), 'scripts/kosame-run-latest.sh must exist');
  assert.ok(fs.existsSync(entryPath), '.kosame-executor/run-latest.sh must exist');
  const genSrc = fs.readFileSync(generatorPath, 'utf8');
  const entrySrc = fs.readFileSync(entryPath, 'utf8');
  console.log('  PASS ⑤ Executor Packet ファイル存在確認');

  // Generator がすべてのステップを含む
  assert.ok(genSrc.includes('Dirty check'), 'generator must include dirty check');
  assert.ok(genSrc.includes('Smoke'), 'generator must include smoke');
  assert.ok(genSrc.includes('Verify'), 'generator must include verify');
  assert.ok(genSrc.includes('git add'), 'generator must include git add');
  assert.ok(genSrc.includes('Commit'), 'generator must include commit');
  assert.ok(genSrc.includes('Push'), 'generator must include push');
  assert.ok(genSrc.includes('Tag'), 'generator must include tag');
  assert.ok(genSrc.includes('Final Status'), 'generator must include final status');
  console.log('  PASS ⑥ Executor Packet ステップ完備（dirty/smoke/verify/add/commit/push/tag/status）');

  // 個別git add（git add -A 禁止）
  assert.ok(!genSrc.includes('git add -A') && !genSrc.includes('git add -a'), 'generator must NOT use git add -A');
  assert.ok(!entrySrc.includes('git add -A') && !entrySrc.includes('git add -a'), 'entry must NOT use git add -A');
  console.log('  PASS ⑦ git add -A 禁止（個別 add のみ）');

  // Entry point が generator を呼ぶ
  assert.ok(entrySrc.includes('kosame-run-latest.sh'), 'entry must call generator');
  console.log('  PASS ⑧ .kosame-executor/run-latest.sh → scripts/kosame-run-latest.sh 呼び出し');

  // ── ③ 禁止コマンド混入なし ───────────────────────────────
  const checkFiles = [generatorPath, entryPath, arPath];
  for (const filePath of checkFiles) {
    const src = fs.readFileSync(filePath, 'utf8');
    const name = path.relative(ROOT, filePath);
    // git add -A は禁止
    assert.ok(!/git\s+add\s+-A\b/.test(src), `${name}: git add -A 禁止`);
    // force push は禁止（フラグなし）
    assert.ok(!/git\s+push\s+.*--force(?!\s*#)/.test(src), `${name}: force push 禁止`);
    // rm -rf / は禁止
    assert.ok(!/rm\s+-rf\s+\/(?!\s*tmp|\s*\${)/.test(src), `${name}: rm -rf / 禁止`);
  }
  console.log('  PASS ⑨ 禁止コマンド混入なし（git add -A / force push / rm -rf /）');

  console.log('\n✅ v113.3.49 Auto-Responder / Executor Pack smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
