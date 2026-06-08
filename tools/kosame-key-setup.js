#!/usr/bin/env node
'use strict';

/**
 * KOSAME Key Setup v110.23.0
 *
 * Cloud Shell 起動時に API キーを自動ロードするための初回セットアップ。
 *
 *   ~/.kosame/.env  — キー保存ファイル（パーミッション 600）
 *   ~/.bashrc       — 自動読込スニペット追加
 *
 * 対象キー:
 *   GEMINI_API_KEY / OPENAI_API_KEY / GROK_API_KEY / DISCORD_BOT_TOKEN
 *   DEEPSEEK_API_KEY / KIMI_API_KEY  ← sanitized advisory 用（マスク付き）
 *
 * Usage:
 *   npm run setup:keys            # dryRun — プレビューのみ
 *   npm run setup:keys -- --write # 実際に書き込む
 *   npm run setup:keys -- --check # 現在の設定状態を確認
 */

const readline = require('node:readline');
const fs       = require('node:fs');
const path     = require('node:path');
const os       = require('node:os');

const TOOL_META = {
  version: '110.23.0',
  feature: 'v110-23-key-setup',
  slug:    'kosame-key-setup',
};

const HOME         = os.homedir();
const KOSAME_DIR   = path.join(HOME, '.kosame');
const ENV_FILE     = path.join(KOSAME_DIR, '.env');
const BASHRC_FILE  = path.join(HOME, '.bashrc');

const BASHRC_START = '# >>> kosame key auto-loader >>>';
const BASHRC_END   = '# <<< kosame key auto-loader <<<';
const BASHRC_BLOCK = `${BASHRC_START}
if [ -f "$HOME/.kosame/.env" ]; then
  set -a; source "$HOME/.kosame/.env" 2>/dev/null; set +a
fi
${BASHRC_END}`;

// ── Key registry ──────────────────────────────────────────────────────────────

const KEY_DEFS = [
  {
    name:     'GEMINI_API_KEY',
    label:    'Gemini API Key',
    provider: 'Google DeepMind',
    advisory: null,
  },
  {
    name:     'OPENAI_API_KEY',
    label:    'OpenAI API Key',
    provider: 'OpenAI',
    advisory: null,
  },
  {
    name:     'GROK_API_KEY',
    label:    'Grok API Key',
    provider: 'xAI',
    advisory: null,
  },
  {
    name:     'DISCORD_BOT_TOKEN',
    label:    'Discord Bot Token',
    provider: 'Discord',
    advisory: null,
  },
  {
    name:     'DEEPSEEK_API_KEY',
    label:    'DeepSeek API Key',
    provider: 'DeepSeek',
    advisory: 'sanitized-advisory',
    advisoryNote: 'sanitized handoff 用。出力は自動マスク処理されてからクロスプロバイダーリレーに渡されます。',
  },
  {
    name:     'KIMI_API_KEY',
    label:    'Kimi (Moonshot) API Key',
    provider: 'Moonshot AI',
    advisory: 'sanitized-advisory',
    advisoryNote: 'sanitized handoff 用。出力は自動マスク処理されてからクロスプロバイダーリレーに渡されます。',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
};

function c(color, text) { return `${C[color]}${text}${C.reset}`; }
function header(text)   { console.log(`\n${c('bold', c('blue', '⬡ ' + text))}`); }
function info(text)     { console.log(`  ${c('cyan', '·')} ${text}`); }
function ok(text)       { console.log(`  ${c('green', '✓')} ${text}`); }
function warn(text)     { console.log(`  ${c('yellow', '⚠')} ${text}`); }
function dryLine(text)  { console.log(`  ${c('gray', '[dry]')} ${text}`); }

function maskValue(val) {
  if (!val || val.length < 8) return '[too short]';
  return val.slice(0, 4) + '****' + val.slice(-4);
}

// ── .env parser / serializer ──────────────────────────────────────────────────

function parseEnvFile(content = '') {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) result[key] = val;
  }
  return result;
}

function buildEnvFileContent(values) {
  const now = new Date().toISOString().slice(0, 10);
  const lines = [
    `# KOSAME API Keys — auto-loaded on Cloud Shell startup`,
    `# Managed by: npm run setup:keys`,
    `# Updated:    ${now}`,
    `# DO NOT commit this file to version control`,
    ``,
  ];

  let inAdvisory = false;
  for (const def of KEY_DEFS) {
    if (def.advisory && !inAdvisory) {
      lines.push(
        `# ── Sanitized Advisory Keys ──────────────────────────────────────────────────`,
        `# DeepSeek / Kimi は sanitized handoff フロー専用。`,
        `# 出力はクロスプロバイダーリレー前に自動マスク処理されます。`,
        ``,
      );
      inAdvisory = true;
    }
    const val = values[def.name] || '';
    lines.push(`${def.name}=${val}`);
  }

  lines.push('');
  return lines.join('\n');
}

// ── .bashrc updater ───────────────────────────────────────────────────────────

function isBashrcPatched(content) {
  return content.includes(BASHRC_START);
}

function patchBashrc(content) {
  if (isBashrcPatched(content)) {
    // Replace existing block
    const start = content.indexOf(BASHRC_START);
    const end   = content.indexOf(BASHRC_END);
    if (end === -1) return content + '\n' + BASHRC_BLOCK + '\n';
    return content.slice(0, start).trimEnd() + '\n' + BASHRC_BLOCK + '\n' + content.slice(end + BASHRC_END.length).trimStart();
  }
  return content.trimEnd() + '\n\n' + BASHRC_BLOCK + '\n';
}

// ── Check mode ────────────────────────────────────────────────────────────────

function runCheck() {
  header('KOSAME Key Setup — 現在の設定状態');

  const envExists = fs.existsSync(ENV_FILE);
  if (envExists) {
    ok(`~/.kosame/.env が存在します`);
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    const stored  = parseEnvFile(content);
    for (const def of KEY_DEFS) {
      const val     = stored[def.name] || '';
      const present = val.length > 0;
      const tag     = present ? c('green', '[SET]') : c('gray', '[  ]');
      const advisory = def.advisory ? c('yellow', ' [sanitized-advisory]') : '';
      console.log(`    ${tag}  ${def.name}${advisory}`);
    }
  } else {
    warn(`~/.kosame/.env が存在しません（npm run setup:keys -- --write で作成）`);
  }

  console.log('');
  const bashrc  = fs.existsSync(BASHRC_FILE) ? fs.readFileSync(BASHRC_FILE, 'utf8') : '';
  if (isBashrcPatched(bashrc)) {
    ok(`~/.bashrc に自動読込スニペットが設定済みです`);
  } else {
    warn(`~/.bashrc に自動読込スニペットが未設定です`);
  }

  console.log('');
  const envPresence = {};
  for (const def of KEY_DEFS) {
    const val = process.env[def.name];
    envPresence[def.name] = typeof val === 'string' && val.length > 0;
  }
  const loaded = Object.values(envPresence).filter(Boolean).length;
  info(`現在のシェルで有効なキー: ${loaded} / ${KEY_DEFS.length}`);
}

// ── Interactive setup ─────────────────────────────────────────────────────────

async function runSetup(opts = {}) {
  const { dryRun = true, write = false } = opts;
  const live = write && !dryRun;

  header(`KOSAME Key Setup v${TOOL_META.version}${live ? '' : '  [DRY-RUN]'}`);
  console.log('');
  info(`キーは ~/.kosame/.env に保存され、Cloud Shell 起動時に自動読み込みされます。`);
  info(`DeepSeek / Kimi は sanitized advisory 用 — 出力マスク処理が適用されます。`);
  if (!live) {
    console.log(`\n  ${c('yellow', '⚠ DRY-RUN モード')} — ファイルは書き込まれません。`);
    console.log(`  実際に書き込むには: ${c('bold', 'npm run setup:keys -- --write')}\n`);
  }

  // Load existing .env values
  let existing = {};
  if (fs.existsSync(ENV_FILE)) {
    existing = parseEnvFile(fs.readFileSync(ENV_FILE, 'utf8'));
    ok(`既存の ~/.kosame/.env を読み込みました`);
  }

  // Merge with current process.env
  const current = {};
  for (const def of KEY_DEFS) {
    current[def.name] = existing[def.name] || process.env[def.name] || '';
  }

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });

  function ask(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
  }

  console.log('');
  const newValues = {};

  for (const def of KEY_DEFS) {
    const curr    = current[def.name] || '';
    const hasVal  = curr.length > 0;
    const masked  = hasVal ? maskValue(curr) : c('gray', '未設定');
    const advisoryTag = def.advisory
      ? c('yellow', '  [sanitized-advisory]')
      : '';

    console.log(`  ${c('bold', def.name)}${advisoryTag}`);
    console.log(`  ${c('dim', def.provider)}  現在: ${masked}`);
    if (def.advisoryNote) {
      console.log(`  ${c('yellow', '⚠')} ${c('dim', def.advisoryNote)}`);
    }

    let input;
    if (process.stdin.isTTY) {
      input = await ask(`  新しい値 (Enterでスキップ): `);
    } else {
      input = '';
    }

    newValues[def.name] = input.trim() || curr;
    const final = newValues[def.name];
    const tag   = final.length > 0 ? c('green', '[SET]') : c('gray', '[  ]');
    console.log(`  → ${tag}  ${maskValue(final) || c('dim', 'empty')}`);
    console.log('');
  }

  rl.close();

  // Show preview
  const envContent = buildEnvFileContent(newValues);
  console.log(c('bold', '\n  ── ~/.kosame/.env プレビュー ──────────────────────'));
  for (const line of envContent.split('\n')) {
    // Mask actual values in preview output
    const safe = line.replace(/=([A-Za-z0-9\-_./+]{8,})/g, (m, v) => `=${maskValue(v)}`);
    console.log(`  ${c('dim', safe)}`);
  }

  const bashrc       = fs.existsSync(BASHRC_FILE) ? fs.readFileSync(BASHRC_FILE, 'utf8') : '';
  const needsBashrc  = !isBashrcPatched(bashrc);
  const patchedBashrc = needsBashrc ? patchBashrc(bashrc) : bashrc;

  if (needsBashrc) {
    console.log(c('bold', '\n  ── ~/.bashrc 追加スニペット ───────────────────────'));
    for (const line of BASHRC_BLOCK.split('\n')) {
      console.log(`  ${c('dim', line)}`);
    }
  } else {
    ok('~/.bashrc の自動読込スニペットは設定済みです');
  }

  if (!live) {
    dryLine('dryRun — ファイル書き込みをスキップしました');
    console.log('');
    return { dryRun: true, newValues: Object.keys(newValues) };
  }

  // ── Live write ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(KOSAME_DIR)) {
    fs.mkdirSync(KOSAME_DIR, { recursive: true, mode: 0o700 });
    ok(`~/.kosame/ ディレクトリを作成しました`);
  }

  fs.writeFileSync(ENV_FILE, envContent, { mode: 0o600, encoding: 'utf8' });
  ok(`~/.kosame/.env を書き込みました (permission 600)`);

  if (needsBashrc) {
    fs.writeFileSync(BASHRC_FILE, patchedBashrc, { encoding: 'utf8' });
    ok(`~/.bashrc に自動読込スニペットを追加しました`);
  }

  console.log('');
  console.log(c('green', c('bold', '  ✓ セットアップ完了')));
  console.log(`  次回 Cloud Shell 起動から自動的にキーが読み込まれます。`);
  console.log(`  今すぐ有効にするには: ${c('bold', 'source ~/.bashrc')}`);
  console.log('');

  return { dryRun: false, written: true };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args   = argv.slice(2);
  const write  = args.includes('--write');
  const check  = args.includes('--check');
  const dryRun = !write;
  return { write, check, dryRun };
}

async function main() {
  const { write, check, dryRun } = parseArgs(process.argv);

  if (check) {
    runCheck();
    return;
  }

  await runSetup({ dryRun, write });
}

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  KEY_DEFS,
  ENV_FILE,
  BASHRC_BLOCK,
  parseEnvFile,
  buildEnvFileContent,
  isBashrcPatched,
  patchBashrc,
  maskValue,
  runCheck,
  runSetup,
};
