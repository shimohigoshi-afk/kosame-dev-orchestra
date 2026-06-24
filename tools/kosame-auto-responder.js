#!/usr/bin/env node
'use strict';

/**
 * Kosame Auto-Responder
 * 子プロセスの確認プロンプトを検出して自動でYESを送信する。
 * 本番デプロイ・force push・rm -rf 等のSafety Stop条件は手動確認のまま。
 *
 * Usage:
 *   node tools/kosame-auto-responder.js <command> [args...]
 *   node tools/kosame-auto-responder.js npm run smoke:v113-3-49
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// 自動YES対象パターン
const AUTO_YES_PATTERNS = [
  /Continue\?/i,
  /Proceed\?/i,
  /\(y\/[Nn]\)/,
  /\[y\/[Nn]\]/i,
  /Do you want to/i,
  /Press Enter/i,
  /Are you sure\?/i,
  /確認してください/,
  /続行しますか/,
  /よろしいですか/,
  /実行しますか/,
];

// Safety Stop: 絶対に自動応答しないパターン
const SAFETY_STOP_PATTERNS = [
  /本番.*デプロイ/,
  /本番デプロイ/,
  /production.*deploy/i,
  /deploy.*production/i,
  /DEPLOY\s*\[/,
  /force.?push/i,
  /--force\b/,
  /rm\s+-rf/,
  /git\s+push.*-f\b/,
  /データ.*削除/,
  /全件.*削除/,
  /SAFETY\s*STOP/,
  /承認.*必要/,
];

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'auto-responder.log');

function ensureLogDir() {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
}

function isSafetyStop(text) {
  return SAFETY_STOP_PATTERNS.some(p => p.test(text));
}

function matchesAutoYes(text) {
  return AUTO_YES_PATTERNS.find(p => p.test(text));
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node kosame-auto-responder.js <command> [args...]');
  process.exit(1);
}

ensureLogDir();
log(`[AUTO-RESPONDER] START cmd="${args.join(' ')}"`);

const child = spawn(args[0], args.slice(1), {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
  shell: false,
});

let buffer = '';

function processChunk(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  buffer += text;

  // 改行またはプロンプト末尾で行を処理
  const lines = buffer.split(/\n/);
  buffer = lines.pop(); // 未完結行は保持

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isSafetyStop(trimmed)) {
      log(`[SAFETY STOP] 手動確認が必要です: "${trimmed.slice(0, 120)}"`);
      // stdin をターミナルに接続し直す（インタラクティブ入力を許可）
      process.stdin.pipe(child.stdin);
      continue;
    }

    const matched = matchesAutoYes(trimmed);
    if (matched) {
      log(`[AUTO-YES] パターン一致: "${trimmed.slice(0, 120)}" → "y" 送信`);
      child.stdin.write('y\n');
    }
  }
}

child.stdout.on('data', processChunk);
child.stderr.on('data', (data) => {
  process.stderr.write(data);
  // stderr にも Safety Stop チェック
  const text = data.toString();
  if (isSafetyStop(text)) {
    log(`[SAFETY STOP] stderr: "${text.trim().slice(0, 120)}"`);
    process.stdin.pipe(child.stdin);
  }
});

child.on('close', (code) => {
  // 残バッファ処理
  if (buffer.trim()) processChunk('\n');
  log(`[AUTO-RESPONDER] END code=${code}`);
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  log(`[AUTO-RESPONDER] ERROR ${err.message}`);
  process.exit(1);
});

// Ctrl+C を子プロセスに転送
process.on('SIGINT', () => {
  child.kill('SIGINT');
});
