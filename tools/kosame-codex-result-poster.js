#!/usr/bin/env node
'use strict';

const http = require('node:http');

const DEFAULT_PORT = Number(process.env.PORT || 8080);
const DEFAULT_HOST = process.env.KOSAME_CONSOLE_HOST || '127.0.0.1';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const raw = argv[i].slice(2);
      const key = raw.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return args;
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
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ statusCode: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function readStdin() {
  if (process.stdin.isTTY) return null;
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const port = Number(args.port || DEFAULT_PORT);
  const host = args.host || DEFAULT_HOST;

  const stdinData = await readStdin();
  const data = Object.assign({}, stdinData || {});

  if (args.status || args.resultStatus) data.result_status = args.status || args.resultStatus;
  if (args.smokeResult) data.smoke_result = args.smokeResult;
  if (args.verifyResult) data.verify_result = args.verifyResult;
  if (args.summary) data.result_summary = args.summary;
  if (args.notes) data.notes = args.notes;

  if (!data.result_status) data.result_status = 'success';

  try {
    const res = await postResult(data, { host, port });
    if (res.statusCode === 200 && res.body && res.body.ok) {
      process.stdout.write(`✅ KOSAME Console に結果を送信しました (${host}:${port})\n`);
      const dec = res.body.latestWorkOrderDecision;
      if (dec) process.stdout.write(`判定: ${dec.decision_status || '—'}\n`);
    } else {
      process.stderr.write(`❌ 送信失敗: ${res.statusCode} ${JSON.stringify(res.body)}\n`);
      process.exit(1);
    }
  } catch (error) {
    process.stderr.write(`❌ 接続エラー: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { postResult, parseArgs };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  });
}
