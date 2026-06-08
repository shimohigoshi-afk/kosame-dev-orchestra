#!/usr/bin/env node
'use strict';

/**
 * KOSAME Google Drive Auto Writer v110.27.0
 *
 * 【スプシ】KOSAME Learning Log シートへ learning-log.jsonl から行を書き込む
 * 【ドキュメント】KOSAME 設計書（自動生成）へバージョン/実装内容/commit/日時を追記
 *
 * 認証: サービスアカウント credentials.json（~/.kosame/credentials.json）
 * dryRun デフォルト — 実際の API 呼び出しは --write フラグが必要
 *
 * Usage:
 *   node tools/kosame-gdrive-writer.js --sheets              # Sheets dry-run
 *   node tools/kosame-gdrive-writer.js --sheets --write      # Sheets 実書き込み
 *   node tools/kosame-gdrive-writer.js --docs                # Docs dry-run
 *   node tools/kosame-gdrive-writer.js --docs --write        # Docs 実追記
 *   node tools/kosame-gdrive-writer.js --sheets --docs       # 両方 dry-run
 *   node tools/kosame-gdrive-writer.js --sheets --docs --write
 *
 * 環境変数:
 *   KOSAME_SHEETS_ID   — スプレッドシート ID
 *   KOSAME_DOCS_ID     — ドキュメント ID
 *   KOSAME_CREDENTIALS — credentials.json パス（省略時 ~/.kosame/credentials.json）
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const TOOL_META = {
  version: '110.27.0',
  feature: 'v110-27-gdrive-writer',
  slug:    'kosame-gdrive-writer',
};

const KOSAME_DIR      = path.join(os.homedir(), '.kosame');
const LOG_FILE        = path.join(KOSAME_DIR, 'learning-log.jsonl');
const DEFAULT_CREDS   = path.join(KOSAME_DIR, 'credentials.json');

const SHEET_NAME      = 'KOSAME Learning Log';
const SHEET_HEADER    = ['ts', 'taskType', 'difficulty', 'model', 'provider', 'costUsd', 'durationMs', 'success', 'escalated', 'dryRun', 'taskInput'];
const DOC_NAME        = 'KOSAME 設計書（自動生成）';

// ── 認証 ─────────────────────────────────────────────────────────────────────

function loadCredentials(credsPath) {
  const p = credsPath || process.env.KOSAME_CREDENTIALS || DEFAULT_CREDS;
  if (!fs.existsSync(p)) {
    throw new Error(`credentials.json not found: ${p}  (set KOSAME_CREDENTIALS or place at ${DEFAULT_CREDS})`);
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  // サービスアカウント必須フィールドを確認（値は出力しない）
  const required = ['type', 'project_id', 'private_key', 'client_email'];
  const missing = required.filter(k => !raw[k]);
  if (missing.length > 0) throw new Error(`credentials.json missing fields: ${missing.join(', ')}`);
  if (raw.type !== 'service_account') throw new Error(`credentials.json type must be "service_account", got: "${raw.type}"`);
  return raw;
}

function buildAuthClient(creds) {
  const { google } = require('googleapis');
  return new google.auth.JWT({
    email: creds.client_email,
    key:   creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/documents',
    ],
  });
}

// ── Sheets ────────────────────────────────────────────────────────────────────

/**
 * learning-log.jsonl を読み込んで行配列に変換する。
 */
function readLogEntries(n = 0) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  return n > 0 ? entries.slice(-n) : entries;
}

function entryToRow(e) {
  return [
    e.ts         ?? '',
    e.taskType   ?? '',
    e.difficulty ?? '',
    e.model      ?? '',
    e.provider   ?? '',
    e.costUsd    != null ? e.costUsd    : '',
    e.durationMs != null ? e.durationMs : '',
    e.success    != null ? String(e.success) : '',
    e.escalated  != null ? String(e.escalated) : '',
    e.dryRun     != null ? String(e.dryRun)    : '',
    e.taskInput  ?? '',
  ];
}

/**
 * スプレッドシートへ learning-log の最新 n 件（0=全件）を追記する。
 * dryRun=true では API を呼ばず、送信予定行を返す。
 */
async function writeSheetsRows(opts = {}) {
  const {
    dryRun     = true,
    credsPath  = null,
    sheetsId   = process.env.KOSAME_SHEETS_ID || null,
    tail       = 0,
  } = opts;

  const entries = readLogEntries(tail);
  const rows    = entries.map(entryToRow);

  const plan = {
    tool:        TOOL_META.slug,
    version:     TOOL_META.version,
    op:          'sheets:append',
    sheetName:   SHEET_NAME,
    sheetsId:    sheetsId ?? '(KOSAME_SHEETS_ID not set)',
    header:      SHEET_HEADER,
    rowCount:    rows.length,
    rows:        rows.slice(0, 3),   // preview first 3 only
    dryRun,
    realProductActionsExecuted: false,
  };

  if (dryRun) {
    return { ...plan, ok: true };
  }

  if (!sheetsId) throw new Error('KOSAME_SHEETS_ID env var is required for --write');

  const creds  = loadCredentials(credsPath);
  const auth   = buildAuthClient(creds);
  const { google } = require('googleapis');
  const sheets = google.sheets({ version: 'v4', auth });

  // ヘッダー行が A1 に存在するか確認し、なければ書き込む
  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range:         `${SHEET_NAME}!A1:A1`,
  });
  const hasHeader = (meta.data.values ?? []).length > 0;

  const values = hasHeader ? rows : [SHEET_HEADER, ...rows];
  const range  = `${SHEET_NAME}!A1`;

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId:     sheetsId,
    range,
    valueInputOption:  'RAW',
    insertDataOption:  'INSERT_ROWS',
    requestBody:       { values },
  });

  return {
    ...plan,
    ok:                        true,
    realProductActionsExecuted: true,
    updatedRange:              res.data.updates?.updatedRange ?? null,
    updatedRows:               res.data.updates?.updatedRows  ?? null,
  };
}

// ── Docs ──────────────────────────────────────────────────────────────────────

/**
 * git log から最新 commit hash と message を取得する。
 * 失敗時は null を返す（git なし環境でも動く）。
 */
function getLatestCommit() {
  try {
    const { execFileSync } = require('node:child_process');
    const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', timeout: 5000 }).trim();
    const msg  = execFileSync('git', ['log', '-1', '--pretty=%s'],       { encoding: 'utf8', timeout: 5000 }).trim();
    return { hash, msg };
  } catch {
    return null;
  }
}

/**
 * ドキュメントに追記するテキストブロックを構築する。
 */
function buildDocsEntry(opts = {}) {
  const {
    version = TOOL_META.version,
    content = '',
    commit  = null,
  } = opts;

  const git   = commit ?? getLatestCommit();
  const ts    = new Date().toISOString();
  const lines = [
    `\n---`,
    `バージョン : ${version}`,
    `日時       : ${ts}`,
    `commit     : ${git ? `${git.hash}  ${git.msg}` : '(git not available)'}`,
    `実装内容   : ${content || '(no description)'}`,
    `---\n`,
  ];
  return lines.join('\n');
}

/**
 * Google Docs ドキュメントの末尾にエントリを追記する。
 * dryRun=true では API を呼ばず、送信予定テキストを返す。
 */
async function writeDocsEntry(opts = {}) {
  const {
    dryRun    = true,
    credsPath = null,
    docsId    = process.env.KOSAME_DOCS_ID || null,
    version   = TOOL_META.version,
    content   = '',
    commit    = null,
  } = opts;

  const text = buildDocsEntry({ version, content, commit });

  const plan = {
    tool:        TOOL_META.slug,
    version:     TOOL_META.version,
    op:          'docs:append',
    docName:     DOC_NAME,
    docsId:      docsId ?? '(KOSAME_DOCS_ID not set)',
    textPreview: text.slice(0, 200),
    dryRun,
    realProductActionsExecuted: false,
  };

  if (dryRun) {
    return { ...plan, ok: true };
  }

  if (!docsId) throw new Error('KOSAME_DOCS_ID env var is required for --write');

  const creds  = loadCredentials(credsPath);
  const auth   = buildAuthClient(creds);
  const { google } = require('googleapis');
  const docs   = google.docs({ version: 'v1', auth });

  // ドキュメントの末尾インデックスを取得してから insertText
  const docMeta = await docs.documents.get({ documentId: docsId });
  const endIndex = docMeta.data.body.content.at(-1)?.endIndex ?? 1;

  await docs.documents.batchUpdate({
    documentId: docsId,
    requestBody: {
      requests: [{
        insertText: {
          location: { index: endIndex - 1 },
          text,
        },
      }],
    },
  });

  return {
    ...plan,
    ok:                        true,
    realProductActionsExecuted: true,
    insertedChars:             text.length,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args    = argv.slice(2);
  const has     = f => args.includes(f);
  const get     = prefix => args.find(a => a.startsWith(prefix))?.slice(prefix.length) ?? null;
  return {
    sheets:    has('--sheets'),
    docs:      has('--docs'),
    dryRun:    !has('--write'),
    tail:      parseInt(get('--tail=') ?? '0', 10) || 0,
    version:   get('--version=') ?? TOOL_META.version,
    content:   get('--content=') ?? '',
    credsPath: get('--creds=') ?? null,
  };
}

async function main() {
  const { sheets, docs, dryRun, tail, version, content, credsPath } = parseArgs(process.argv);

  if (!sheets && !docs) {
    console.log(`kosame-gdrive-writer v${TOOL_META.version}`);
    console.log('  --sheets          Learning Log スプシ書き込み');
    console.log('  --docs            設計書ドキュメント追記');
    console.log('  --write           dryRun 解除（実書き込み）');
    console.log('  --tail=N          直近 N 件のみ送信（0=全件）');
    console.log('  --version=X       ドキュメント用バージョン文字列');
    console.log('  --content="..."   ドキュメント用実装内容');
    console.log('  --creds=/path     credentials.json パス');
    console.log(`\n  KOSAME_SHEETS_ID: ${process.env.KOSAME_SHEETS_ID ? '(set)' : '(not set)'}`);
    console.log(`  KOSAME_DOCS_ID  : ${process.env.KOSAME_DOCS_ID   ? '(set)' : '(not set)'}`);
    return;
  }

  console.log(`\n===== KOSAME Google Drive Writer v${TOOL_META.version} =====`);
  console.log(`DRY RUN : ${dryRun}`);

  if (sheets) {
    console.log('\n[Sheets] KOSAME Learning Log');
    const r = await writeSheetsRows({ dryRun, credsPath, tail });
    console.log(`  rows ready : ${r.rowCount}`);
    if (r.rows.length > 0) {
      console.log(`  preview    : ${JSON.stringify(r.rows[0])}`);
    }
    if (!dryRun) {
      console.log(`  updatedRange: ${r.updatedRange}`);
      console.log(`  updatedRows : ${r.updatedRows}`);
    }
    console.log(`  ok: ${r.ok} | dryRun: ${r.dryRun}`);
  }

  if (docs) {
    console.log('\n[Docs] KOSAME 設計書（自動生成）');
    const r = await writeDocsEntry({ dryRun, credsPath, version, content });
    console.log(`  textPreview: ${r.textPreview.replace(/\n/g, ' ').slice(0, 80)}`);
    if (!dryRun) console.log(`  insertedChars: ${r.insertedChars}`);
    console.log(`  ok: ${r.ok} | dryRun: ${r.dryRun}`);
  }

  console.log('\n===== done =====');
}

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  SHEET_NAME,
  SHEET_HEADER,
  DOC_NAME,
  LOG_FILE,
  readLogEntries,
  entryToRow,
  buildDocsEntry,
  writeSheetsRows,
  writeDocsEntry,
};
