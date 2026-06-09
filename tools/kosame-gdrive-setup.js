#!/usr/bin/env node
'use strict';

/**
 * KOSAME Google Drive Setup v110.39.0
 *
 * Cloud Shell 再起動後に自動で認証を復元する仕組みを提供する。
 *
 * 役割:
 *   1. ~/.kosame/.env を読んで KOSAME_SHEETS_ID / KOSAME_DOCS_ID を process.env に設定
 *   2. ~/.kosame/credentials.json の存在・形式を検証
 *   3. npm run gdrive:setup で初回セットアップガイドを表示
 *   4. npm run gdrive:check で現在の設定状態を確認
 *   5. npm run gdrive:test --write で実際の Drive 接続をテスト
 *
 * 設定ファイル:
 *   ~/.kosame/.env             — KOSAME_SHEETS_ID / KOSAME_DOCS_ID
 *   ~/.kosame/credentials.json — GCP サービスアカウントキー
 *
 * Usage:
 *   node tools/kosame-gdrive-setup.js           # ガイド or 設定確認を自動表示
 *   node tools/kosame-gdrive-setup.js --check   # 設定状態を確認
 *   node tools/kosame-gdrive-setup.js --guide   # セットアップガイドを表示
 *   node tools/kosame-gdrive-setup.js --test --write   # 実接続テスト
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const TOOL_META = {
  version:       '110.39.0',
  feature:       'v110-39-gdrive-setup',
  slug:          'kosame-gdrive-setup',
  dryRunDefault: true,
};

const KOSAME_DIR   = path.join(os.homedir(), '.kosame');
const ENV_FILE     = path.join(KOSAME_DIR, '.env');
const CREDS_FILE   = path.join(KOSAME_DIR, 'credentials.json');

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m', bold:    '\x1b[1m', dim:    '\x1b[2m',
  green:   '\x1b[32m', yellow: '\x1b[33m', blue:   '\x1b[34m',
  cyan:    '\x1b[36m', red:    '\x1b[31m', gray:   '\x1b[90m',
  magenta: '\x1b[35m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

function hr(len = 60) { return '─'.repeat(len); }

// ── Env loader ────────────────────────────────────────────────────────────────

/**
 * ~/.kosame/.env を読み込んで process.env に注入する。
 *
 * - KEY=VALUE 形式のみ対応（# コメント・空行はスキップ）
 * - process.env に既にセットされているキーは上書きしない
 * - Cloud Shell 再起動後にセッション変数が消えても自動復元される
 *
 * @returns {{ loaded: string[], skipped: string[], missing: boolean }}
 */
function loadKosameEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    return { loaded: [], skipped: [], missing: true, envFile: ENV_FILE };
  }

  const lines   = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  const loaded  = [];
  const skipped = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

    if (!key || !val) continue;

    if (process.env[key] !== undefined) {
      skipped.push(key);
    } else {
      process.env[key] = val;
      loaded.push(key);
    }
  }

  return { loaded, skipped, missing: false, envFile: ENV_FILE };
}

// ── Credentials validator ─────────────────────────────────────────────────────

/**
 * credentials.json の存在・必須フィールドを検証する。
 * 実際のキー値は一切出力しない。
 *
 * @returns {{ ok: boolean, path: string, email?: string, projectId?: string, error?: string }}
 */
function validateCredentials() {
  const p = process.env.KOSAME_CREDENTIALS || CREDS_FILE;

  if (!fs.existsSync(p)) {
    return {
      ok:    false,
      path:  p,
      error: `credentials.json が見つかりません: ${p}`,
      hint:  `GCP コンソールでサービスアカウントキーをダウンロードして ${CREDS_FILE} に配置してください。\n  詳細: npm run gdrive:setup`,
    };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return { ok: false, path: p, error: `credentials.json のパースに失敗しました: ${e.message}` };
  }

  const required = ['type', 'project_id', 'private_key', 'client_email'];
  const missing  = required.filter(k => !raw[k]);
  if (missing.length > 0) {
    return { ok: false, path: p, error: `credentials.json に必須フィールドがありません: ${missing.join(', ')}` };
  }

  if (raw.type !== 'service_account') {
    return { ok: false, path: p, error: `credentials.json の type が "service_account" ではありません: "${raw.type}"` };
  }

  return {
    ok:        true,
    path:      p,
    email:     raw.client_email,
    projectId: raw.project_id,
  };
}

// ── Validate all ──────────────────────────────────────────────────────────────

/**
 * 認証に必要な全コンポーネントの状態を返す。
 */
function validateSetup() {
  const envResult   = loadKosameEnv();
  const credsResult = validateCredentials();

  const sheetsId = process.env.KOSAME_SHEETS_ID || null;
  const docsId   = process.env.KOSAME_DOCS_ID   || null;

  const allOk =
    credsResult.ok &&
    !!sheetsId &&
    !!docsId;

  return {
    ok:        allOk,
    env:       envResult,
    creds:     credsResult,
    sheetsId:  sheetsId ? '(set)' : null,
    docsId:    docsId   ? '(set)' : null,
    readyForWrite: allOk,
  };
}

// ── Live connection test ───────────────────────────────────────────────────────

/**
 * Google Sheets / Docs に実際に接続できるか確認する。
 * dryRun=true では API を呼ばず設定値の確認のみ行う。
 */
async function testConnection(opts = {}) {
  const { dryRun = true } = opts;

  const setup = validateSetup();
  if (!setup.ok) {
    return {
      tool:    TOOL_META.slug,
      version: TOOL_META.version,
      ok:      false,
      dryRun,
      error:   '設定が不完全です。npm run gdrive:setup で確認してください。',
      setup,
    };
  }

  if (dryRun) {
    return {
      tool:    TOOL_META.slug,
      version: TOOL_META.version,
      ok:      true,
      dryRun:  true,
      message: '[DRY-RUN] 設定は正常です。実際の接続テストは --write フラグを追加してください。',
      setup,
      realProductActionsExecuted: false,
    };
  }

  // Live: Sheets への読み取り接続テスト
  const sheetsId = process.env.KOSAME_SHEETS_ID;
  const docsId   = process.env.KOSAME_DOCS_ID;
  const results  = {};

  try {
    const raw    = JSON.parse(fs.readFileSync(setup.creds.path, 'utf8'));
    const { google } = require('googleapis');
    const auth   = new google.auth.JWT({
      email:  raw.client_email,
      key:    raw.private_key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/documents',
      ],
    });

    // Sheets テスト: スプレッドシートのメタ情報を取得
    if (sheetsId) {
      try {
        const sheets = google.sheets({ version: 'v4', auth });
        const meta   = await sheets.spreadsheets.get({ spreadsheetId: sheetsId, fields: 'spreadsheetId,properties.title' });
        results.sheets = { ok: true, title: meta.data.properties?.title ?? '(unknown)' };
      } catch (e) {
        results.sheets = { ok: false, error: e.message.slice(0, 120) };
      }
    }

    // Docs テスト: ドキュメントのメタ情報を取得
    if (docsId) {
      try {
        const docs = google.docs({ version: 'v1', auth });
        const meta = await docs.documents.get({ documentId: docsId, fields: 'documentId,title' });
        results.docs = { ok: true, title: meta.data.title ?? '(unknown)' };
      } catch (e) {
        results.docs = { ok: false, error: e.message.slice(0, 120) };
      }
    }
  } catch (e) {
    return {
      tool: TOOL_META.slug, version: TOOL_META.version,
      ok: false, dryRun: false,
      error: `認証クライアントの構築に失敗しました: ${e.message}`,
      realProductActionsExecuted: true,
    };
  }

  const allConnectionsOk = Object.values(results).every(r => r.ok !== false);

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    ok:      allConnectionsOk,
    dryRun:  false,
    results,
    realProductActionsExecuted: true,
  };
}

// ── Setup guide display ───────────────────────────────────────────────────────

function printSetupGuide() {
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Google Drive セットアップガイド'))}  v${TOOL_META.version}`);
  console.log('  ' + hr());

  console.log(`\n  ${c('bold', 'ステップ 1')}  GCP サービスアカウントキーを作成する\n`);
  console.log(`    1. GCP コンソール (console.cloud.google.com) を開く`);
  console.log(`    2. [IAM と管理] → [サービスアカウント] → [アカウントを作成]`);
  console.log(`    3. 名前: ${c('cyan', 'kosame-gdrive-writer')}（任意）`);
  console.log(`    4. [鍵を追加] → [新しい鍵を作成] → JSON → ダウンロード`);

  console.log(`\n  ${c('bold', 'ステップ 2')}  credentials.json を配置する\n`);
  console.log(`    ダウンロードした JSON ファイルを以下にコピーする:`);
  console.log(`    ${c('cyan', CREDS_FILE)}\n`);
  console.log(`    ${c('dim', 'Cloud Shell での例:')}`);
  console.log(`    ${c('gray', '$ mkdir -p ~/.kosame && cp ~/Downloads/xxxx.json ~/.kosame/credentials.json')}`);
  console.log(`    ${c('gray', '$ chmod 600 ~/.kosame/credentials.json')}`);

  console.log(`\n  ${c('bold', 'ステップ 3')}  スプレッドシート / ドキュメントを共有する\n`);
  console.log(`    credentials.json の ${c('cyan', 'client_email')} 値を確認する:`);
  console.log(`    ${c('gray', '$ cat ~/.kosame/credentials.json | python3 -c "import sys,json; print(json.load(sys.stdin)[\'client_email\'])"')}`);
  console.log(`\n    その email を対象のスプレッドシート・ドキュメントの共有先に追加する（編集者権限）`);

  console.log(`\n  ${c('bold', 'ステップ 4')}  ~/.kosame/.env を作成する\n`);
  console.log(`    ${c('cyan', ENV_FILE)} に以下の内容を書き込む:`);
  console.log(`\n    ${c('dim', '# KOSAME Google Drive 設定')}`);
  console.log(`    ${c('cyan', 'KOSAME_SHEETS_ID')}${c('gray', '=スプレッドシートのID')}`);
  console.log(`    ${c('cyan', 'KOSAME_DOCS_ID')}${c('gray', '=ドキュメントのID')}`);
  console.log(`\n    ${c('dim', 'スプレッドシート URL 例:')}`);
  console.log(`    ${c('gray', 'https://docs.google.com/spreadsheets/d/[ここがSHEETS_ID]/edit')}`);
  console.log(`    ${c('dim', 'ドキュメント URL 例:')}`);
  console.log(`    ${c('gray', 'https://docs.google.com/document/d/[ここがDOCS_ID]/edit')}`);

  console.log(`\n  ${c('bold', 'ステップ 5')}  設定を確認する\n`);
  console.log(`    ${c('gray', '$ npm run gdrive:check')}`);
  console.log(`    ${c('gray', '$ npm run gdrive:test --write    # 実接続テスト')}`);

  console.log(`\n  ${c('dim', '設定後は Cloud Shell 再起動時も ~/.kosame/.env から自動的に復元されます。')}`);
  console.log('  ' + hr());
  console.log('');
}

// ── Status display ────────────────────────────────────────────────────────────

function printStatus(setup) {
  const ok  = (v) => c('green', '✓ OK ');
  const ng  = (v) => c('red',   '✗ NG ');
  const warn = (v) => c('yellow', '⚠ ');

  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Google Drive — 設定状態'))}  v${TOOL_META.version}`);
  console.log('  ' + hr());

  // credentials.json
  const cr = setup.creds;
  console.log(`\n  ${cr.ok ? ok() : ng()} credentials.json`);
  console.log(`       パス   : ${c('cyan', cr.path)}`);
  if (cr.ok) {
    console.log(`       email  : ${c('dim', cr.email)}`);
    console.log(`       project: ${c('dim', cr.projectId)}`);
  } else {
    console.log(`       ${c('red', cr.error)}`);
    if (cr.hint) console.log(`       ${c('yellow', cr.hint)}`);
  }

  // .env file
  const ev = setup.env;
  console.log(`\n  ${ev.missing ? warn() : ok()} ~/.kosame/.env`);
  console.log(`       パス   : ${c('cyan', ENV_FILE)}`);
  if (!ev.missing) {
    if (ev.loaded.length > 0)  console.log(`       ロード済: ${ev.loaded.join(', ')}`);
    if (ev.skipped.length > 0) console.log(`       スキップ: ${c('dim', ev.skipped.join(', '))} (process.env が優先)`);
  } else {
    console.log(`       ${c('yellow', 'ファイルが存在しません。ステップ 4 を参照してください。')}`);
  }

  // Env vars
  console.log(`\n  ${setup.sheetsId ? ok() : ng()} KOSAME_SHEETS_ID`);
  console.log(`       値     : ${setup.sheetsId ?? c('red', '(未設定)')}`);
  console.log(`  ${setup.docsId ? ok() : ng()} KOSAME_DOCS_ID`);
  console.log(`       値     : ${setup.docsId ?? c('red', '(未設定)')}`);

  // Summary
  console.log('');
  console.log('  ' + hr());
  if (setup.ok) {
    console.log(`  ${c('green', '✓ 設定完了')} — ${c('dim', 'npm run gdrive:test --write で実接続を確認できます')}`);
  } else {
    console.log(`  ${c('red', '✗ 設定が不完全です')} — ${c('dim', 'npm run gdrive:setup でガイドを確認してください')}`);
  }
  console.log('');
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const has  = f => args.includes(f);
  return {
    check:  has('--check'),
    guide:  has('--guide'),
    test:   has('--test'),
    write:  has('--write'),
    json:   has('--json'),
  };
}

async function main() {
  const args  = parseArgs(process.argv);
  const dryRun = !args.write;

  if (args.guide) {
    printSetupGuide();
    return;
  }

  if (args.test) {
    console.log(`\n${c('bold', '接続テスト中...')}  dryRun: ${dryRun}`);
    const result = await testConnection({ dryRun });

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.ok) {
      console.log(c('green', '\n  ✓ 接続成功'));
      if (result.results?.sheets) {
        const s = result.results.sheets;
        console.log(`    Sheets: ${s.ok ? c('green', '✓') + ' ' + s.title : c('red', '✗ ' + s.error)}`);
      }
      if (result.results?.docs) {
        const d = result.results.docs;
        console.log(`    Docs  : ${d.ok ? c('green', '✓') + ' ' + d.title : c('red', '✗ ' + d.error)}`);
      }
      if (result.message) console.log(`\n  ${c('blue', result.message)}`);
    } else {
      console.log(c('red', '\n  ✗ 接続失敗: ') + (result.error || ''));
    }
    console.log('');
    return;
  }

  // Default / --check: show status
  const setup = validateSetup();

  if (args.json) {
    console.log(JSON.stringify({ tool: TOOL_META.slug, version: TOOL_META.version, setup }, null, 2));
    return;
  }

  printStatus(setup);

  // 設定が不完全な場合はガイドも表示
  if (!setup.ok && !args.check) {
    printSetupGuide();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(c('red', 'ERROR:'), err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  ENV_FILE,
  CREDS_FILE,
  loadKosameEnv,
  validateCredentials,
  validateSetup,
  testConnection,
};
