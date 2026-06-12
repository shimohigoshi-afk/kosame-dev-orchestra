#!/usr/bin/env node
'use strict';

/**
 * KOSAME Parallel Agent Merge Guard v110.67.0
 *
 * GPT / Claude / Gemini / Grok / DeepSeek など複数AIが並列作業したときに、
 * merge / commit / tag / push 前に実物の差分が安全かを検査する guard。
 *
 * 【役割の分担】
 *   Agent Handoff Coordination Gate (v110.64): 誰が何を担当するかの PLAN 検査
 *   Parallel Agent Merge Guard       (v110.67): merge前に実物の差分・ファイルが安全かの CHECK
 *
 * 【dryRun 専用】
 *   実 merge / 実 commit / 実 push は一切行わない。
 *   git state inspection / fixture / mock / config 読取のみ。
 *
 * Usage:
 *   node tools/kosame-parallel-agent-merge-guard.js
 *   node tools/kosame-parallel-agent-merge-guard.js --json
 */

const fs   = require('fs');
const path = require('path');

const TOOL_META = {
  version: '110.67.0',
  feature: 'v110-67-parallel-agent-merge-guard',
  slug:    'kosame-parallel-agent-merge-guard',
  dryRunOnly: true,
};

// ── Status ────────────────────────────────────────────────────────────────────

const STATUS = {
  safe:       'safe',
  caution:    'caution',
  blocked:    'blocked',
  human_gate: 'human_gate',
};

// ── Danger patterns ───────────────────────────────────────────────────────────

const DANGER_FILE_PATTERNS = [
  { id: 'env_credentials',   re: /\.env$|credentials\.json$|service.?account.*\.json$|\.pem$|\.key$/i, reason: '.env / credentials ファイルの混入' },
  { id: 'api_key_like',      re: /api[_-]?key|bot[_-]?token|auth[_-]?token/i, reason: 'API Key / Bot Token ライクなファイル名' },
  { id: 'sales_dx',          re: /sales.?dx|transcriber/i,                    reason: '営業DX / transcriber ファイルの混入' },
  { id: 'anesty_board',      re: /anesty.?board/i,                            reason: 'ANESTY Board ファイルの混入' },
  { id: 'customer_data',     re: /customer.?data|pii|personal.?data/i,        reason: '顧客データファイルの混入' },
];

const DANGER_CONTENT_PATTERNS = [
  { id: 'sales_dx_text',     re: /営業DX|sales[_\-\s]?dx|transcriber/i,       reason: '営業DX / transcriber への参照' },
  { id: 'anesty_board_text', re: /ANESTY\s*Board|anesty[_\-]board/i,          reason: 'ANESTY Board への参照' },
  { id: 'secret_text',       re: /(?:api[_-]?key|bot[_-]?token|secret|credential|password|\.env)[\s=:'"]/i, reason: 'Secret / credential への参照' },
  { id: 'customer_text',     re: /顧客情報|個人情報|customer_data|pii\b/i,    reason: '顧客データへの参照' },
];

// ── Known agent version ownership ─────────────────────────────────────────────
// This is a default map. Callers can override via reservedVersions.

const DEFAULT_VERSION_OWNERS = {
  '110.63': 'claude',
  '110.64': 'gpt',
  '110.65': 'claude',
  '110.66': 'gpt',
  '110.67': 'claude',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeVersion(v) {
  return String(v || '').trim().replace(/^v/i, '').replace(/\.\d+$/, s => s).split('.').slice(0, 2).join('.');
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  if (!value) return [];
  return [String(value).trim()].filter(Boolean);
}

function compactText(...parts) {
  return parts.filter(Boolean).map(p => String(p)).join(' ').replace(/\s+/g, ' ').trim();
}

function nowIso() { return new Date().toISOString(); }

function fileExists(filePath) {
  try { return fs.existsSync(filePath); } catch { return false; }
}

function isBroadStaging(changedFiles) {
  const files = normalizeList(changedFiles);
  // git add -A 相当: tools/ 以外の大量ファイルや、全 smoke が一括など
  const toolsCount  = files.filter(f => f.startsWith('tools/')).length;
  const smokeCount  = files.filter(f => f.startsWith('smoke/')).length;
  const totalCount  = files.length;
  if (totalCount > 30) return { triggered: true, reason: `staged files ${totalCount} > 30 (git add -A リスク)` };
  if (smokeCount > 10) return { triggered: true, reason: `smoke ファイルが ${smokeCount} 件 (意図しない広範囲 staging の可能性)` };
  return { triggered: false };
}

// ── Smoke / verify cross-check (v110.64 failure 再発防止) ─────────────────────

/**
 * package.json の smoke エントリと実ファイルを照合する。
 * CI で MODULE_NOT_FOUND になるパターンを検出する。
 *
 * @param {object} params
 * @param {object} params.smokeEntries       - { 'smoke:v110-67': 'smoke/v110-67-....js', ... }
 * @param {string[]} params.verifySmokes     - verify スクリプトに含まれる smoke キー名
 * @param {string[]} params.changedFiles     - このコミットで追加/変更するファイル
 * @param {string[]} params.committedFiles   - 既コミット済みファイル（省略可）
 * @param {string}   params.repoRoot         - リポジトリルート
 * @returns {{ issues: object[], blocked: string[], cautions: string[] }}
 */
function checkSmokeConsistency(params) {
  const {
    smokeEntries   = {},
    verifySmokes   = [],
    changedFiles   = [],
    committedFiles = [],
    repoRoot       = process.cwd(),
  } = params;

  const issues   = [];
  const blocked  = [];
  const cautions = [];

  const allAvailableFiles = new Set([
    ...normalizeList(changedFiles),
    ...normalizeList(committedFiles),
  ]);

  for (const [key, smokeFile] of Object.entries(smokeEntries)) {
    const fullPath = path.isAbsolute(smokeFile) ? smokeFile : path.join(repoRoot, smokeFile);
    const existsOnDisk     = fileExists(fullPath);
    const inChangedFiles   = allAvailableFiles.has(smokeFile) || allAvailableFiles.has(fullPath);
    const inVerify         = verifySmokes.includes(key);

    if (!existsOnDisk && !inChangedFiles) {
      const msg = `${key} → "${smokeFile}" がディスク上に存在せず commit 対象でもない (CI で MODULE_NOT_FOUND になる)`;
      issues.push({ key, smokeFile, issue: 'file_missing', message: msg, inVerify });
      if (inVerify) {
        blocked.push(`[BLOCKED] verify に含まれる ${msg}`);
      } else {
        cautions.push(`[CAUTION] verify 外だが ${msg}`);
      }
    } else if (!existsOnDisk && inChangedFiles) {
      // ファイルは changedFiles にあるが、まだディスク上に書かれていない場合
      // (通常はない。念のため)
      cautions.push(`[CAUTION] ${key} → "${smokeFile}" が changedFiles にあるがディスク上に未書き込み`);
    }
  }

  return { issues, blocked, cautions };
}

// ── File danger scan ──────────────────────────────────────────────────────────

function scanFilesForDanger(files) {
  const triggered = [];
  for (const f of normalizeList(files)) {
    for (const p of DANGER_FILE_PATTERNS) {
      if (p.re.test(f)) {
        triggered.push({ file: f, id: p.id, reason: p.reason });
      }
    }
  }
  return triggered;
}

function scanTextForDanger(text) {
  const triggered = [];
  const source = String(text || '');
  for (const p of DANGER_CONTENT_PATTERNS) {
    if (p.re.test(source)) {
      triggered.push({ id: p.id, reason: p.reason });
    }
  }
  return triggered;
}

// ── Version / tag collision checks ───────────────────────────────────────────

function checkVersionOwnership(targetVersion, assignedAgent, reservedVersions) {
  const tv    = normalizeVersion(targetVersion);
  const agent = String(assignedAgent || '').trim().toLowerCase();
  const owners = { ...DEFAULT_VERSION_OWNERS, ...reservedVersions };

  const owner = owners[tv];
  if (!owner) return { ok: true };
  if (owner.toLowerCase() !== agent) {
    return {
      ok: false,
      collision: true,
      reason: `version ${tv} は ${owner} の担当です。${agent} が触ることは version collision になります。`,
    };
  }
  return { ok: true };
}

function checkTagCollision(tagCandidate, existingTags) {
  const tags = normalizeList(existingTags);
  const candidate = String(tagCandidate || '').trim();
  if (!candidate) return { ok: true, skipped: true };
  if (tags.includes(candidate)) {
    return {
      ok: false,
      reason: `tag "${candidate}" は既に存在します。同一 tag を再 push すると衝突します。`,
    };
  }
  return { ok: true };
}

function checkVersionMismatch(packageJsonVersion, targetVersion) {
  const pkgVer = String(packageJsonVersion || '').trim().replace(/^v/i, '');
  const tvFull = String(targetVersion || '').trim().replace(/^v/i, '');
  if (!pkgVer || !tvFull) return { ok: true, skipped: true };
  // package.json version の major.minor が targetVersion と一致するか
  const pkgMajMin = pkgVer.split('.').slice(0, 2).join('.');
  const tvMajMin  = tvFull.split('.').slice(0, 2).join('.');
  if (pkgMajMin !== tvMajMin) {
    return {
      ok: false,
      reason: `package.json version "${pkgVer}" の major.minor (${pkgMajMin}) が targetVersion "${tvFull}" (${tvMajMin}) と一致しません。`,
    };
  }
  return { ok: true };
}

function checkReservedAgentTask(targetVersion, assignedAgent, reservedAgentTasks) {
  if (!reservedAgentTasks || Object.keys(reservedAgentTasks).length === 0) return [];
  const cautions = [];
  const tv = normalizeVersion(targetVersion);
  const agent = String(assignedAgent || '').trim().toLowerCase();
  for (const [ver, taskInfo] of Object.entries(reservedAgentTasks)) {
    const normalizedVer = normalizeVersion(ver);
    if (normalizedVer === tv) continue; // 自分のタスクはOK
    const taskAgent = String(taskInfo.agent || '').trim().toLowerCase();
    if (taskAgent && taskAgent !== agent) continue; // 他エージェントのタスクを侵していない
    // 同じエージェントが別バージョンも取ろうとしている?
    if (taskAgent === agent && normalizedVer !== tv) {
      cautions.push(`[CAUTION] ${agent} が version ${tv} だけでなく ${normalizedVer} (${taskInfo.task || ''}) にも関与しているように見えます。先取りでないか確認してください。`);
    }
  }
  return cautions;
}

function checkOutOfScopeVersion(changedFiles, targetVersion, assignedAgent) {
  const tv = normalizeVersion(targetVersion);
  const owners = { ...DEFAULT_VERSION_OWNERS };
  const cautions = [];

  for (const f of normalizeList(changedFiles)) {
    // ファイル名から version 番号を抽出して、担当外 version に触っていないか確認
    const match = f.match(/v110[_\-](\d+)/i);
    if (!match) continue;
    const fileVer = `110.${match[1]}`;
    if (fileVer === tv) continue;
    const fileOwner = owners[fileVer];
    if (fileOwner && fileOwner !== String(assignedAgent || '').toLowerCase()) {
      cautions.push(`[CAUTION] "${f}" は version ${fileVer} (担当: ${fileOwner}) のファイルですが、${assignedAgent} の commit に含まれています。先取り・上書きでないか確認してください。`);
    }
  }
  return cautions;
}

// ── Commit message check ──────────────────────────────────────────────────────

function checkCommitMessage(commitMessage, targetVersion) {
  const msg = String(commitMessage || '').trim();
  if (!msg) return { ok: true, skipped: true };
  const tv = String(targetVersion || '').trim().replace(/^v/i, '');
  const tvShort = tv.split('.').slice(0, 2).join('.');
  // commit message に targetVersion が含まれているか
  if (!msg.includes(tvShort) && !msg.includes(`v${tvShort}`)) {
    return {
      ok: false,
      caution: true,
      reason: `commit message に targetVersion "${tvShort}" が含まれていません (推奨: "v${tvShort} ..." 形式)`,
    };
  }
  return { ok: true };
}

// ── Untracked required files check ───────────────────────────────────────────

function checkUntrackedRequired(untrackedFiles, verifySmokes, smokeEntries, repoRoot) {
  const untracked = new Set(normalizeList(untrackedFiles));
  const blocked   = [];

  for (const key of normalizeList(verifySmokes)) {
    const smokeFile = smokeEntries[key];
    if (!smokeFile) continue;
    const fullPath = path.isAbsolute(smokeFile) ? smokeFile : path.join(repoRoot, smokeFile);
    if (untracked.has(smokeFile) || untracked.has(fullPath)) {
      blocked.push(`"${smokeFile}" が verify に必要ですが未追跡ファイル (未 git add) です。CI で MODULE_NOT_FOUND になります。`);
    }
  }

  return blocked;
}

// ── Core guard builder ────────────────────────────────────────────────────────

/**
 * Parallel Agent Merge Guard の中心的な検査関数。
 * 実 git コマンドは実行しない。受け取った情報のみで検査する。
 *
 * @param {object} request
 * @param {string}   request.targetVersion        - '110.67' or 'v110.67' or '110.67.0'
 * @param {string}   request.assignedAgent        - 'claude' | 'gpt' | 'gemini' | 'grok' | 'deepseek'
 * @param {string}   request.commitMessage        - commit候補メッセージ
 * @param {string}   request.tagCandidate         - tag候補 'v110.67'
 * @param {string[]} request.changedFiles         - このコミットで追加/変更するファイルリスト
 * @param {string[]} request.untrackedFiles       - 未 git add のファイルリスト
 * @param {string}   request.packageJsonVersion   - package.json の "version" 値
 * @param {object}   request.smokeEntries         - { 'smoke:v110-67': 'smoke/v110-67-....js', ... }
 * @param {string[]} request.verifySmokes         - verify スクリプトに含まれる smoke キー名
 * @param {string[]} request.existingTags         - 既存 git tag 一覧
 * @param {object}   request.reservedVersions     - { '110.66': 'gpt', ... }  (override)
 * @param {object}   request.reservedAgentTasks   - { '110.66': { agent: 'gpt', task: '...' }, ... }
 * @param {string[]} request.committedFiles       - 既コミット済みファイル (省略可)
 * @param {string}   request.repoRoot             - リポジトリルート (省略時: cwd)
 * @returns {object}
 */
function buildMergeGuardResult(request = {}) {
  const {
    targetVersion      = '',
    assignedAgent      = '',
    commitMessage      = '',
    tagCandidate       = '',
    changedFiles       = [],
    untrackedFiles     = [],
    packageJsonVersion = '',
    smokeEntries       = {},
    verifySmokes       = [],
    existingTags       = [],
    reservedVersions   = {},
    reservedAgentTasks = {},
    committedFiles     = [],
    repoRoot           = process.cwd(),
  } = request;

  const timestamp      = nowIso();
  const checkedItems   = [];
  const blockedReasons = [];
  const cautions       = [];
  const requiredFixes  = [];
  let   humanGate      = false;

  // ── 1. Broad staging risk (git add -A 相当) ──────────────────────────────

  const broadStagingCheck = isBroadStaging(changedFiles);
  checkedItems.push({ check: 'broad_staging_risk', result: broadStagingCheck.triggered ? 'blocked' : 'ok' });
  if (broadStagingCheck.triggered) {
    blockedReasons.push(`[BROAD STAGING] ${broadStagingCheck.reason}`);
    requiredFixes.push('git add を個別ファイル指定に変更してください (git add -A 禁止)');
  }

  // ── 2. Danger file scan ───────────────────────────────────────────────────

  const allFiles       = [...normalizeList(changedFiles), ...normalizeList(untrackedFiles)];
  const dangerFiles    = scanFilesForDanger(allFiles);
  checkedItems.push({ check: 'danger_file_scan', result: dangerFiles.length > 0 ? 'human_gate' : 'ok', files: dangerFiles.map(d => d.file) });
  if (dangerFiles.length > 0) {
    humanGate = true;
    for (const d of dangerFiles) {
      blockedReasons.push(`[DANGER FILE] "${d.file}": ${d.reason}`);
    }
    requiredFixes.push('危険ファイルを commit 対象から除外してください');
  }

  // ── 3. Danger content scan (commit message / tag candidate) ──────────────

  const contentToScan   = compactText(commitMessage, tagCandidate);
  const dangerContent   = scanTextForDanger(contentToScan);
  checkedItems.push({ check: 'danger_content_scan', result: dangerContent.length > 0 ? 'human_gate' : 'ok' });
  if (dangerContent.length > 0) {
    humanGate = true;
    for (const d of dangerContent) {
      blockedReasons.push(`[DANGER CONTENT] ${d.reason}`);
    }
  }

  // ── 4. Version ownership collision ───────────────────────────────────────

  const ownershipCheck = checkVersionOwnership(targetVersion, assignedAgent, reservedVersions);
  checkedItems.push({ check: 'version_ownership', result: ownershipCheck.ok ? 'ok' : 'blocked', targetVersion, assignedAgent });
  if (!ownershipCheck.ok) {
    blockedReasons.push(`[VERSION COLLISION] ${ownershipCheck.reason}`);
    requiredFixes.push(`targetVersion を ${assignedAgent} の担当 version に修正してください`);
  }

  // ── 5. Tag collision ─────────────────────────────────────────────────────

  const tagCheck = checkTagCollision(tagCandidate, existingTags);
  checkedItems.push({ check: 'tag_collision', result: tagCheck.ok || tagCheck.skipped ? 'ok' : 'blocked', tagCandidate });
  if (!tagCheck.ok && !tagCheck.skipped) {
    blockedReasons.push(`[TAG COLLISION] ${tagCheck.reason}`);
    requiredFixes.push('tag 候補を変更してください');
  }

  // ── 6. package.json version mismatch ─────────────────────────────────────

  const versionMismatch = checkVersionMismatch(packageJsonVersion, targetVersion);
  checkedItems.push({ check: 'package_json_version', result: versionMismatch.ok || versionMismatch.skipped ? 'ok' : 'blocked', packageJsonVersion, targetVersion });
  if (!versionMismatch.ok && !versionMismatch.skipped) {
    blockedReasons.push(`[VERSION MISMATCH] ${versionMismatch.reason}`);
    requiredFixes.push('package.json の version を targetVersion に合わせてください');
  }

  // ── 7. Smoke entry file existence check (v110.64 failure 再発防止) ────────

  const smokeCheck = checkSmokeConsistency({
    smokeEntries,
    verifySmokes,
    changedFiles,
    committedFiles,
    repoRoot,
  });
  checkedItems.push({
    check:   'smoke_file_consistency',
    result:  smokeCheck.blocked.length > 0 ? 'blocked' : smokeCheck.cautions.length > 0 ? 'caution' : 'ok',
    issues:  smokeCheck.issues.map(i => i.key),
  });
  for (const b of smokeCheck.blocked) {
    blockedReasons.push(b);
    requiredFixes.push('smoke ファイルを commit 対象に含めるか、verify スクリプトから除外してください');
  }
  for (const c of smokeCheck.cautions) {
    cautions.push(c);
  }

  // ── 8. Untracked required files ───────────────────────────────────────────

  const untrackedBlocked = checkUntrackedRequired(untrackedFiles, verifySmokes, smokeEntries, repoRoot);
  checkedItems.push({ check: 'untracked_required_files', result: untrackedBlocked.length > 0 ? 'blocked' : 'ok' });
  for (const b of untrackedBlocked) {
    blockedReasons.push(`[UNTRACKED] ${b}`);
    requiredFixes.push('必要な smoke ファイルを git add してください');
  }

  // ── 9. Out-of-scope version file check ───────────────────────────────────

  const outOfScopeCautions = checkOutOfScopeVersion(changedFiles, targetVersion, assignedAgent);
  checkedItems.push({ check: 'out_of_scope_version_files', result: outOfScopeCautions.length > 0 ? 'caution' : 'ok' });
  for (const c of outOfScopeCautions) {
    cautions.push(c);
  }

  // ── 10. Reserved agent task check ────────────────────────────────────────

  const taskCautions = checkReservedAgentTask(targetVersion, assignedAgent, reservedAgentTasks);
  checkedItems.push({ check: 'reserved_agent_tasks', result: taskCautions.length > 0 ? 'caution' : 'ok' });
  for (const c of taskCautions) {
    cautions.push(c);
  }

  // ── 11. Commit message format ─────────────────────────────────────────────

  const msgCheck = checkCommitMessage(commitMessage, targetVersion);
  checkedItems.push({ check: 'commit_message_format', result: msgCheck.ok || msgCheck.skipped ? 'ok' : 'caution' });
  if (!msgCheck.ok && !msgCheck.skipped && msgCheck.caution) {
    cautions.push(`[CAUTION] ${msgCheck.reason}`);
  }

  // ── Status determination ──────────────────────────────────────────────────

  let status;
  let humanApprovalRequired = false;
  let nextAllowedAction;

  if (humanGate) {
    status = STATUS.human_gate;
    humanApprovalRequired = true;
    nextAllowedAction = 'request_human_approval_then_remove_dangerous_items';
  } else if (blockedReasons.length > 0) {
    status = STATUS.blocked;
    nextAllowedAction = 'fix_blocked_items_and_rerun_merge_guard';
  } else if (cautions.length > 0) {
    status = STATUS.caution;
    nextAllowedAction = 'review_cautions_then_proceed_to_human_approval_for_commit';
  } else {
    status = STATUS.safe;
    nextAllowedAction = 'proceed_to_human_approval_for_commit_and_tag';
  }

  const mergeGuardItems = checkedItems.map(item => ({
    check:   item.check,
    result:  item.result,
    ...(item.files  ? { files:  item.files }  : {}),
    ...(item.issues ? { issues: item.issues } : {}),
  }));

  return {
    version:              TOOL_META.version,
    timestamp,
    dryRun:               true,
    status,
    targetVersion:        String(targetVersion),
    assignedAgent:        String(assignedAgent),
    checkedFiles:         normalizeList(changedFiles),
    untrackedFiles:       normalizeList(untrackedFiles),
    blockedReasons,
    cautions,
    requiredFixes:        [...new Set(requiredFixes)],
    nextAllowedAction,
    humanApprovalRequired,
    // Dashboard / Router Explainability 統合用
    mergeGuard: {
      hasBlocked:       blockedReasons.length > 0,
      hasCaution:       cautions.length > 0,
      humanGate,
      requiredFixes:    [...new Set(requiredFixes)],
      nextAllowedAction,
      items:            mergeGuardItems,
    },
    // Human Gate Inbox 統合用 summary
    humanGateInboxSummary: humanApprovalRequired || blockedReasons.length > 0
      ? {
          gateCategory:          humanGate ? 'security' : 'other',
          gateReason:            blockedReasons.slice(0, 3).join(' | '),
          recommendedAction:     humanGate ? 'deny' : 'approve_with_review',
          targetFiles:           normalizeList(changedFiles).slice(0, 8),
        }
      : null,
  };
}

/**
 * package.json を実際に読んで smoke エントリと verify を抽出するヘルパー。
 * repoRoot 配下の package.json を安全に読む（値は参照しない）。
 *
 * @param {string} repoRoot
 * @returns {{ version: string, smokeEntries: object, verifySmokes: string[] }}
 */
function readPackageJsonMeta(repoRoot) {
  const pkgPath = path.join(String(repoRoot || process.cwd()), 'package.json');
  if (!fileExists(pkgPath)) return { version: '', smokeEntries: {}, verifySmokes: [] };

  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch { return { version: '', smokeEntries: {}, verifySmokes: [] }; }

  const version      = String(pkg.version || '');
  const scripts      = pkg.scripts || {};
  const verifyScript = String(scripts.verify || '');

  // smoke:vXX-YY 形式のエントリのみ抽出
  const smokeEntries = {};
  for (const [key, val] of Object.entries(scripts)) {
    if (/^smoke:v\d+/.test(key)) smokeEntries[key] = String(val).replace(/^node\s+/, '').trim();
  }

  // verify スクリプト内の smoke キー
  const verifySmokes = [...verifyScript.matchAll(/smoke:v[\w-]+/g)].map(m => m[0]);

  return { version, smokeEntries, verifySmokes };
}

/**
 * smoke ファイル一覧を取得するヘルパー（smoke/ ディレクトリを読む）。
 *
 * @param {string} repoRoot
 * @returns {string[]}
 */
function listSmokeFilesOnDisk(repoRoot) {
  const smokeDir = path.join(String(repoRoot || process.cwd()), 'smoke');
  try {
    return fs.readdirSync(smokeDir).map(f => `smoke/${f}`);
  } catch { return []; }
}

// ── Colors (CLI display) ──────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', blue: '\x1b[34m', gray: '\x1b[90m',
  bgRed: '\x1b[41m', white: '\x1b[37m',
};
const c  = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (n = 70) => '─'.repeat(n);

function printMergeGuardDashboard(result) {
  const statusColor = result.status === 'safe'       ? 'green'
    : result.status === 'caution'    ? 'yellow'
    : result.status === 'human_gate' ? 'bgRed'
    : 'red';

  console.log('');
  console.log(`${c('bold', c('blue', '⬡ KOSAME Parallel Agent Merge Guard'))}  v${TOOL_META.version}`);
  console.log(`  ${c('dim', result.timestamp)}  ${c('dim', '[DRY-RUN]')}`);
  console.log(`  agent: ${c('cyan', result.assignedAgent)}  targetVersion: ${c('cyan', result.targetVersion)}`);
  console.log('  ' + hr());
  console.log(`  Status: ${c(statusColor, result.status.toUpperCase().padEnd(12))}`);
  console.log('  ' + hr());

  if (result.mergeGuard.humanGate) {
    console.log(`  ${c('bgRed', c('white', '  !! HUMAN GATE !! 危険ファイル混入または禁止コンテンツ  '))}`);
    console.log('');
  }

  if (result.blockedReasons.length > 0) {
    console.log(`  ${c('red', 'Blocked Reasons')}`);
    for (const r of result.blockedReasons) {
      console.log(`  ${c('red', '✗')} ${r}`);
    }
    console.log('');
  }

  if (result.cautions.length > 0) {
    console.log(`  ${c('yellow', 'Cautions')}`);
    for (const ca of result.cautions) {
      console.log(`  ${c('yellow', '⚠')} ${ca}`);
    }
    console.log('');
  }

  console.log(`  ${c('bold', 'Checked Items')}`);
  for (const item of result.mergeGuard.items) {
    const icon = item.result === 'ok'       ? c('green', '✓')
      : item.result === 'caution'  ? c('yellow', '⚠')
      : item.result === 'human_gate' ? c('bgRed', '!')
      : c('red', '✗');
    console.log(`  ${icon} ${item.check}`);
  }

  if (result.requiredFixes.length > 0) {
    console.log('');
    console.log(`  ${c('red', 'Required Fixes')}`);
    for (const fix of result.requiredFixes) {
      console.log(`  ${c('red', '→')} ${fix}`);
    }
  }

  console.log('  ' + hr());
  console.log(`  Next: ${c('cyan', result.nextAllowedAction)}`);
  if (result.humanApprovalRequired) {
    console.log(`  ${c('red', '⚠ Human approval required before any commit/tag/push.')}`);
  }
  console.log('');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args     = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const root     = process.cwd();

  const { version: pkgVer, smokeEntries, verifySmokes } = readPackageJsonMeta(root);

  const changedFiles = [
    'tools/kosame-parallel-agent-merge-guard.js',
    'smoke/v110-67-parallel-agent-merge-guard-smoke.js',
    'package.json',
  ];

  const result = buildMergeGuardResult({
    targetVersion:      '110.67',
    assignedAgent:      'claude',
    commitMessage:      'v110.67 Add Parallel Agent Merge Guard',
    tagCandidate:       'v110.67',
    changedFiles,
    untrackedFiles:     [],
    packageJsonVersion: pkgVer,
    smokeEntries,
    verifySmokes,
    existingTags:       ['v110.63', 'v110.65'],
    reservedVersions:   { '110.66': 'gpt' },
    reservedAgentTasks: { '110.66': { agent: 'gpt', task: 'Provider Availability Health Snapshot' } },
    committedFiles:     listSmokeFilesOnDisk(root),
    repoRoot:           root,
  });

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printMergeGuardDashboard(result);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  TOOL_META,
  STATUS,
  DANGER_FILE_PATTERNS,
  DANGER_CONTENT_PATTERNS,
  DEFAULT_VERSION_OWNERS,
  buildMergeGuardResult,
  readPackageJsonMeta,
  listSmokeFilesOnDisk,
  checkSmokeConsistency,
  checkVersionOwnership,
  checkTagCollision,
  checkVersionMismatch,
  checkOutOfScopeVersion,
  checkUntrackedRequired,
  checkCommitMessage,
  isBroadStaging,
  scanFilesForDanger,
  scanTextForDanger,
  printMergeGuardDashboard,
};
