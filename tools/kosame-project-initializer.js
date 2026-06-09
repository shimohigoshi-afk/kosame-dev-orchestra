#!/usr/bin/env node
'use strict';

/**
 * KOSAME Project Initializer v110.35.0
 *
 * 3つの機能を提供する:
 *   1. new:project  — GitHubリポジトリ + Driveエントリ + ダッシュボード登録をワンコマンドで実行
 *   2. --scan       — ~/配下のgit repoを自動スキャンし、新規repoをレジストリに追加
 *   3. --sync-commit — 最新commitをGoogle Driveドキュメントに自動同期
 *
 * プロジェクトレジストリ: state/projects-registry.json
 * dryRun デフォルト — 実書き込みは --write フラグが必要
 *
 * Usage:
 *   npm run new:project -- --name="my-app"
 *   npm run new:project -- --name="my-app" --write
 *   npm run new:project -- --name="my-app" --no-github --no-drive --write
 *   npm run scan:projects
 *   npm run scan:projects -- --write
 *   npm run sync:commit
 *   npm run sync:commit -- --write
 */

const fs            = require('node:fs');
const path          = require('node:path');
const os            = require('node:os');
const { execFileSync } = require('node:child_process');

const TOOL_META = {
  version:      '110.35.0',
  feature:      'v110-35-project-initializer',
  slug:         'kosame-project-initializer',
  dryRunDefault: true,
};

const ROOT          = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'state', 'projects-registry.json');
const KOSAME_DIR    = path.join(os.homedir(), '.kosame');
const LOG_FILE      = path.join(KOSAME_DIR, 'learning-log.jsonl');

// デフォルトGitHub org（gh auth status から取得）
const DEFAULT_GITHUB_ORG = 'shimohigoshi-afk';

// ダッシュボード用カラーパレット（順番に割り当て）
const COLOR_PALETTE = [
  '#58a6ff', '#d97706', '#10b981', '#8b5cf6', '#ef4444',
  '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#f97316',
];

// ── バリデーション ────────────────────────────────────────────────────────────

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,49}$/;

/**
 * プロジェクト名を検証し、正規化されたキー（lowercase-hyphen）を返す。
 * @param {string} name
 * @returns {string} key
 */
function validateProjectName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('project name must be a non-empty string');
  }
  const trimmed = name.trim();
  if (trimmed.length < 2)  throw new Error('project name must be at least 2 characters');
  if (trimmed.length > 50) throw new Error('project name must be 50 characters or less');
  const key = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  if (key.length < 2) throw new Error(`project name "${name}" normalizes to an invalid key`);
  return key;
}

// ── カラー生成 ────────────────────────────────────────────────────────────────

/**
 * プロジェクトキーから決定論的にカラーを選択する。
 * @param {string} key
 * @returns {string} hex color
 */
function generateColor(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

// ── プロジェクトエントリ構築 ──────────────────────────────────────────────────

/**
 * プロジェクトエントリオブジェクトを構築する。
 * @param {string} name  表示名
 * @param {object} opts  { githubOrg, repoPath, color, source }
 * @returns {object}
 */
function buildProjectEntry(name, opts = {}) {
  const {
    githubOrg = DEFAULT_GITHUB_ORG,
    repoPath  = null,
    color     = null,
    source    = 'new:project',
  } = opts;

  const key        = validateProjectName(name);
  const label      = name.trim();
  const resolvedPath = repoPath || path.join(os.homedir(), key);
  const githubRepo = `${githubOrg}/${key}`;
  const pickedColor = color || generateColor(key);

  return {
    key,
    label,
    path:       resolvedPath,
    color:      pickedColor,
    githubRepo,
    addedAt:    new Date().toISOString(),
    addedBy:    source,
  };
}

// ── レジストリ操作 ────────────────────────────────────────────────────────────

/**
 * projects-registry.json を読み込む。ファイルが無ければ空のレジストリを返す。
 * @returns {{ version, updatedAt, projects: Array }}
 */
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    return { version: '1', updatedAt: null, projects: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  } catch {
    return { version: '1', updatedAt: null, projects: [] };
  }
}

/**
 * レジストリにプロジェクトを追加する（同一 key は上書き）。
 * @param {object} entry
 * @param {object} opts  { dryRun }
 * @returns {{ ok, dryRun, added, registry }}
 */
function addToRegistry(entry, opts = {}) {
  const { dryRun = true } = opts;
  const registry = loadRegistry();

  const idx = registry.projects.findIndex(p => p.key === entry.key);
  const isNew = idx === -1;
  if (isNew) {
    registry.projects.push(entry);
  } else {
    registry.projects[idx] = { ...registry.projects[idx], ...entry };
  }
  registry.updatedAt = new Date().toISOString();

  if (!dryRun) {
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
  }

  return {
    ok:            true,
    dryRun,
    added:         isNew,
    updated:       !isNew,
    registryFile:  REGISTRY_FILE,
    projectCount:  registry.projects.length,
    registry:      dryRun ? registry : null,
    realProductActionsExecuted: !dryRun,
  };
}

// ── GitHub リポジトリ作成 ─────────────────────────────────────────────────────

/**
 * GitHub リポジトリを作成する。
 * dryRun では gh コマンドを実行せず、実行予定コマンドを返す。
 *
 * @param {string} repoFullName  "org/key"
 * @param {object} opts          { dryRun, isPrivate, description }
 * @returns {{ ok, dryRun, repoFullName, command, url, executed }}
 */
function createGithubRepo(repoFullName, opts = {}) {
  const { dryRun = true, isPrivate = true, description = '' } = opts;

  const visibility = isPrivate ? '--private' : '--public';
  const args = [
    'repo', 'create', repoFullName,
    visibility,
    '--confirm',
  ];
  if (description) args.push('--description', description);

  const command = `gh ${args.join(' ')}`;
  const url     = `https://github.com/${repoFullName}`;

  if (dryRun) {
    return {
      ok:       true,
      dryRun:   true,
      op:       'github:create',
      repoFullName,
      command,
      url,
      executed: false,
      realProductActionsExecuted: false,
    };
  }

  try {
    execFileSync('gh', args, { encoding: 'utf8', timeout: 30_000 });
    return {
      ok:       true,
      dryRun:   false,
      op:       'github:create',
      repoFullName,
      command,
      url,
      executed: true,
      realProductActionsExecuted: true,
    };
  } catch (err) {
    return {
      ok:       false,
      dryRun:   false,
      op:       'github:create',
      repoFullName,
      command,
      url,
      executed: false,
      error:    err.message.slice(0, 200),
      realProductActionsExecuted: false,
    };
  }
}

// ── Drive エントリ作成 ────────────────────────────────────────────────────────

/**
 * Google Drive ドキュメントにプロジェクト初期化エントリを追記する。
 * kosame-gdrive-writer の writeDocsEntry を呼ぶ（常に dryRun）。
 *
 * @param {object} entry  project entry
 * @param {object} opts   { dryRun }
 */
async function createDriveEntry(entry, opts = {}) {
  const { dryRun = true } = opts;

  try {
    const { writeDocsEntry } = require('./kosame-gdrive-writer');
    const content = `新規プロジェクト: ${entry.label} (${entry.key}) | GitHub: ${entry.githubRepo} | path: ${entry.path}`;
    return await writeDocsEntry({
      dryRun: true,           // Drive書き込みは常に dryRun（別途 gdrive:write で実施）
      content,
      version: TOOL_META.version,
    });
  } catch (err) {
    return {
      ok:    false,
      dryRun: true,
      op:    'docs:append',
      error: err.message.slice(0, 200),
      realProductActionsExecuted: false,
    };
  }
}

// ── 1. new:project ────────────────────────────────────────────────────────────

/**
 * プロジェクト初期化をワンコマンドで実行する。
 *
 * @param {string} name  プロジェクト名
 * @param {object} opts
 *   dryRun     {boolean}   default true
 *   githubOrg  {string}    default 'shimohigoshi-afk'
 *   isPrivate  {boolean}   default true
 *   noGithub   {boolean}   default false — GitHub作成をスキップ
 *   noDrive    {boolean}   default false — Drive書き込みをスキップ
 *   color      {string}    null=自動生成
 * @returns {object}
 */
async function newProject(name, opts = {}) {
  const {
    dryRun    = true,
    githubOrg = DEFAULT_GITHUB_ORG,
    isPrivate = true,
    noGithub  = false,
    noDrive   = false,
    color     = null,
  } = opts;

  const entry = buildProjectEntry(name, { githubOrg, color, source: 'new:project' });

  // GitHub
  let githubResult = null;
  if (!noGithub) {
    githubResult = createGithubRepo(entry.githubRepo, {
      dryRun,
      isPrivate,
      description: `KOSAME project: ${entry.label}`,
    });
  }

  // Drive
  let driveResult = null;
  if (!noDrive) {
    driveResult = await createDriveEntry(entry, { dryRun });
  }

  // Registry
  const registryResult = addToRegistry(entry, { dryRun });

  // learning-log
  appendLearningLog('newProject', entry, { dryRun });

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    op:      'new:project',
    dryRun,
    ok:      true,
    project: entry,
    githubResult,
    driveResult,
    registryResult,
    realProductActionsExecuted: !dryRun,
    dangerousActionsDenied:     true,
  };
}

// ── 2. scan:projects ──────────────────────────────────────────────────────────

/**
 * ~/配下の git repo を検索し、レジストリにない新規 repo を追加する。
 *
 * @param {object} opts
 *   dryRun   {boolean}  default true
 *   baseDir  {string}   default os.homedir()
 *   maxDepth {number}   default 3
 * @returns {object}
 */
function scanGitRepos(opts = {}) {
  const { dryRun = true, baseDir = os.homedir(), maxDepth = 3 } = opts;

  const discovered = findGitRepos(baseDir, maxDepth);
  const registry   = loadRegistry();
  const knownPaths = new Set(registry.projects.map(p => p.path));
  const knownKeys  = new Set(registry.projects.map(p => p.key));

  const newRepos = discovered.filter(r => !knownPaths.has(r.path));
  const added    = [];

  for (const repo of newRepos) {
    const key = repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
    if (!key || knownKeys.has(key)) continue;

    const entry = buildProjectEntry(repo.name, {
      repoPath: repo.path,
      source:   'scan',
    });
    const res = addToRegistry(entry, { dryRun });
    if (res.added) {
      added.push(entry);
      knownKeys.add(entry.key);
    }
  }

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    op:      'scan:projects',
    dryRun,
    ok:      true,
    baseDir,
    discoveredCount: discovered.length,
    discovered:      discovered.map(r => r.path),
    newCount:  added.length,
    added:     added.map(e => e.key),
    registryFile: REGISTRY_FILE,
    realProductActionsExecuted: !dryRun,
    dangerousActionsDenied:     true,
  };
}

/**
 * 指定ディレクトリ以下で .git ディレクトリを検索する。
 * node のみで実装（find コマンドに依存しない）。
 *
 * @param {string} baseDir
 * @param {number} maxDepth
 * @returns {Array<{ name, path }>}
 */
function findGitRepos(baseDir, maxDepth = 3) {
  const results = [];

  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }

    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.git') continue;
      if (!e.isDirectory()) continue;
      if (e.name === 'node_modules') continue;

      const full = path.join(dir, e.name);
      if (e.name === '.git') {
        // 親ディレクトリが git repo
        results.push({ name: path.basename(dir), path: dir });
        return; // このサブツリーは走査しない
      }
      walk(full, depth + 1);
    }
  }

  walk(baseDir, 0);
  return results;
}

// ── 3. sync:commit ────────────────────────────────────────────────────────────

/**
 * 最新コミットを Google Drive ドキュメントに同期する。
 * commit/push 後に呼ぶことで設計書を自動更新する。
 *
 * @param {object} opts
 *   dryRun   {boolean}  default true
 *   repoPath {string}   default process.cwd()
 * @returns {object}
 */
async function syncCommit(opts = {}) {
  const { dryRun = true, repoPath = process.cwd() } = opts;

  const commit  = getLatestCommitFromPath(repoPath);
  let   version = getPackageVersion(repoPath);

  let driveResult = null;
  try {
    const { writeDocsEntry } = require('./kosame-gdrive-writer');
    const content = commit
      ? `auto-sync: ${commit.hash} ${commit.msg}`
      : 'auto-sync: (no commit info)';

    driveResult = await writeDocsEntry({
      dryRun,     // --write で実書き込み
      content,
      version,
      commit,
    });
  } catch (err) {
    driveResult = { ok: false, error: err.message.slice(0, 200), dryRun };
  }

  appendLearningLog('syncCommit', { commit, version }, { dryRun });

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    op:      'sync:commit',
    dryRun,
    ok:      driveResult?.ok ?? false,
    repoPath,
    commit,
    packageVersion: version,
    driveResult,
    realProductActionsExecuted: !dryRun && (driveResult?.realProductActionsExecuted ?? false),
    dangerousActionsDenied:     true,
  };
}

/**
 * 指定ディレクトリの最新 git commit を取得する。
 * @param {string} repoPath
 * @returns {{ hash, msg } | null}
 */
function getLatestCommitFromPath(repoPath) {
  try {
    const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoPath, encoding: 'utf8', timeout: 5000 }).trim();
    const msg  = execFileSync('git', ['log', '-1', '--pretty=%s'],     { cwd: repoPath, encoding: 'utf8', timeout: 5000 }).trim();
    return { hash, msg };
  } catch {
    return null;
  }
}

/**
 * package.json から version を読む。
 * @param {string} repoPath
 * @returns {string}
 */
function getPackageVersion(repoPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf8'));
    return pkg.version || TOOL_META.version;
  } catch {
    return TOOL_META.version;
  }
}

// ── Learning-log / autoRecording ──────────────────────────────────────────────

function appendLearningLog(op, data, opts = {}) {
  const { dryRun = true } = opts;
  const entry = {
    ts:         new Date().toISOString(),
    taskType:   'implement',
    difficulty: 'medium',
    model:      'n/a',
    provider:   'project-initializer',
    costUsd:    null,
    durationMs: null,
    success:    true,
    escalated:  false,
    dryRun,
    taskInput:  `${op}: ${JSON.stringify(data).slice(0, 80)}`,
  };
  try {
    if (!fs.existsSync(KOSAME_DIR)) fs.mkdirSync(KOSAME_DIR, { recursive: true });
    if (!dryRun) fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch { /* non-fatal */ }
}

async function autoRecord(op, result, opts = {}) {
  const { dryRun = true } = opts;
  appendLearningLog(op, { ok: result.ok }, { dryRun });

  let sheetRes = null;
  let docRes   = null;
  try {
    const gdriveWriter = require('./kosame-gdrive-writer');
    const writerOpts = {
      dryRun:  true,
      content: `${TOOL_META.slug}:${op} ok=${result.ok}`,
      version: TOOL_META.version,
    };
    if (typeof gdriveWriter.writeSheetsRows === 'function') sheetRes = await gdriveWriter.writeSheetsRows(writerOpts);
    if (typeof gdriveWriter.writeDocsEntry  === 'function') docRes   = await gdriveWriter.writeDocsEntry(writerOpts);
  } catch { /* non-fatal */ }

  return { learningLogAppended: true, autoRecording: { sheetRes, docRes } };
}

// ── CLI printer ───────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', gray: '\x1b[90m', magenta: '\x1b[35m',
};
const c = (col, t) => `${C[col]}${t}${C.reset}`;

function printNewProject(result) {
  const dry = result.dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME new:project'))}  ${dry}  v${result.version}`);

  const p = result.project;
  console.log(`\n  ${c('bold', 'プロジェクト:')} ${c('cyan', p.label)}  (${c('gray', p.key)})`);
  console.log(`  path      : ${p.path}`);
  console.log(`  color     : ${p.color}`);

  if (result.githubResult) {
    const gh = result.githubResult;
    const mark = gh.ok ? c('green', '✓') : c('red', '✗');
    console.log(`\n  ${c('bold', 'GitHub:')}  ${mark}  ${gh.repoFullName}`);
    console.log(`    URL     : ${gh.url}`);
    if (result.dryRun) console.log(`    Command : ${c('dim', gh.command)}`);
  }

  if (result.driveResult) {
    const dr = result.driveResult;
    const mark = dr.ok ? c('green', '✓') : c('red', '✗');
    console.log(`\n  ${c('bold', 'Drive:')}  ${mark}  ${dr.op ?? 'docs:append'}`);
    if (dr.textPreview) console.log(`    preview : ${c('dim', dr.textPreview.replace(/\n/g, ' ').slice(0, 60))}`);
  }

  const rr = result.registryResult;
  const mark = rr.ok ? c('green', '✓') : c('red', '✗');
  const action = rr.added ? c('cyan', '追加') : c('yellow', '更新');
  console.log(`\n  ${c('bold', 'Registry:')}  ${mark}  ${action}  (合計 ${rr.projectCount} プロジェクト)`);
  console.log(`    file    : ${rr.registryFile}`);

  console.log('');
}

function printScan(result) {
  const dry = result.dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME scan:projects'))}  ${dry}  v${result.version}`);
  console.log(`  base      : ${result.baseDir}`);
  console.log(`  discovered: ${result.discoveredCount} git repos`);

  if (result.newCount > 0) {
    console.log(`  ${c('cyan', `新規 ${result.newCount} 件`)}: ${result.added.join(', ')}`);
  } else {
    console.log(`  ${c('dim', '新規 repo なし（全件既知）')}`);
  }
  console.log('');
}

function printSyncCommit(result) {
  const dry = result.dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  console.log(`\n${c('bold', c('blue', '⬡ KOSAME sync:commit'))}  ${dry}  v${result.version}`);
  if (result.commit) {
    console.log(`  commit    : ${c('cyan', result.commit.hash)}  ${result.commit.msg.slice(0, 60)}`);
  } else {
    console.log(`  ${c('yellow', '⚠ commit 情報取得不可')}`);
  }
  console.log(`  version   : ${result.packageVersion}`);
  if (result.driveResult) {
    const dr = result.driveResult;
    const mark = dr.ok ? c('green', '✓') : c('red', '✗');
    console.log(`  Drive     : ${mark}  dryRun=${dr.dryRun}`);
    if (dr.textPreview) console.log(`    preview : ${c('dim', dr.textPreview.replace(/\n/g, ' ').slice(0, 60))}`);
  }
  console.log('');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args  = argv.slice(2);
  const has   = flag   => args.includes(flag);
  const get   = prefix => (args.find(a => a.startsWith(prefix)) ?? '').slice(prefix.length) || null;

  return {
    newProject:  has('--new') || has('--name'),
    scan:        has('--scan'),
    syncCommit:  has('--sync-commit'),
    name:        get('--name='),
    githubOrg:   get('--github-org=') || DEFAULT_GITHUB_ORG,
    isPrivate:   !has('--public'),
    noGithub:    has('--no-github'),
    noDrive:     has('--no-drive'),
    baseDir:     get('--base-dir=') || os.homedir(),
    repoPath:    get('--repo-path=') || process.cwd(),
    write:       has('--write'),
    json:        has('--json'),
    record:      has('--record'),
  };
}

async function main() {
  const args   = parseArgs(process.argv);
  const dryRun = !args.write;

  if (args.scan) {
    const result = scanGitRepos({ dryRun, baseDir: args.baseDir });
    if (args.record) await autoRecord('scan', result, { dryRun });
    if (args.json) { console.log(JSON.stringify(result, null, 2)); return; }
    printScan(result);
    return;
  }

  if (args.syncCommit) {
    const result = await syncCommit({ dryRun, repoPath: args.repoPath });
    if (args.record) await autoRecord('syncCommit', result, { dryRun });
    if (args.json) { console.log(JSON.stringify(result, null, 2)); return; }
    printSyncCommit(result);
    return;
  }

  // new:project (default or --name)
  if (!args.name) {
    console.log(JSON.stringify({
      tool: TOOL_META,
      usage: [
        'npm run new:project -- --name="my-app"',
        'npm run new:project -- --name="my-app" --write',
        'npm run new:project -- --name="my-app" --no-github --no-drive',
        'npm run new:project -- --name="my-app" --public',
        'npm run scan:projects',
        'npm run scan:projects -- --write',
        'npm run sync:commit',
        'npm run sync:commit -- --write',
      ],
    }, null, 2));
    return;
  }

  const result = await newProject(args.name, {
    dryRun,
    githubOrg: args.githubOrg,
    isPrivate: args.isPrivate,
    noGithub:  args.noGithub,
    noDrive:   args.noDrive,
  });
  if (args.record) await autoRecord('newProject', result, { dryRun });
  if (args.json) { console.log(JSON.stringify(result, null, 2)); return; }
  printNewProject(result);
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
}

module.exports = {
  TOOL_META,
  REGISTRY_FILE,
  DEFAULT_GITHUB_ORG,
  COLOR_PALETTE,
  validateProjectName,
  generateColor,
  buildProjectEntry,
  loadRegistry,
  addToRegistry,
  createGithubRepo,
  createDriveEntry,
  newProject,
  findGitRepos,
  scanGitRepos,
  syncCommit,
  getLatestCommitFromPath,
  getPackageVersion,
  appendLearningLog,
  autoRecord,
};
