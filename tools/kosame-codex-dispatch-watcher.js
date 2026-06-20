#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HANDOFF_DIR = path.join(ROOT, '.kosame-handoff');
const QUEUE_FILENAME = 'queue.jsonl';
const LATEST_FILENAME = 'latest.md';
const DEFAULT_PORT = Number(process.env.PORT || 8080);
const DEFAULT_HOST = process.env.KOSAME_CONSOLE_HOST || '127.0.0.1';
const POLL_INTERVAL_MS = 2000;
const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000;

// Safety Stop conditions: dispatch is BLOCKED if any of these are detected in the prompt.
// Patterns are intentionally specific to avoid matching safety-condition documentation text.
const DISPATCH_SAFETY_STOP_PATTERNS = [
  /git\s+push\s+.*--force|git\s+push\s+-f\b|--force\s+origin/i,
  /git\s+tag\s+-f\b/i,
  /rm\s+-rf\s+\//i,
  /DROP\s+TABLE|DROP\s+DATABASE/i,
  /npm\s+.*publish\s+--tag\s+latest/i,
];

// Required safety conditions that must appear in every dispatched prompt.
const REQUIRED_SAFETY_KEYWORDS = [
  '機密情報・環境変数ファイル・認証情報・APIキーは読まない',
  '外部APIを呼ばない',
  '対象repo以外を触らない',
];

function readQueueCount(handoffDir) {
  const p = path.join(handoffDir, QUEUE_FILENAME);
  if (!fs.existsSync(p)) return 0;
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).length;
}

function readLatestEntry(handoffDir) {
  const p = path.join(handoffDir, QUEUE_FILENAME);
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return null;
  try { return JSON.parse(lines[lines.length - 1]); } catch { return null; }
}

function readLatestMd(handoffDir) {
  const p = path.join(handoffDir, LATEST_FILENAME);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

function safetyPreFlight(prompt) {
  for (const pattern of DISPATCH_SAFETY_STOP_PATTERNS) {
    if (pattern.test(prompt)) {
      return { ok: false, reason: `Safety Stop: prompt matched forbidden pattern ${pattern}` };
    }
  }
  for (const keyword of REQUIRED_SAFETY_KEYWORDS) {
    if (!prompt.includes(keyword)) {
      return { ok: false, reason: `Safety Stop: required condition missing — "${keyword}"` };
    }
  }
  return { ok: true };
}

function extractResultBlock(output) {
  const match = /KOSAME_RESULT_BEGIN\s*([\s\S]*?)\s*KOSAME_RESULT_END/.exec(output);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function postResult(data, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || DEFAULT_PORT);
  const payload = JSON.stringify({ ...data, source: data.source || 'codex-auto' });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: '/api/work-orders/result',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ statusCode: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function runClaude(prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', '--dangerously-skip-permissions'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Claude runner timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

async function dispatchWorkOrder(entry, handoffDir, options) {
  const prompt = readLatestMd(handoffDir) || entry.prompt || entry.body || '';
  if (!prompt.trim()) {
    process.stderr.write('[watcher] No prompt in latest.md\n');
    return;
  }

  const safety = safetyPreFlight(prompt);
  if (!safety.ok) {
    process.stderr.write(`[watcher] ⛔ SAFETY STOP — ${safety.reason}\n`);
    process.stderr.write('[watcher] Dispatch blocked. Human review required.\n');
    return;
  }

  process.stdout.write(`[watcher] Claude dispatch: ${entry.title || entry.id || '?'}\n`);

  let claudeResult;
  try {
    claudeResult = await runClaude(prompt, options.timeoutMs || CLAUDE_TIMEOUT_MS);
  } catch (error) {
    process.stderr.write(`[watcher] Claude runner error: ${error.message}\n`);
    await postResult({
      result_status: 'error',
      result_summary: `Claude runner failed: ${error.message}`,
      smoke_result: 'unknown',
      verify_result: 'unknown',
    }, options).catch(() => {});
    return;
  }

  const extracted = extractResultBlock(claudeResult.stdout);
  const resultData = extracted || {
    result_status: claudeResult.code === 0 ? 'success' : 'error',
    smoke_result: 'unknown',
    verify_result: 'unknown',
    result_summary: `Claude runner完了 (exit ${claudeResult.code})`,
  };

  if (!extracted) {
    process.stdout.write('[watcher] No KOSAME_RESULT block in output, using defaults\n');
  }

  try {
    const posted = await postResult(resultData, options);
    if (posted.statusCode === 200 && posted.body && posted.body.ok) {
      process.stdout.write('[watcher] ✅ Result posted to Console\n');
    } else {
      process.stderr.write(`[watcher] ❌ Post failed: ${posted.statusCode}\n`);
    }
  } catch (error) {
    process.stderr.write(`[watcher] ❌ Post error: ${error.message}\n`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const handoffDir = path.resolve(args.dir || DEFAULT_HANDOFF_DIR);
  const port = Number(args.port || DEFAULT_PORT);
  const host = args.host || DEFAULT_HOST;

  process.stdout.write(`[watcher] Watching ${handoffDir}\n`);
  process.stdout.write(`[watcher] Posting results → http://${host}:${port}\n`);
  process.stdout.write('[watcher] Codex Runner起動 — Approve→Handoffで自動ディスパッチ / Claudeはreview/audit専用\n');

  let lastCount = readQueueCount(handoffDir);
  let dispatching = false;

  const timer = setInterval(async () => {
    if (dispatching) return;
    const count = readQueueCount(handoffDir);
    if (count > lastCount) {
      const entry = readLatestEntry(handoffDir) || {};
      lastCount = count;
      dispatching = true;
      try {
        await dispatchWorkOrder(entry, handoffDir, { host, port });
      } finally {
        dispatching = false;
      }
    }
  }, POLL_INTERVAL_MS);

  process.on('SIGINT', () => { clearInterval(timer); process.stdout.write('[watcher] Stopped\n'); process.exit(0); });
  process.on('SIGTERM', () => { clearInterval(timer); process.exit(0); });
}

module.exports = {
  extractResultBlock,
  readQueueCount,
  readLatestEntry,
  dispatchWorkOrder,
  safetyPreFlight,
  DISPATCH_SAFETY_STOP_PATTERNS,
  REQUIRED_SAFETY_KEYWORDS,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  });
}
