#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const WATCHER_PATH = path.join(ROOT, 'tools', 'kosame-codex-dispatch-watcher.js');
const POSTER_PATH = path.join(ROOT, 'tools', 'kosame-codex-result-poster.js');
const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

async function main() {
  console.log('=== v110.84.31 codex dispatch smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.31'), `version must be >= 110.84.31 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-31'], 'smoke:v110-84-31 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v110-84-31'), 'verify must include smoke:v110-84-31');
  assert.ok(pkg.scripts['runner:watch'], 'runner:watch script must exist');
  assert.ok(pkg.scripts['codex:submit'], 'codex:submit script must exist');
  assert.ok(pkg.scripts['runner:watch'].includes('kosame-codex-dispatch-watcher'), 'runner:watch must point to dispatch watcher');
  assert.ok(pkg.scripts['codex:submit'].includes('kosame-codex-result-poster'), 'codex:submit must point to result poster');
  console.log('  PASS: package wiring');

  assert.ok(fs.existsSync(WATCHER_PATH), 'kosame-codex-dispatch-watcher.js must exist');
  assert.ok(fs.existsSync(POSTER_PATH), 'kosame-codex-result-poster.js must exist');
  console.log('  PASS: tool files exist');

  // Watcher module exports
  delete require.cache[require.resolve(WATCHER_PATH)];
  const watcher = require(WATCHER_PATH);
  assert.ok(typeof watcher.extractResultBlock === 'function', 'dispatch watcher must export extractResultBlock');
  assert.ok(typeof watcher.readQueueCount === 'function', 'dispatch watcher must export readQueueCount');
  assert.ok(typeof watcher.readLatestEntry === 'function', 'dispatch watcher must export readLatestEntry');
  console.log('  PASS: watcher exports');

  // Poster module exports
  delete require.cache[require.resolve(POSTER_PATH)];
  const poster = require(POSTER_PATH);
  assert.ok(typeof poster.postResult === 'function', 'result poster must export postResult');
  assert.ok(typeof poster.parseArgs === 'function', 'result poster must export parseArgs');
  console.log('  PASS: poster exports');

  // extractResultBlock
  const noBlock = watcher.extractResultBlock('some output without a result block');
  assert.equal(noBlock, null, 'extractResultBlock must return null when no block found');

  const withBlock = watcher.extractResultBlock(
    'some preamble\nKOSAME_RESULT_BEGIN\n{"result_status":"success","smoke_result":"PASS"}\nKOSAME_RESULT_END\nsome suffix'
  );
  assert.ok(withBlock, 'extractResultBlock must parse JSON block');
  assert.equal(withBlock.result_status, 'success', 'extracted result_status must be success');
  assert.equal(withBlock.smoke_result, 'PASS', 'extracted smoke_result must be PASS');
  console.log('  PASS: extractResultBlock');

  // readQueueCount on missing dir
  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-dispatch-'));
  const count = watcher.readQueueCount(path.join(TEMP, 'nonexistent'));
  assert.equal(count, 0, 'readQueueCount must return 0 for missing dir');

  // readQueueCount on real queue
  const queueDir = path.join(TEMP, 'handoff');
  fs.mkdirSync(queueDir, { recursive: true });
  fs.writeFileSync(path.join(queueDir, 'queue.jsonl'), '{"id":"1","title":"test"}\n{"id":"2","title":"test2"}\n');
  const count2 = watcher.readQueueCount(queueDir);
  assert.equal(count2, 2, 'readQueueCount must count jsonl lines');
  const entry = watcher.readLatestEntry(queueDir);
  assert.ok(entry, 'readLatestEntry must return an entry');
  assert.equal(entry.id, '2', 'readLatestEntry must return the last entry');
  console.log('  PASS: readQueueCount / readLatestEntry');
  fs.rmSync(TEMP, { recursive: true, force: true });

  // parseArgs
  const parsed = poster.parseArgs(['node', 'script.js', '--status', 'success', '--summary', 'done']);
  assert.equal(parsed.status, 'success', 'parseArgs must parse --status');
  assert.equal(parsed.summary, 'done', 'parseArgs must parse --summary');
  console.log('  PASS: parseArgs');

  // Work order prompt includes result reporter instruction
  const chatSource = fs.readFileSync(CHAT_SERVER_PATH, 'utf8');
  assert.ok(chatSource.includes('kosame-codex-result-poster.js'), 'work order prompt must reference result poster');
  assert.ok(chatSource.includes('KOSAME_RESULT_BEGIN'), 'work order prompt must include KOSAME_RESULT_BEGIN marker');
  assert.ok(chatSource.includes('KOSAME_RESULT_END'), 'work order prompt must include KOSAME_RESULT_END marker');
  console.log('  PASS: work order prompt result reporter');

  // HTML: manual copy text removed
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(!html.includes('手動で Codex に貼り付けてください'), 'HTML must not say manual paste to Codex');
  assert.ok(!html.includes('Codexへ自動入力はしていません'), 'HTML must not say auto input skipped');
  assert.ok(html.includes('runner:watch') || html.includes('Runner watcher'), 'HTML must reference runner watcher');
  console.log('  PASS: HTML manual paste text removed');

  // Runtime: build work order and check result poster instruction in body
  delete require.cache[require.resolve(CHAT_SERVER_PATH)];
  const { handleChatRequest } = require(CHAT_SERVER_PATH);
  const r = await handleChatRequest({ message: '営業DXのv0.3.0を作業票化して' });
  assert.equal(r.ok, true, 'work order request must succeed');
  assert.ok(r.work_order, 'work order must be returned');
  assert.ok(r.work_order.body.includes('kosame-codex-result-poster.js'), 'work order body must include result poster');
  assert.ok(r.work_order.body.includes('KOSAME_RESULT_BEGIN'), 'work order body must include result marker');
  assert.ok(!r.work_order.body.includes('.env'), 'work order body must not contain .env literal');
  console.log('  PASS: work order body includes result poster (runtime)');

  console.log('✅ v110.84.31 codex dispatch smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
