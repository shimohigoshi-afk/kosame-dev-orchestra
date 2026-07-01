#!/usr/bin/env node
'use strict';

/**
 * KOSAME Sales DX API v113.9.0
 *
 * 営業DX P0 Lite 解析エンジンへの HTTP インターフェース
 *
 *   POST /api/sales-dx/analyze    面談メモ → 議事録下書き・温度感・追客文
 *   GET  /api/sales-dx/status     稼働状態確認
 *   GET  /health                  ヘルスチェック
 *
 * Auth:
 *   Authorization: Bearer <KOSAME_API_KEY>
 *   または X-API-Key: <KOSAME_API_KEY>
 *   KOSAME_API_KEY 未設定の場合は認証スキップ（開発環境）
 *
 * POST /api/sales-dx/analyze リクエスト:
 *   { text: string, caseName?: string, dryRun?: boolean }
 *
 * レスポンス (成功):
 *   { ok, dryRun, saved, sent, charged, externalApiCalled,
 *     humanGateRequired, humanGateNote,
 *     caseName, transcript, temperature, alertWords, compliance, followupDraft }
 *
 * 制約:
 *   - 外部API接続なし（dryRun専用エンジン）
 *   - DB保存なし、実送信なし、実課金なし
 *   - 顧客情報・APIキー・機密情報は扱わない
 *
 * Usage:
 *   SALES_DX_PORT=8082 node tools/kosame-sales-dx-api.js
 *   node tools/kosame-sales-dx-api.js --port=8082
 */

const http = require('node:http');
const path = require('node:path');

const { analyzeText, TOOL_META: analyzeMeta } = require('./sales-dx-p0-lite-analyze-text');

const TOOL_META = {
  version:    '113.9.0',
  feature:    'v113-9-0-sales-dx-api',
  slug:       'kosame-sales-dx-api',
  dryRunOnly: true,
};

const DEFAULT_PORT = 8082;

// ── Auth ──────────────────────────────────────────────────────────────────────

function checkAuth(req) {
  const apiKey = process.env.KOSAME_API_KEY;
  if (!apiKey) return true;
  const authHeader = req.headers['authorization'] || '';
  const xApiKey    = req.headers['x-api-key']      || '';
  if (xApiKey === apiKey) return true;
  if (authHeader.startsWith('Bearer ') && authHeader.slice(7) === apiKey) return true;
  return false;
}

// ── CORS headers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type':   'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...CORS_HEADERS,
  });
  res.end(payload);
}

// ── POST /api/sales-dx/analyze ────────────────────────────────────────────────

function handleAnalyze(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 50_000) {
      req.destroy();
      sendJson(res, 413, { ok: false, error: 'request too large', code: 'REQUEST_TOO_LARGE' });
    }
  });
  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (_) {
      return sendJson(res, 400, { ok: false, error: 'invalid JSON body', code: 'INVALID_JSON' });
    }

    const text     = String(parsed.text     || '').trim();
    const caseName = String(parsed.caseName || '').trim();

    if (!text) {
      return sendJson(res, 400, {
        ok:                  false,
        error:               'text is required',
        code:                'EMPTY_INPUT',
        dryRun:              true,
        saved:               false,
        sent:                false,
        charged:             false,
        externalApiCalled:   false,
        humanGateRequired:   false,
        humanGateNote:       '入力が空です。面談メモを入力してください。',
      });
    }

    const result = analyzeText({ text, caseName });

    if (!result.ok) {
      return sendJson(res, 422, result);
    }

    return sendJson(res, 200, result);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function startServer(port, opts = {}) {
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      return res.end();
    }

    if (req.url === '/health' || req.url === '/api/health') {
      return sendJson(res, 200, {
        ok:            true,
        version:       TOOL_META.version,
        engineVersion: analyzeMeta.version,
        dryRunOnly:    TOOL_META.dryRunOnly,
        ts:            new Date().toISOString(),
      });
    }

    if (!checkAuth(req)) {
      res.writeHead(401, {
        'Content-Type':     'application/json',
        'WWW-Authenticate': 'Bearer realm="KOSAME Sales DX API"',
        ...CORS_HEADERS,
      });
      return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
    }

    const url = req.url.split('?')[0];

    if (url === '/api/sales-dx/analyze' && req.method === 'POST') {
      return handleAnalyze(req, res);
    }

    if (url === '/api/sales-dx/status' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok:            true,
        version:       TOOL_META.version,
        engineVersion: analyzeMeta.version,
        dryRunOnly:    TOOL_META.dryRunOnly,
        ts:            new Date().toISOString(),
      });
    }

    return sendJson(res, 404, { ok: false, error: 'not found' });
  });

  server.listen(port, () => {
    const authStatus = process.env.KOSAME_API_KEY ? 'KOSAME_API_KEY ✓' : 'open (KOSAME_API_KEY 未設定)';
    console.log(`\n  ⬡  KOSAME Sales DX API v${TOOL_META.version}  →  http://localhost:${port}`);
    console.log(`     POST /api/sales-dx/analyze    (面談メモ解析)`);
    console.log(`     GET  /api/sales-dx/status`);
    console.log(`     GET  /health`);
    console.log(`     auth: ${authStatus}  |  dryRunOnly: ${TOOL_META.dryRunOnly}`);
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
  let port = parseInt(process.env.SALES_DX_PORT || '', 10) || DEFAULT_PORT;
  for (const a of args) {
    if (a.startsWith('--port=')) port = parseInt(a.slice(7), 10);
  }
  return { port };
}

if (require.main === module) {
  const { port } = parseArgs(process.argv);
  startServer(port);
}

module.exports = {
  TOOL_META,
  startServer,
  parseArgs,
  checkAuth,
  handleAnalyze,
};
