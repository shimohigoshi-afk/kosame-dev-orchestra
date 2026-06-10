#!/usr/bin/env node
'use strict';

/**
 * KOSAME Dev Run API v110.44.0
 *
 * PowerShell / Cloud Run 向け HTTP エンドポイント
 *
 *   POST /api/dev/run   設計書テキスト → kosame-auto-dev → SSE 実況
 *   GET  /api/dev/status               実行状態確認
 *   GET  /health                       ヘルスチェック
 *
 * Auth:
 *   Authorization: Bearer <KOSAME_API_KEY>
 *   または X-API-Key: <KOSAME_API_KEY>
 *   KOSAME_API_KEY 未設定の場合は認証スキップ（開発・dryRun 環境）
 *
 * SSE イベント種別:
 *   event: started   { runId, ts, dryRun, specPreview }
 *   event: activity  { ...kosame-activity-events イベント }
 *   event: done      { runId, elapsedMs, taskCount, passCount, failedCount, reviewScore, approved }
 *   event: error     { runId, error, code, elapsedMs }
 *   ': keepalive'    (10 秒間隔ハートビート)
 *
 * PowerShell 使用例:
 *   $body = @{ spec = "設計書テキスト"; project = "anesty-board" } | ConvertTo-Json
 *   Invoke-WebRequest -Method POST -Uri http://localhost:8081/api/dev/run `
 *     -Headers @{ Authorization = "Bearer $env:KOSAME_API_KEY"; "Content-Type" = "application/json" } `
 *     -Body $body
 *
 * Usage:
 *   npm run dev:run-api              # port 8081, dryRun=true
 *   npm run dev:run-api -- --port=9000 --live
 */

const http   = require('node:http');
const path   = require('node:path');
const fs     = require('node:fs');
const os     = require('node:os');
const { spawn } = require('node:child_process');

const TOOL_META = {
  version:       '110.44.0',
  feature:       'v110-44-dev-run-api',
  slug:          'kosame-dev-run-api',
  dryRunDefault: true,
};

const ROOT     = path.resolve(__dirname, '..');
const LOG_FILE = path.join(os.homedir(), '.kosame', 'activity-events.jsonl');

// ── Auth ──────────────────────────────────────────────────────────────────────

function checkAuth(req) {
  const apiKey = process.env.KOSAME_API_KEY;
  if (!apiKey) return true;                            // 開発環境: キー未設定はオープン
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7) === apiKey;
  return (req.headers['x-api-key'] || '') === apiKey;
}

// ── JSONL tail ────────────────────────────────────────────────────────────────

function currentLogSize() {
  try { return fs.statSync(LOG_FILE).size; } catch (_) { return 0; }
}

function startTail(fromByte, onEvent) {
  let pos     = fromByte;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    try {
      if (!fs.existsSync(LOG_FILE)) return;
      const size = fs.statSync(LOG_FILE).size;
      if (size <= pos) return;
      const len = size - pos;
      const buf = Buffer.alloc(len);
      const fd  = fs.openSync(LOG_FILE, 'r');
      fs.readSync(fd, buf, 0, len, pos);
      fs.closeSync(fd);
      pos = size;
      for (const line of buf.toString('utf-8').split('\n')) {
        if (!line.trim()) continue;
        try { onEvent(JSON.parse(line)); } catch (_) {}
      }
    } catch (_) {}
  };

  const timer = setInterval(tick, 300);
  timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
    tick(); // 最終ドレイン
  };
}

// ── Concurrent run guard ──────────────────────────────────────────────────────

let _run = null; // { runId, child, startMs }

// ── Discord 通知 (fire and forget) ────────────────────────────────────────────

function notifyDiscordAsync(event, payload, dryRun) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    const { notify } = require('./real-time-progress-notifier');
    notify(event, payload, { discord: { url } }, { dryRun, silent: true }).catch(() => {});
  } catch (_) {}
}

// ── POST /api/dev/run ─────────────────────────────────────────────────────────

function handleDevRun(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 200_000) { req.destroy(); return; }
  });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'invalid JSON body' }));
    }

    const spec    = String(parsed.spec || '').trim();
    const project = parsed.project ? String(parsed.project).slice(0, 64) : null;
    const dryRun  = parsed.dryRun !== false; // デフォルト true

    if (!spec) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'spec is required' }));
    }

    if (_run) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: false, error: 'run already in progress',
        runId: _run.runId, elapsedMs: Date.now() - _run.startMs,
      }));
    }

    // SSE レスポンスに切り替え
    const runId   = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startMs = Date.now();

    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Run-Id': runId,
    });

    const sse = (event, data) => {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
    };

    sse('started', {
      runId,
      ts:          new Date().toISOString(),
      dryRun,
      specPreview: spec.slice(0, 80),
    });

    const keepalive = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch (_) { clearInterval(keepalive); }
    }, 10_000);
    keepalive.unref();

    // 設計書を一時ファイルに書き出し（シェル引数の注入を防ぐ）
    const tmpFile = path.join(os.tmpdir(), `kosame-spec-${runId}.txt`);
    try {
      fs.writeFileSync(tmpFile, spec, { encoding: 'utf-8', mode: 0o600 });
    } catch (e) {
      clearInterval(keepalive);
      sse('error', { runId, error: `tmp write failed: ${e.message}` });
      return res.end();
    }

    // 開始前の JSONL ファイルサイズを記録（今回の run 分だけ tail する）
    const fromByte = currentLogSize();

    // kosame-auto-dev.js をサブプロセスとして起動
    const args = ['tools/kosame-auto-dev.js', `--file=${tmpFile}`, '--json'];
    if (project) args.push(`--project=${project}`);
    if (!dryRun) args.push('--write');

    const child = spawn('node', args, {
      cwd:   ROOT,
      env:   { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    _run = { runId, child, startMs };

    let stdoutBuf = '';
    let stderrBuf = '';
    child.stdout.on('data', d => { stdoutBuf += d.toString(); });
    child.stderr.on('data', d => { stderrBuf += d.toString().slice(0, 2000); });

    // JSONL tail → SSE に転送
    const stopTail = startTail(fromByte, evt => sse('activity', evt));

    const cleanup = (code, errMsg) => {
      clearInterval(keepalive);
      stopTail();
      _run = null;
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      const elapsed = Date.now() - startMs;

      if (errMsg !== undefined) {
        sse('error', { runId, error: errMsg, code: code ?? null, elapsedMs: elapsed });
        notifyDiscordAsync('error', {
          message: `auto-dev 失敗: exit ${code}`,
          detail:  errMsg.slice(0, 100),
        }, dryRun);
      } else {
        let result = null;
        if (stdoutBuf.trim()) try { result = JSON.parse(stdoutBuf.trim()); } catch (_) {}

        if (result) {
          const done = {
            runId,
            elapsedMs:   elapsed,
            dryRun,
            taskCount:   result.taskCount   ?? 0,
            passCount:   result.passCount   ?? 0,
            fixedCount:  result.fixedCount  ?? 0,
            failedCount: result.failedCount ?? 0,
            reviewScore: result.review?.avgScore ?? null,
            approved:    result.review?.approved ?? false,
          };
          sse('done', done);
          notifyDiscordAsync('done', {
            message: `auto-dev 完了: ${done.taskCount}タスク PASS:${done.passCount} FAIL:${done.failedCount}`,
            detail:  `dryRun=${dryRun} score=${done.reviewScore?.toFixed?.(1) ?? '-'}/100`,
          }, dryRun);
        } else {
          const msg = (stderrBuf || `exit ${code}`).slice(0, 300);
          sse('error', { runId, error: msg, code, elapsedMs: elapsed });
          notifyDiscordAsync('error', { message: `auto-dev 失敗 (no result)`, detail: msg.slice(0, 100) }, dryRun);
        }
      }

      try { res.end(); } catch (_) {}
    };

    child.on('exit',  code  => cleanup(code, code !== 0 ? (stderrBuf || `exit ${code}`).slice(0, 300) : undefined));
    child.on('error', err   => cleanup(null, err.message));

    req.on('close', () => {
      clearInterval(keepalive);
      // サブプロセスは継続 — Discord 通知は完了時に送信される
    });
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function startServer(port, opts = {}) {
  const { dryRun = true } = opts;

  const server = http.createServer((req, res) => {
    // CORS プリフライト
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      });
      return res.end();
    }

    // /health は認証不要
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ ok: true, version: TOOL_META.version, dryRun }));
    }

    // 認証チェック
    if (!checkAuth(req)) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="KOSAME Dev Run API"',
      });
      return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
    }

    const url = req.url.split('?')[0];

    if (url === '/api/dev/run' && req.method === 'POST') {
      return handleDevRun(req, res);
    }

    if (url === '/api/dev/status') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        ok:        true,
        running:   !!_run,
        runId:     _run?.runId    ?? null,
        elapsedMs: _run ? Date.now() - _run.startMs : null,
        dryRun,
        version:   TOOL_META.version,
      }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
  });

  server.listen(port, () => {
    const authStatus = process.env.KOSAME_API_KEY ? 'KOSAME_API_KEY ✓' : 'open (KOSAME_API_KEY 未設定)';
    const discStatus = process.env.DISCORD_WEBHOOK_URL ? 'configured' : 'not set';
    console.log(`\n  ⬡  KOSAME Dev Run API v${TOOL_META.version}  →  http://localhost:${port}`);
    console.log(`     POST /api/dev/run    (SSE 実況)`);
    console.log(`     GET  /api/dev/status`);
    console.log(`     GET  /health`);
    console.log(`     auth: ${authStatus}  |  dryRun: ${dryRun}  |  Discord: ${discStatus}`);
    console.log('');
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`  ERROR: port ${port} already in use.`);
      process.exit(1);
    }
    throw err;
  });

  return server;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let port   = 8081;
  let dryRun = true;
  for (const a of args) {
    if (a.startsWith('--port=')) port   = parseInt(a.slice(7), 10);
    if (a === '--live')          dryRun = false;
    if (a === '--write')         dryRun = false;
  }
  return { port, dryRun };
}

if (require.main === module) {
  const { port, dryRun } = parseArgs(process.argv);
  startServer(port, { dryRun });
}

module.exports = {
  TOOL_META,
  startServer,
  parseArgs,
  checkAuth,
  currentLogSize,
  startTail,
};
