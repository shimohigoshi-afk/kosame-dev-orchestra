#!/usr/bin/env node
'use strict';

const activity = require('./kosame-activity-events');

/**
 * KOSAME Auto Dev v110.53.0
 *
 * 設計書 → Claude Code 自動実行パイプライン
 *
 * フロー（タスク単位）:
 *   1. spec-analyzer でタスク自動分解
 *   2. human_gate (high難度 / 破壊的操作)
 *   3. Claude Code CLI (-p) で実装
 *   4. autoVerify (品質チェック)
 *      PASS → learning-log + GDrive 記録
 *      FAIL → project-guard 経由で許可モデルに修正依頼 → 再verify
 *   5. 全タスク完了 → GPT 裁定 → Claude 品質チェック
 *   6. じゅんやさんに Discord 報告
 *
 * 制約:
 *   - commit/push/deploy/Secret/IAM は自動実行禁止 → human_gate 必須
 *   - DeepSeek は project-guard 経由のみ (transcriber 完全禁止)
 *   - Claude Code 停止時 → 失敗分類 → 許可済みモデルで fallback
 *
 * Usage:
 *   npm run auto:dev -- --spec="設計書テキスト"
 *   npm run auto:dev -- --file=./spec.md
 *   npm run auto:dev -- --spec="..." --write          # 実際のAPI呼び出し
 *   npm run auto:dev -- --spec="..." --project=anesty-board
 *   npm run auto:dev -- --spec="..." --repo=/path/to/target  # 対象repo
 *   npm run auto:dev -- --spec="..." --json           # JSON 出力
 *   AUTO_DEV_REPO=/path CLAUDE_TIMEOUT_MS=600000 npm run auto:dev -- --spec="..."
 */

const fs        = require('node:fs');
const path      = require('node:path');
const readline  = require('node:readline');
const { spawnSync, execSync } = require('node:child_process');

const TOOL_META = {
  version:       '110.53.0',
  feature:       'v110-53-ip-protection',
  slug:          'kosame-auto-dev',
  dryRunDefault: true,
};

const CLAUDE_TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS || '300000', 10);
const BACKUP_DIR        = path.resolve(__dirname, '..', '.auto-dev-backups');

// ── Secret redaction ──────────────────────────────────────────────────────────

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,                    // OpenAI / Claude API keys
  /AIza[0-9A-Za-z_-]{35,}/g,                 // Gemini API keys
  /xox[bpras]-[0-9A-Za-z-]{20,}/g,           // Slack tokens
  /gh[pousr]_[A-Za-z0-9]{36,}/g,             // GitHub tokens
  /(?:^|[^a-zA-Z])(discord)?bot[._-]?token[=:]\s*\S{10,}/gi, // Bot tokens
  /(?:^|[^a-zA-Z])api[._-]?key[=:]\s*\S{10,}/gi,
  /(?:^|[^a-zA-Z])secret[=:]\s*\S{10,}/gi,
  /(?:^|[^a-zA-Z])password[=:]\s*\S{10,}/gi,
  /(?:^|[^a-zA-Z])credentials[=:]\s*\S{10,}/gi,
  /\b[A-Za-z0-9+/]{40,}\b/g,                 // base64-looking strings (40+ chars)
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT tokens
].map(r => ({ regex: r }));

const ENV_SECRET_VARS = [
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
  'DISCORD_BOT_TOKEN', 'DISCORD_WEBHOOK_URL', 'DEEPSEEK_API_KEY', 'GROK_API_KEY',
  'KIMI_API_KEY', 'SLACK_TOKEN', 'LINE_TOKEN',
  'KOSAME_API_KEY', 'KOSAME_IDENTITY_TOKEN',
];

function buildEnvValuesPattern() {
  const vals = [];
  for (const name of ENV_SECRET_VARS) {
    const v = process.env[name];
    if (v && v.length >= 8) vals.push(v);
  }
  if (vals.length === 0) return null;
  const escaped = vals.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'g');
}

let _envValuesRe = null;
function getEnvValuesRe() {
  if (!_envValuesRe) _envValuesRe = buildEnvValuesPattern();
  return _envValuesRe;
}

function redact(text) {
  if (!text || typeof text !== 'string') return text || '';
  let result = text;
  // Mask known env values first
  const envRe = getEnvValuesRe();
  if (envRe) result = result.replace(envRe, '[REDACTED]');
  // Mask known secret patterns
  for (const { regex } of SECRET_PATTERNS) {
    result = result.replace(regex, (m) => {
      if (m.length <= 8) return m;
      return m.slice(0, 4) + '[REDACTED]' + m.slice(-4);
    });
  }
  return result;
}

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan:  '\x1b[36m', red:   '\x1b[31m', magenta: '\x1b[35m',
  bgRed: '\x1b[41m', bgYellow: '\x1b[43m', bgGreen: '\x1b[42m',
};
const c  = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (n = 64) => '─'.repeat(n);

// ── Destructive operation patterns (auto-force human_gate) ────────────────────

// human_gate pattern — covers variations, case, whitespace, symbols
const DESTRUCTIVE_RE = /\b(commit|push|deploy|リリース|本番|production|secret|iam|credentials|権限|delete|drop|truncate|削除|billing|課金|rollback|release)\b|(^|\s)rm(\s|$)/i;
const DESTRUCTIVE_BYPASS_RE = /c[o0]mm[i1]t|d[e3]pl[o0]y|pr[o0]ducti[o0]n|secr[e3]t|[d8][e3]l[e3]t[e3]/i;

function requiresHumanGate(task, extraText) {
  const text = task.title + ' ' + (task.description || '') + ' ' + (extraText || '');
  return task.humanGate === true
    || task.difficulty === 'high'
    || DESTRUCTIVE_RE.test(text)
    || DESTRUCTIVE_BYPASS_RE.test(text);
}

// ── Claude Code failure classification ───────────────────────────────────────

const CLAUDE_FAILURE = {
  AUTH:       'auth',          // 認証切れ → cheapFirstRun fallback
  RATE_LIMIT: 'rate_limit',    // 利用上限 → wait & fallback
  HUMAN_GATE: 'human_gate',    // 承認プロンプトで停止 → human_gate 必須
  TIMEOUT:    'timeout',       // タイムアウト → fallback
  GENERIC:    'generic',       // その他 → fallback
};

function classifyClaudeFailure(error, stderr, status, stdout, signal) {
  const msg = ((error?.message || '') + ' ' + (stderr || '') + ' ' + (stdout || '')).toLowerCase();

  // Timeout (spawnSync): signal=SIGTERM or error.code=ETIMEDOUT
  if (signal === 'SIGTERM' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOBUFS' || status === null)
    return { type: CLAUDE_FAILURE.TIMEOUT, fallback: 'cheapFirstRun' };

  if (/authentication|api.?key|401|unauthorized/.test(msg))
    return { type: CLAUDE_FAILURE.AUTH,       fallback: 'cheapFirstRun' };
  if (/rate.?limit|quota|429|too many|session.?limit/.test(msg))
    return { type: CLAUDE_FAILURE.RATE_LIMIT, fallback: 'cheapFirstRun' };
  if (/permission|approval|human.*gate|approve/.test(msg))
    return { type: CLAUDE_FAILURE.HUMAN_GATE, fallback: null };
  return { type: CLAUDE_FAILURE.GENERIC,      fallback: 'cheapFirstRun' };
}

// ── Restricted paths ──────────────────────────────────────────────────────────

const RESTRICTED_BASENAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  'credentials.json', 'service-account.json', 'service-account.key.json',
  '.gitignore', '.gitattributes',
]);
const RESTRICTED_DIRS = ['.git', 'node_modules', '.kosame', 'secrets', 'secret'];
const DESTRUCTIVE_FILE_RE = /(\/|^)(\.env|credentials\.json|service-account|secret|\.git)\b/;

function validateFilePath(filePath, repoRoot) {
  const resolved = path.resolve(repoRoot, filePath);
  if (!resolved.startsWith(path.resolve(repoRoot))) {
    return { ok: false, reason: `path traversal: ${filePath}` };
  }
  const rel = path.relative(repoRoot, resolved);
  const parts = rel.split(/[/\\]/);
  for (const p of parts) {
    if (RESTRICTED_DIRS.includes(p)) {
      return { ok: false, reason: `restricted directory: ${p}` };
    }
  }
  const base = path.basename(resolved);
  if (RESTRICTED_BASENAMES.has(base)) {
    return { ok: false, reason: `restricted file: ${base}` };
  }
  if (DESTRUCTIVE_FILE_RE.test(rel)) {
    return { ok: false, reason: `destructive path: ${rel}` };
  }
  return { ok: true, resolved };
}

// ── KOSAME Patch Format parser ────────────────────────────────────────────────

const PATCH_FILE_RE = /^\[FILE\]\s+(.+)$/m;
const PATCH_CODE_RE = /```(\w*)\n([\s\S]*?)```/;

function parsePatchOutput(output, repoRoot) {
  const files = [];
  const blocks = output.split(/(?=\[FILE\])/);
  for (const block of blocks) {
    const fileMatch = block.match(PATCH_FILE_RE);
    if (!fileMatch) continue;
    const rawPath = fileMatch[1].trim();
    const validation = validateFilePath(rawPath, repoRoot);
    const codeMatch = block.match(PATCH_CODE_RE);
    files.push({
      rawPath, validation,
      content: codeMatch ? codeMatch[2] : '',
      hasCodeBlock: !!codeMatch,
    });
  }
  // If no [FILE] blocks, try to detect code blocks as a single unnamed file
  if (files.length === 0) {
    const codeMatch = output.match(PATCH_CODE_RE);
    if (codeMatch) {
      files.push({
        rawPath: 'output.txt', validation: { ok: false, reason: 'no file path specified' },
        content: codeMatch[2], hasCodeBlock: true,
      });
    }
  }
  return files;
}

function writeFilesWithBackup(files, repoRoot, opts = {}) {
  const { dryRun = true, out = console.log } = opts;
  const backups = [];
  const written = [];
  const newFiles = [];

  for (const f of files) {
    if (!f.validation.ok) {
      out(`     ${c('yellow', '⚠  SKIP')} ${f.rawPath} — ${f.validation.reason}`);
      continue;
    }
    const targetPath = f.validation.resolved;
    const rel = path.relative(repoRoot, targetPath);

    // Backup existing file
    let backupPath = null;
    const existed = fs.existsSync(targetPath);
    if (existed) {
      backupPath = path.join(BACKUP_DIR, rel + '.bak');
      if (!dryRun) {
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(targetPath, backupPath);
      }
      backups.push({ rel, backupPath, targetPath });
      out(`     ${c('dim', 'backup:')} ${rel}`);
    } else {
      if (!dryRun) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    }

    // Write file
    if (!dryRun) {
      fs.writeFileSync(targetPath, f.content, 'utf-8');
    }
    written.push({ rel, targetPath, content: f.content, isNew: !existed });
    if (!existed) newFiles.push({ rel, targetPath });
    out(`     ${dryRun ? c('yellow', '[DRY-RUN]') : c('green', '✓')} ${rel} (${f.content.length}B)${existed ? '' : ' [NEW]'}`);
  }

  return { backups, written, newFiles };
}

function rollbackFiles(backups, newFiles, repoRoot) {
  let restored = 0;
  let deleted  = 0;
  let errors   = [];

  for (const b of backups) {
    try {
      if (b.backupPath && fs.existsSync(b.backupPath)) {
        fs.copyFileSync(b.backupPath, b.targetPath);
        fs.unlinkSync(b.backupPath);
        restored++;
      }
    } catch (e) {
      errors.push({ file: b.rel, action: 'restore', error: e.message });
    }
  }

  // Delete newly created files
  for (const nf of newFiles) {
    try {
      if (fs.existsSync(nf.targetPath)) {
        fs.unlinkSync(nf.targetPath);
        deleted++;
        // Clean up empty parent directories (safe: never delete .git/node_modules/.env)
        let dir = path.dirname(nf.targetPath);
        while (dir.startsWith(path.resolve(repoRoot))) {
          const entries = fs.readdirSync(dir);
          if (entries.length === 0 && path.basename(dir) !== '.git' && !path.basename(dir).startsWith('.env')) {
            fs.rmdirSync(dir);
            dir = path.dirname(dir);
          } else {
            break;
          }
        }
      }
    } catch (e) {
      errors.push({ file: nf.rel, action: 'delete', error: e.message });
    }
  }

  return { restored, deleted, errors };
}

function cleanupBackups(backups) {
  for (const b of backups) {
    try { if (b.backupPath && fs.existsSync(b.backupPath)) fs.unlinkSync(b.backupPath); } catch (e) { console.warn('backup cleanup failed:', e.message); }
  }
}

function syntaxCheckJs(targetPath) {
  try {
    execSync(`node --check "${targetPath}"`, { encoding: 'utf8', timeout: 10000, stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
}

function runVerifyInRepo(repoRoot) {
  try {
    const r = execSync('npm run verify 2>&1', { cwd: repoRoot, encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
    return { ok: true, output: r.trim() };
  } catch (e) {
    return { ok: false, output: e.stdout || '', error: e.stderr || e.message };
  }
}

// ── Task prompt builder ───────────────────────────────────────────────────────

function buildTaskPrompt(task, project) {
  const parts = [
    `## タスク: ${task.title}`,
    task.description ? task.description : '',
    task.dependencies?.length > 0 ? `依存タスク: ${task.dependencies.join(', ')}` : '',
    project ? `プロジェクト: ${project}` : '',
    `難易度: ${task.difficulty}`,
    '',
    '上記タスクを実装してください。',
    '',
    '【出力形式】',
    '変更するファイルごとに以下の形式で出力してください。',
    '[FILE] ファイルパス',
    '```',
    'コード内容',
    '```',
  ].filter(Boolean);
  return parts.join('\n');
}

// ── Claude Code CLI execution ─────────────────────────────────────────────────

async function executeClaude(task, opts = {}) {
  const { dryRun = true, project = null, out = console.log, repoRoot } = opts;
  const startMs = Date.now();
  const timeout = CLAUDE_TIMEOUT_MS;

  if (dryRun) {
    const mockPath = `src/${task.title.replace(/\s+/g, '_').toLowerCase().slice(0, 20)}.js`;
    out(`     ${c('yellow', '[DRY-RUN]')} Claude Code 模擬実装`);
    return {
      success: true, dryRun: true,
      output:  `[FILE] ${mockPath}\n\`\`\`js\n// ${task.title}\nfunction ${task.title.replace(/\s+/g, '_')}() {\n  return null;\n}\n\`\`\``,
      model:    'claude-sonnet-4-6',
      provider: 'anthropic',
      durationMs: 400 + Math.round(Math.random() * 400),
    };
  }

  const prompt = buildTaskPrompt(task, project);

  // Launch Claude with detached process group so we can kill just this group
  const child = spawnSync(
    'claude',
    ['--print', prompt],
    {
      encoding: 'utf8',
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      // Use process group so we can kill just this subtree
      windowsHide: true,
    }
  );
  const durationMs = Date.now() - startMs;
  const pid = child.pid;

  // Kill only this process tree (not other Claude instances)
  const terminationErrors = [];
  if (child.error || child.status !== 0) {
    if (pid) {
      try {
        // Kill the process group (negative PID = PGID on Unix)
        process.kill(-pid, 'SIGTERM');
      } catch (killErr) {
        if (killErr.code !== 'ESRCH') { // ESRCH = already dead, fine
          terminationErrors.push(killErr.message);
        }
      }
    }
  }

  const signal  = child.signal;
  const status  = child.status;
  const resultError = child.error;
  const rawStderr  = child.stderr || '';
  const rawStdout  = child.stdout || '';

  // Redact secrets from all outputs before any logging or storage
  const stderr = redact(rawStderr);
  const stdout = redact(rawStdout);

  if (resultError || (status !== 0 && status !== null)) {
    const failure = classifyClaudeFailure(resultError, stderr, status, stdout, signal);
    const errMsg  = stderr || stdout || resultError?.message || '';
    const redactedErr = redact(errMsg);
    out(`     ${c('red', '✗')} Claude Code 失敗 [${failure.type}]: ${redactedErr.slice(0, 80)}`);

    if (terminationErrors.length > 0) {
      out(`     ${c('red', '✗ CHILD_TERMINATION_FAILED')} ${terminationErrors[0].slice(0, 60)}`);
      failure.terminationFailed = true;
    }

    return { success: false, dryRun: false, failure, output: stdout, durationMs };
  }

  return {
    success: true, dryRun: false,
    output: stdout,  // already redacted
    files: parsePatchOutput(stdout, repoRoot || process.cwd()),
    model:    'claude-sonnet-4-6',
    provider: 'anthropic',
    durationMs,
  };
}

// ── Worker-based execution (Smart Router) ────────────────────────────────────

async function executeWithWorker(task, workerName, opts = {}) {
  const { dryRun = true, project = null, out = console.log, repoRoot, config } = opts;
  const startMs = Date.now();

  const { callModel, readConfig, resolveWorker } = require('./kosame-cheap-first-runtime');
  const security = require('./kosame-worker-security-policy');

  const cfg    = config || readConfig();
  const worker = resolveWorker(workerName, cfg);

  // v110.51-v110.53: セキュリティ/IPポリシーによる詳細チェック（実行直前）
  const secCheck = security.validateWorkerAssignment(workerName, task, { specText: opts.specText || '' });
  if (secCheck.humanGateRequired) {
    out(`     ${c('bgRed', c('bold', ' ! SECURITY_VIOLATION '))} ${workerName} は ${secCheck.violations[0]} へのアクセスが制限されています`);
    return {
      success: false,
      dryRun,
      humanGate: true,
      failure: { type: 'human_gate', reason: secCheck.reason },
      output: `[SECURITY_BLOCKED] ${secCheck.reason}`,
      durationMs: 0,
    };
  }

  const sanitizedTask = security.sanitizeTaskForWorker(task);

  if (dryRun) {
    const mockPath = `src/${sanitizedTask.title.replace(/\s+/g, '_').toLowerCase().slice(0, 20)}.js`;
    out(`     ${c('yellow', '[DRY-RUN]')} ${workerName} (${worker.modelId}) 模擬実装`);
    return {
      success: true, dryRun: true,
      output:  `[FILE] ${mockPath}\n\`\`\`js\n// ${sanitizedTask.title}\nfunction ${sanitizedTask.title.replace(/\s+/g, '_')}() {\n  return null;\n}\n\`\`\``,
      model:    worker.modelId,
      provider: worker.provider,
      durationMs: 400 + Math.round(Math.random() * 400),
    };
  }

  const prompt = buildTaskPrompt(sanitizedTask, null);
  try {
    const result = await callModel(workerName, prompt, cfg, { maxTokens: 4096 });
    const raw    = result.response || '';
    return {
      success:    true,
      dryRun:     false,
      output:     redact(raw),
      files:      parsePatchOutput(redact(raw), repoRoot || process.cwd()),
      model:      worker.modelId,
      provider:   worker.provider,
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    out(`     ${c('red', '✗')} ${workerName} 失敗: ${err.message.slice(0, 80)}`);
    return {
      success:    false,
      dryRun:     false,
      failure:    { type: 'generic', fallback: 'cheapFirstRun' },
      output:     '',
      model:      worker.modelId,
      provider:   worker.provider,
      durationMs: Date.now() - startMs,
    };
  }
}

// ── Auto verify ───────────────────────────────────────────────────────────────

function autoVerify(task, output, opts = {}) {
  const { checkQuality } = require('./kosame-cheap-first-runtime');
  const taskType = task.difficulty === 'high' ? 'code' : 'implement';

  // 基本品質チェック（runtime共通）
  const quality = checkQuality(output, taskType);
  if (!quality.ok) {
    return { pass: false, score: 30, reason: `品質不足 [${quality.reason}]` };
  }

  // 明らかなエラーパターン
  if (/^(Error|エラー|Failed|失敗|Exception)/im.test(output.trim())) {
    return { pass: false, score: 20, reason: 'エラーレスポンス検出' };
  }

  // コードタスクの長さ確認
  if (['code', 'implement'].includes(taskType) && output.length < 100) {
    return { pass: false, score: 40, reason: 'コード実装が短すぎる' };
  }

  const score = Math.min(100, 60 + Math.round(output.length / 100));
  return { pass: true, score, reason: 'OK' };
}

// ── Fix with project-guard-aware model ───────────────────────────────────────

async function fixWithPermittedModel(task, output, failReason, opts = {}) {
  const { dryRun = true, project = null, config, out = console.log } = opts;
  const { callModel, readConfig } = require('./kosame-cheap-first-runtime');
  const { checkDeepSeekGuard }    = require('./kosame-deepseek-project-guard');

  const cfg = config || readConfig();

  const fixPrompt = [
    `以下のタスクの実装に問題があります。修正してください。`,
    `タスク: ${task.title}`,
    `問題: ${failReason}`,
    `現在の実装:`,
    output.slice(0, 1200),
  ].join('\n');

  // DeepSeek プロジェクトガード
  const guard = checkDeepSeekGuard({ project, provider: 'deepseek', prompt: fixPrompt, config: cfg });
  const worker = guard.blocked ? guard.fallback : 'cheap_code_worker';
  if (guard.blocked) {
    out(`     ${c('yellow', '↷')} DeepSeek ブロック [${guard.reason}] → ${worker} で修正`);
  } else {
    out(`     ${c('cyan', '↷')} ${worker} (DeepSeek) で修正中...`);
  }

  if (dryRun) {
    return {
      dryRun: true, worker,
      output: `[DRY-RUN] ${worker} 修正応答\n\nfunction fixed() {\n  // 修正済み実装\n}`,
    };
  }

  const r = await callModel(worker, fixPrompt, cfg, { maxTokens: 2048 });
  return { dryRun: false, worker, output: r.response };
}

// ── Learning log + GDrive recording ──────────────────────────────────────────

function recordTaskResult(task, result, opts = {}) {
  const { dryRun = true } = opts;
  try {
    const { appendLog } = require('./kosame-learning-log');
    appendLog({
      taskInput:  task.title.slice(0, 120),
      taskType:   'implement',
      difficulty: task.difficulty,
      model:      result.model    || 'claude-sonnet-4-6',
      provider:   result.provider || 'anthropic',
      costUsd:    result.costUsd  ?? null,
      durationMs: result.durationMs ?? null,
      success:    result.success  ?? false,
      escalated:  result.fixed    ?? false,
      dryRun,
      meta: { feature: TOOL_META.feature, taskId: task.id, autoDev: true, verifyPass: result.verifyPass },
    }, { dryRun });
  } catch (_) {}
}

async function recordToGDrive(runResult, opts = {}) {
  const { dryRun = true } = opts;
  const writer = (() => { try { return require('./kosame-gdrive-writer'); } catch { return null; } })();
  if (!writer) return { ok: false, reason: 'kosame-gdrive-writer not found' };
  const content = [
    `AutoDev v${TOOL_META.version}`,
    `tasks=${runResult.taskCount}`,
    `pass=${runResult.passCount}`,
    `fixed=${runResult.fixedCount}`,
    `failed=${runResult.failedCount}`,
  ].join(' | ');
  let sheetRes = null, docRes = null;
  try { sheetRes = await writer.writeSheetsRows({ dryRun, tail: runResult.taskCount + 1 }); } catch (e) { sheetRes = { ok: false, error: e.message }; }
  try { docRes   = await writer.writeDocsEntry({ dryRun, version: TOOL_META.version, content }); } catch (e) { docRes   = { ok: false, error: e.message }; }
  return { ok: true, dryRun, sheetRes, docRes };
}

// ── GPT arbitration + Claude quality review (final) ──────────────────────────

async function reviewAllResults(taskResults, opts = {}) {
  const { dryRun = true, config, out = console.log } = opts;
  const { callModel, readConfig } = require('./kosame-cheap-first-runtime');
  const cfg = config || readConfig();
  const hasGptKey    = !!(cfg.openaiKeyPresent || cfg.openaiApiKey || process.env.OPENAI_API_KEY);
  const hasClaudeKey = !!(process.env.ANTHROPIC_API_KEY);

  const failedCount = taskResults.filter(r => !r.verifyPass && !r.skipped).length;

  const summary = taskResults.map((r, i) =>
    `タスク${i + 1}: ${r.title.slice(0, 60)} — ${r.verifyPass ? '✓ PASS' : '✗ FAIL'}${r.fixed ? ' (修正済)' : ''}${(r.writtenFiles||[]).length ? ' [' + r.writtenFiles.length + ' files]' : ''}`
  ).join('\n');

  out(`\n  ${c('cyan', '◆ Final Review')} ${c('bold', 'GPT 裁定 + Claude 品質チェック')}`);

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN]')} GPT + Claude 模擬レビュー`);
    if (failedCount > 0) {
      out(`  ${c('red', '⚠ FAILタスクあり — 模擬レビューでも否決扱い')}`);
    }
    return {
      gpt:     { score: 82, verdict: 'OK', summary: '[DRY-RUN] 全タスク品質水準クリア', status: 'SKIPPED_DRY_RUN' },
      claude:  { score: 85, ready: true, assessment: '[DRY-RUN] 実装品質は高く納品可能水準', status: 'SKIPPED_DRY_RUN' },
      avgScore: 83.5,
      approved: failedCount === 0,
      dryRun:   true,
      deliveryReady: failedCount === 0,
    };
  }

  const gptPrompt = [
    `以下の自動開発セッションの全タスク実装結果を裁定してください。`,
    `品質スコア(0-100)と総合所見を JSON で返してください。`,
    `フォーマット: {"score": <number>, "verdict": "<OK|NG>", "summary": "<所見>"}`,
    ``, `【実装結果サマリー】`, summary,
  ].join('\n');

  const claudePrompt = [
    `以下の自動開発セッションの最終品質チェックをしてください。`,
    `品質スコア(0-100)と納品可否を JSON で返してください。`,
    `フォーマット: {"score": <number>, "ready": <true|false>, "assessment": "<評価>"}`,
    ``, `【実装結果サマリー】`, summary,
  ].join('\n');

  let gpt    = { score: 50, verdict: 'SKIPPED', summary: 'OPENAI_API_KEY not set', status: 'SKIPPED_MISSING_CREDENTIALS' };
  let claude = { score: 50, ready: false, assessment: 'ANTHROPIC_API_KEY not set', status: 'SKIPPED_MISSING_CREDENTIALS' };

  if (hasGptKey) {
    out(`  ${c('dim', 'GPT 裁定 実呼び出し中...')}`);
    const gptRaw = await callModel('gpt_upper', gptPrompt, cfg, { maxTokens: 512 }).catch(e => ({ response: e.message }));
    gpt = { score: 70, verdict: 'OK', summary: gptRaw.response, status: 'EXECUTED' };
    try { const m = gptRaw.response.match(/\{[\s\S]*\}/); if (m) gpt = { ...gpt, ...JSON.parse(m[0]), status: 'EXECUTED' }; } catch (_) {}
  } else {
    out(`  ${c('yellow', '⚠  OPENAI_API_KEY 未設定 — GPT 裁定スキップ')}`);
  }

  if (hasClaudeKey) {
    out(`  ${c('dim', 'Claude 品質チェック 実呼び出し中...')}`);
    const claudeRaw = await callModel('claude_sonnet', claudePrompt, cfg, { maxTokens: 512 }).catch(e => ({ response: e.message }));
    claude = { score: 70, ready: true, assessment: claudeRaw.response, status: 'EXECUTED' };
    try { const m = claudeRaw.response.match(/\{[\s\S]*\}/); if (m) claude = { ...claude, ...JSON.parse(m[0]), status: 'EXECUTED' }; } catch (_) {}
  } else {
    out(`  ${c('yellow', '⚠  ANTHROPIC_API_KEY 未設定 — Claude 品質チェックスキップ')}`);
  }

  const avgScore = (gpt.score + claude.score) / 2;
  const gptOk    = gpt.status === 'EXECUTED' ? gpt.verdict !== 'NG' : true;
  const claudeOk = claude.status === 'EXECUTED' ? claude.ready !== false : true;
  const reviewApproved = avgScore >= 75 && gptOk && claudeOk;
  const approved = reviewApproved && failedCount === 0;
  const deliveryReady = hasGptKey && hasClaudeKey && approved;

  if (failedCount > 0) {
    out(`  ${c('red', `⚠ ${failedCount}件のFAILタスクあり — 承認取消`)}`);
  }
  out(`  GPT スコア: ${gpt.score}/100 [${gpt.status}]  Claude スコア: ${claude.score}/100 [${claude.status}]  平均: ${avgScore.toFixed(1)}`);
  out(`  判定: ${approved ? c('bgGreen', c('bold', ' ✓ 承認 ')) : c('bgRed', c('bold', ' ✗ 否決 '))}${failedCount > 0 ? ' ' + c('red', '(要確認)') : ''}`);
  out(`  delivery_ready: ${deliveryReady ? c('green', 'true') : c('yellow', 'false')}${!deliveryReady ? ' (両APIキー設定必要)' : ''}`);

  return { gpt, claude, avgScore, approved, deliveryReady, dryRun: false };
}

// ── Discord report ────────────────────────────────────────────────────────────

async function sendDiscordReport(summary, opts = {}) {
  const { dryRun = true, out = console.log } = opts;
  const { notify } = (() => { try { return require('./real-time-progress-notifier'); } catch { return { notify: null }; } })();
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  const lines = [
    `⬡ KOSAME Auto Dev v${TOOL_META.version} — 完了報告`,
    `タスク: ${summary.taskCount}件 / PASS: ${summary.passCount} / 修正: ${summary.fixedCount} / FAIL: ${summary.failedCount}`,
    `最終スコア: ${summary.reviewScore?.toFixed(1) ?? '-'}/100  判定: ${summary.approved ? '✓ 承認' : '✗ 否決'}`,
    summary.approved
      ? `じゅんやさん、全タスクの実装と品質チェックが完了しました。commit 承認をお願いします。`
      : `じゅんやさん、品質基準に満たないタスクがあります。確認をお願いします。`,
  ];
  const message = lines.join('\n');
  out(`\n  ${c('bold', '📬 じゅんやさんへの報告')}`);
  out(`  ${message.replace(/\n/g, '\n  ')}`);

  if (!notify || !webhookUrl) {
    if (!dryRun && !webhookUrl) out(`  ${c('yellow', '⚠  DISCORD_WEBHOOK_URL 未設定 — Discord 通知スキップ')}`);
    return { ok: false, reason: !notify ? 'notifier unavailable' : 'no webhook url', dryRun };
  }

  const r = await notify('done', { message }, { discord: { url: webhookUrl } }, { dryRun, silent: true });
  out(`  Discord: ${r.results?.[0]?.sent ? c('green', '✓ 送信済み') : c('dim', '[DRY-RUN]')}`);
  return { ok: true, dryRun, sent: r.results?.[0]?.sent ?? false };
}

// ── Human gate ────────────────────────────────────────────────────────────────

async function waitForHumanGate(task, opts = {}) {
  const { dryRun = true, out = console.log } = opts;

  out(`\n  ${c('bgRed', c('bold', '  ⛔ HUMAN GATE  '))}`);
  out(`  タスク: ${c('bold', task.title.slice(0, 60))}`);
  out(`  難易度: ${c('red', task.difficulty)}  ID: ${task.id}`);
  if (DESTRUCTIVE_RE.test(task.title + ' ' + (task.description || ''))) {
    out(`  ${c('yellow', '⚠  破壊的操作パターン検出 — 自動実行禁止')}`);
  }

  if (dryRun) {
    out(`  ${c('yellow', '[DRY-RUN] 承認をスキップ')}`);
    return true;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(`  ${c('bold', 'このタスクを承認しますか？')} (yes/no) > `, answer => {
      rl.close();
      const ok = /^y(es)?$/i.test(answer.trim());
      out(ok ? `  ${c('green', '✓ 承認')}` : `  ${c('red', '✗ 却下')}`);
      resolve(ok);
    });
  });
}

// ── Single task pipeline ──────────────────────────────────────────────────────

async function runTask(task, opts = {}) {
  const { dryRun = true, project = null, config, out = console.log, repoRoot, routeMode = 'smart' } = opts;
  const startMs = Date.now();
  let backups  = [];
  let newFiles = [];

  out(`\n    ${c('gray', task.id)}  ${c(task.difficulty === 'high' ? 'red' : task.difficulty === 'medium' ? 'yellow' : 'green', task.difficulty.padEnd(7))}  ${c('bold', task.title.slice(0, 60))}`);

  // 1. Human gate (before execution)
  if (requiresHumanGate(task)) {
try { activity.emit('human_gate', { taskId: task.id, project: project || '', dryRun, stage: 'human_gate', progressPercent: 50, message: (task.title || '').slice(0, 60) }); } catch (_) {}
    const approved = await waitForHumanGate(task, { dryRun, out });
    if (!approved) {
      return { taskId: task.id, title: task.title, difficulty: task.difficulty, success: false, skipped: true, reason: '却下', durationMs: Date.now() - startMs, verifyPass: false };
    }
  }

  // 2. Smart Router → AI割り当て → 実行
  const { assignWorker: _routerAssign, classifyTask: _classifyTask } = require('./kosame-smart-task-router');
  const _classified  = _classifyTask(task, { project });
  const _assignment  = await _routerAssign(_classified, { mode: routeMode, dryRun, config });
  const _workerName  = _assignment.primary;
  const _useClaudeCLI = _workerName === 'claude_code';

  out(`     ${c('cyan', '→')} ${c('bold', _workerName)}  ${c('dim', _assignment.reason)}`);
  if (_assignment.needsGptArbiter && _assignment.arbiterReasons.length > 0) {
    out(`     ${c('dim', '裁定理由:')} ${_assignment.arbiterReasons.join(' / ')}`);
  }

  const _agentProvider = _workerName.startsWith('claude') ? 'anthropic' : (_workerName.includes('gpt') ? 'openai' : 'gemini');
try { activity.emit('agent_started', { taskId: task.id, project: project || '', dryRun, agent: _workerName, provider: _agentProvider, model: _workerName, stage: 'implementing', progressPercent: 10, mission: (task.title || '').slice(0, 60) }); } catch (_) {}

  let claudeResult;
  if (_useClaudeCLI) {
    out(`     ${c('dim', 'Claude Code CLI へ投げ中...')}`);
    claudeResult = await executeClaude(task, { dryRun, project, out, repoRoot });
  } else {
    claudeResult = await executeWithWorker(task, _workerName, { dryRun, project, out, repoRoot, config });
    if (!claudeResult.success && _assignment.fallback && _assignment.fallback !== _workerName) {
      out(`     ${c('yellow', '↷')} ${_workerName} 失敗 → fallback: ${_assignment.fallback}`);
      claudeResult = await executeWithWorker(task, _assignment.fallback, { dryRun, project, out, repoRoot, config });
    }
  }

  // Claude Code 失敗 → fallback (max 1回)
  let implOutput   = redact(claudeResult.output || '');
  let implFiles    = claudeResult.files || [];
  let implModel    = claudeResult.model   ?? 'claude-sonnet-4-6';
  let implProvider = claudeResult.provider ?? 'anthropic';
  let usedFallback = false;

  if (!claudeResult.success) {
    const failure = claudeResult.failure;
    if (failure?.type === CLAUDE_FAILURE.HUMAN_GATE) {
      out(`     ${c('red', '⛔ Claude Code 承認プロンプト停止 → human_gate 必須')}`);
      const approved = await waitForHumanGate(task, { dryRun, out });
      if (!approved) {
        return { taskId: task.id, title: task.title, difficulty: task.difficulty, success: false, skipped: true, reason: 'Claude Code HUMAN_GATE', durationMs: Date.now() - startMs, verifyPass: false };
      }
    }
    // Fallback only once
    if (failure?.fallback === 'cheapFirstRun' && !usedFallback) {
      out(`     ${c('yellow', '↷')} Claude Code ${failure?.type ?? 'error'} → cheapFirstRun で代替実行`);
try { activity.emit('fallback_started', { taskId: task.id, project: project || '', dryRun, agent: implModel || '', stage: 'fallback', progressPercent: 30 }); } catch (_) {}
      const { cheapFirstRun, readConfig } = require('./kosame-cheap-first-runtime');
      const cfg = config || readConfig();
      const security = require('./kosame-worker-security-policy');
      const sanitizedTask = security.sanitizeTaskForWorker(task);
      const cf = await cheapFirstRun(buildTaskPrompt(sanitizedTask, null), task.difficulty, {
        dryRun, silent: true, skipHumanGate: false, // ← human_gate bypass禁止
        taskInput: sanitizedTask.title.slice(0, 120), taskType: 'implement', project,
      });
      implOutput   = redact(cf.response ?? '');
      implFiles    = parsePatchOutput(implOutput, repoRoot || process.cwd());
      implModel    = cf.usedModel  ?? 'unknown';
      implProvider = require('./kosame-cheap-first-runtime').PRICE_TABLE[implModel]?.provider ?? 'unknown';
      usedFallback = true;

      // Re-check human_gate after fallback output
      const fbText = (implOutput || '').slice(0, 200);
      if (requiresHumanGate(task, fbText)) {
        out(`     ${c('yellow', '⚠  fallback出力に破壊的操作パターン → human_gate再判定')}`);
        const approved = await waitForHumanGate(task, { dryRun, out, label: 'fallback' });
        if (!approved) {
          return { taskId: task.id, title: task.title, difficulty: task.difficulty, success: false, skipped: true, reason: 'fallback HUMAN_GATE', durationMs: Date.now() - startMs, verifyPass: false };
        }
      }

      if (!cf.ok) {
        return { taskId: task.id, title: task.title, difficulty: task.difficulty, success: false, skipped: false, reason: cf.error ?? 'cheapFirstRun failed', durationMs: Date.now() - startMs, verifyPass: false, model: implModel, provider: implProvider };
      }
    }
  }

  // 3. File preview
  if (implFiles.length > 0) {
    out(`     ${c('dim', '変更予定ファイル:')}`);
    for (const f of implFiles) {
      const st = f.validation.ok ? c('green', '✓') : c('yellow', '⚠');
      out(`       ${st} ${f.rawPath} (${f.content.length}B) ${f.validation.ok ? '' : c('dim', '[' + f.validation.reason + ']')}`);
    }
  }

  // 4. Auto verify
  const verify1 = autoVerify(task, implOutput, {});
  out(`     verify: ${verify1.pass ? c('green', `✓ PASS (${verify1.score})`) : c('red', `✗ FAIL (${verify1.score}) [${verify1.reason}]`)}`);
try { activity.emit(verify1.pass ? 'verify_passed' : 'verify_failed', { taskId: task.id, project: project || '', dryRun, stage: 'verifying', status: verify1.pass ? 'PASS' : 'FAIL', progressPercent: verify1.pass ? 70 : 60, message: verify1.reason || '' }); } catch (_) {}

  let verifyPass   = verify1.pass;
  let finalOutput  = implOutput;
  let finalFiles   = implFiles;
  let fixedModel   = null;
  let fixedProvider = null;
  let fixed        = false;

  if (!verify1.pass) {
    const fixResult = await fixWithPermittedModel(task, implOutput, verify1.reason, {
      dryRun, project, config, out,
    });
    fixedModel    = fixResult.worker;
    fixedProvider = fixResult.worker === 'cheap_code_worker' ? 'deepseek' : 'openai';
    finalOutput   = redact(fixResult.output || '');
    finalFiles    = parsePatchOutput(finalOutput, repoRoot || process.cwd());

    const verify2 = autoVerify(task, finalOutput, {});
    verifyPass = verify2.pass;
    fixed      = verify2.pass;
    out(`     re-verify: ${verify2.pass ? c('green', `✓ PASS (${verify2.score})`) : c('red', `✗ FAIL (${verify2.score})`)}`);
  }

  // 5. Write files to repo
  let writtenFiles = [];
  let writeErrors  = [];
  let fileVerifyOk = true;

  if (verifyPass && finalFiles.length > 0) {
    const validFiles = finalFiles.filter(f => f.validation.ok);
    if (validFiles.length > 0) {
      const wf = writeFilesWithBackup(validFiles, repoRoot || process.cwd(), { dryRun, out });
      backups  = wf.backups;
      newFiles = wf.newFiles;
      writtenFiles = wf.written;

      if (!dryRun && writtenFiles.length > 0) {
        for (const w of writtenFiles) {
          if (w.rel.endsWith('.js')) {
            const sc = syntaxCheckJs(w.targetPath);
            if (!sc.ok) {
              out(`     ${c('red', '✗')} syntax error: ${w.rel} — ${sc.error.slice(0, 80)}`);
              fileVerifyOk = false;
              writeErrors.push({ file: w.rel, error: sc.error });
            }
          }
        }

        if (fileVerifyOk && repoRoot) {
          const vr = runVerifyInRepo(repoRoot);
          if (!vr.ok) {
            out(`     ${c('red', '✗')} repo verify FAILED`);
            fileVerifyOk = false;
            writeErrors.push({ file: 'repo', error: vr.error });
          } else {
            out(`     ${c('green', '✓')} repo verify PASS`);
          }
        }
      }
    }
  }

  // 6. Rollback on failure (covers verify fail + syntax fail + new file cleanup)
  const needsRollback = (!fileVerifyOk || !verifyPass) && !dryRun && (backups.length > 0 || newFiles.length > 0);
  if (needsRollback) {
    const rb = rollbackFiles(backups, newFiles, repoRoot || process.cwd());
    if (rb.errors.length > 0) {
      out(`     ${c('red', '✗ ROLLBACK_FAILED')} restored=${rb.restored} deleted=${rb.deleted} errors=${rb.errors.map(e=>e.file).join(',')}`);
      return {
        taskId: task.id, title: task.title, difficulty: task.difficulty,
        success: false, skipped: false, reason: 'ROLLBACK_FAILED',
        rollbackErrors: rb.errors, verifyPass: false,
        durationMs: Date.now() - startMs, timestamp: new Date().toISOString(),
      };
    }
    out(`     ${c('red', `↩ rollback: ${rb.restored} restored, ${rb.deleted} deleted`)}`);
    verifyPass = false;
  } else if (fileVerifyOk && verifyPass && !dryRun && backups.length > 0) {
    cleanupBackups(backups);
  }

  // 7. Record
  const taskResult = {
    taskId:     task.id,
    title:      task.title,
    difficulty: task.difficulty,
    model:      fixed ? fixedModel    : implModel,
    provider:   fixed ? fixedProvider : implProvider,
    success:    fileVerifyOk && verifyPass,
    skipped:    false,
    verifyPass,
    fixed,
    usedFallback,
    output:     finalOutput,
    writtenFiles: writtenFiles.map(w => w.rel),
    writeErrors,
    costUsd:    claudeResult.costUsd ?? null,
    durationMs: Date.now() - startMs,
    timestamp:  new Date().toISOString(),
  };

  if (verifyPass) {
    recordTaskResult(task, taskResult, { dryRun });
    out(`     ${c('dim', '記録済 → learning-log / GDrive')}`);
try { activity.emit(taskResult.verifyPass ? 'task_completed' : 'task_failed', { taskId: task.id, project: project || '', dryRun, stage: 'done', status: taskResult.verifyPass ? 'PASS' : 'FAIL', agent: taskResult.model || '', currentFile: (taskResult.writtenFiles || []).join(','), message: taskResult.verifyPass ? '完了' : (taskResult.reason || 'FAIL'), progressPercent: taskResult.verifyPass ? 100 : 0, elapsedMs: taskResult.durationMs }); } catch (_) {}
  }

  return taskResult;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

async function runAutoDev(specText, opts = {}) {
  const {
    dryRun    = true,
    silent    = false,
    project   = null,
    repoRoot  = process.env.AUTO_DEV_REPO || process.cwd(),
    jsonMode  = false,
    maxTasks  = 50,
    routeMode = 'smart',
  } = opts;

  const out = (silent || jsonMode)
    ? (...a) => process.stderr.write(a.join(' ') + '\n')
    : console.log;

  const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  out(`\n${c('bold', c('blue', '⬡ KOSAME Auto Dev'))}  ${dryLabel}  v${TOOL_META.version}`);
  out(`  repo: ${c('cyan', repoRoot)}  project: ${project ?? '(未指定)'}  mode: ${c('cyan', routeMode)}  maxTasks: ${maxTasks}  timeout: ${CLAUDE_TIMEOUT_MS}ms`);
  out('  ' + hr());

  // Step 1: spec-analyzer でタスク分解
  out(`\n  ${c('bold', '📋 設計書解析中...')}`);
  const { analyzeSpec } = require('./kosame-spec-analyzer');
  const { readConfig }  = require('./kosame-cheap-first-runtime');
  const config = readConfig();

  const analysis = analyzeSpec(specText, { dryRun, maxTasks });
  const leafTasks = analysis.tasks.filter(t => t.isLeaf !== false);
  out(`  ${c('green', '✓')} ${leafTasks.length} タスク (${analysis.taskCount}候補中) / ${analysis.summary.executionPhases} フェーズ`);
  const diffCounts = { light: 0, medium: 0, high: 0 };
  let humanGateCount = 0;
  for (const t of leafTasks) {
    diffCounts[t.difficulty] = (diffCounts[t.difficulty] || 0) + 1;
    if (t.humanGate) humanGateCount++;
  }
  const diffParts = Object.entries(diffCounts).filter(([, n]) => n > 0)
    .map(([d, n]) => `${c(d === 'high' ? 'red' : d === 'medium' ? 'yellow' : 'green', d)}:${n}`).join('  ');
  if (diffParts) out(`  難易度: ${diffParts}`);
  if (humanGateCount > 0) out(`  ${c('red', `⚠  HUMAN GATE: ${humanGateCount} タスク`)}`);

  // Step 2: フェーズ別タスク実行
  out(`\n  ${c('bold', '🚀 実行開始')}`);
  const allResults = [];
  const maxOrder   = analysis.summary.executionPhases;

  for (let order = 1; order <= maxOrder; order++) {
    const batch = leafTasks.filter(t => t.executionOrder === order);
    if (batch.length === 0) continue;
    out(`\n  ${c('magenta', `── Phase ${order}`)} (${batch.length} タスク)`);

    for (const task of batch) {
      const result = await runTask(task, { dryRun, project, config, out, repoRoot, routeMode });
      allResults.push(result);
    }
  }

  // Step 3: 集計
  const passCount   = allResults.filter(r => r.verifyPass && !r.skipped).length;
  const fixedCount  = allResults.filter(r => r.fixed).length;
  const failedCount = allResults.filter(r => !r.verifyPass && !r.skipped).length;
  const skippedCount = allResults.filter(r => r.skipped).length;

  out(`\n  ${c('bold', '📊 集計')}`);
  out(`  PASS: ${c('green', String(passCount))}  修正後PASS: ${c('yellow', String(fixedCount))}  FAIL: ${c('red', String(failedCount))}  スキップ: ${skippedCount}`);

  // Step 4: GPT裁定 + Claude品質チェック
  const review = await reviewAllResults(allResults, { dryRun, config, out });

  // Step 5: GDrive 全体記録
  const runSummary = {
    taskCount: allResults.length,
    passCount, fixedCount, failedCount, skippedCount,
    reviewScore: review.avgScore,
    approved: review.approved,
  };
  const gdrive = await recordToGDrive(runSummary, { dryRun });

  // Step 6: Discord 報告
  await sendDiscordReport(runSummary, { dryRun, out });

  const runResult = {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    project,
    specLength: specText.length,
    taskCount:  allResults.length,
    passCount, fixedCount, failedCount, skippedCount,
    review,
    gdrive,
    tasks: allResults,
    realProductActionsExecuted: !dryRun,
  };

  return runResult;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const get = (name) => { const p = `--${name}=`; const a = argv.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  const has = (name) => argv.includes(`--${name}`);
  return {
    spec:      get('spec')    || null,
    file:      get('file')    || null,
    project:   get('project') || null,
    repo:      get('repo')    || process.env.AUTO_DEV_REPO || process.cwd(),
    maxTasks:  parseInt(get('max-tasks') || '50', 10),
    routeMode: get('mode') || (has('simple') ? 'simple' : has('council') ? 'council' : 'smart'),
    dryRun:    !has('write'),
    silent:    has('silent'),
    json:      has('json'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let specText = args.spec;
  if (!specText && args.file) {
    try { specText = fs.readFileSync(path.resolve(args.file), 'utf8'); } catch (e) {
      console.error(c('red', `ERROR: ファイル読み込み失敗 — ${e.message}`));
      process.exit(1);
    }
  }

  if (!specText) {
    console.log(`
${c('bold', 'Usage:')}
  npm run auto:dev -- --spec="設計書テキスト"
  npm run auto:dev -- --file=./spec.md
  npm run auto:dev -- --spec="..." --write          # 実際のAPI呼び出し
  npm run auto:dev -- --spec="..." --project=anesty-board
  npm run auto:dev -- --spec="..." --json

Flags:
  --spec=<str>      設計書テキスト（必須 or --file）
  --file=<path>     設計書ファイルパス
  --project=<str>   プロジェクト識別子 (DeepSeekガード用)
  --max-tasks=<n>   最大タスク数 (default: 50)
  --write           dryRun 無効化（実際の API 呼び出し）
  --silent          コンソール出力抑制
  --json            JSON 出力
`);
    return;
  }

  const result = await runAutoDev(specText, {
    dryRun:    args.dryRun,
    silent:    args.silent || args.json,
    project:   args.project,
    repoRoot:  args.repo,
    jsonMode:  args.json,
    maxTasks:  args.maxTasks,
    routeMode: args.routeMode,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!args.silent) {
    console.log('\n  ' + hr());
    if (result.review.approved) {
      console.log(`  ${c('bgGreen', c('bold', '  ✓ 全タスク完了・承認  '))}  スコア: ${result.review.avgScore?.toFixed(1)}/100`);
    } else {
      console.log(`  ${c('bgRed', c('bold', '  要確認  '))}  スコア: ${result.review.avgScore?.toFixed(1)}/100`);
    }
    console.log('');
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
  runAutoDev,
  runTask,
  executeClaude,
  executeWithWorker,
  autoVerify,
  fixWithPermittedModel,
  reviewAllResults,
  sendDiscordReport,
  classifyClaudeFailure,
  validateFilePath,
  parsePatchOutput,
  writeFilesWithBackup,
  rollbackFiles,
  requiresHumanGate,
  redact,
};
