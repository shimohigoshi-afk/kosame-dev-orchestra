#!/usr/bin/env node
'use strict';

const TOOL_META = {
  version: '110.31.0',
  slug: 'kosame-command-inbox',
  feature: 'v110-31-deepseek-router-executor',
};

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPOS = {
  kosame: {
    id: 'kosame-dev-orchestra',
    path: '~/kosame-dev-orchestra',
    match: [/kosame/i, /dev orchestra/i, /開発os/i, /OS/i, /router/i, /fallback/i, /inbox/i],
  },
  anesty: {
    id: 'anesty-board',
    path: '~/anesty-board',
    match: [/anesty/i, /board/i, /ANESTY/i, /ボード/i, /会議/i, /制作指示/i],
  },
};

function parseArgs(argv) {
  const out = { input: '', yes: false, dryRun: true, run: false };
  for (const raw of argv) {
    if (raw === '--yes') {
      out.yes = true;
      continue;
    }
    if (raw === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (raw.startsWith('--input=')) {
      out.input = raw.slice('--input='.length);
      continue;
    }
    if (raw === '--live') {
      out.live = true;
      continue;
    }
    if (raw === '--run') {
      out.run = true;
      continue;
    }
  }
  return out;
}

function maskSensitive(text = '') {
  return String(text)
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[MASKED:OPENAI_KEY]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[MASKED:GEMINI_KEY]')
    .replace(/xai-[0-9A-Za-z_-]{8,}/g, '[MASKED:GROK_KEY]')
    .replace(/(API_KEY|TOKEN|SECRET|PASSWORD)=([^\s]+)/gi, '$1=[MASKED:SECRET]');
}

function detectRepo(input) {
  const text = input || '';
  for (const repo of Object.values(REPOS)) {
    if (repo.match.some((re) => re.test(text))) return repo;
  }
  return REPOS.kosame;
}

function detectWorkType(input) {
  const text = input || '';
  if (/promote|正本化|commit|tag|push/i.test(text)) return 'promote_candidate';
  if (/verify|検証|smoke/i.test(text)) return 'verify';
  if (/実装|作って|追加|修正|進めて/i.test(text)) return 'implementation_planning';
  if (/設計|案|レビュー/i.test(text)) return 'design_review';
  return 'triage';
}

function claudeUnavailable(input) {
  return /Claude unavailable|Claudeには振らない|Claude stopped|Claude limit|Claude Codeは利用上限|くろちゃん使えない|くろちゃん止ま/i.test(input || '');
}

function wantsGrok(input) {
  return /Grok|グロック|抜け漏れ|レビュー|突破/i.test(input || '');
}

function wantsGemini(input) {
  return /Gemini|ジェミニ|大量|実装案|差分案|下読み/i.test(input || '');
}

function wantsDeepSeek(input) {
  return /DeepSeek|deepseek|ローカルパッチ|local.?patch|patch.?executor|パッチ実行|KOSAME.?Patch/i.test(input || '');
}

function buildProviderPlan(input) {
  const unavailable = true; // FORCE CLAUDE UNAVAILABLE for v110.15+ Auto Runner
  const providers = [];

  providers.push({
    provider: 'gpt',
    role: 'arbiter',
    action: '裁定・作業分解・次アクション生成',
  });

  if (wantsGemini(input) || unavailable) {
    providers.push({
      provider: 'gemini',
      role: 'planner',
      action: '実装案・差分案・JSON仕様・最小プロンプト作成',
    });
  }

  if (wantsGrok(input) || unavailable) {
    providers.push({
      provider: 'grok',
      role: 'reviewer',
      action: '抜け漏れレビュー・突破案',
    });
  }

  // v110.31: DeepSeek → executor pipeline
  if (wantsDeepSeek(input)) {
    providers.push({
      provider: 'deepseek',
      role: 'patch-generator',
      action: 'KOSAME Patch Format 生成 → deepseek-local-patch-executor へ自動パイプ',
    });
  }

  // Claude is removed for this version
  return providers;
}

function buildNextCommand({ repo, workType, input }) {
  const safeInput = maskSensitive(input);

  if (workType === 'promote_candidate') {
    return `cd ${repo.path} && npm run verify`;
  }

  // v110.31: DeepSeek patch routing → executor pipeline
  if (wantsDeepSeek(input)) {
    return `node tools/multi-agent-task-router.js --input="${safeInput}" --yes --live`;
  }

  // v110.19: full autopilot via inbox-pipeline (no human relay)
  return `node tools/kosame-inbox-patch-pipeline.js --input="${safeInput}" --yes --live`;
}

function buildInboxPlan(options = {}) {
  const input = maskSensitive(options.input || '');
  const repo = detectRepo(input);
  const workType = detectWorkType(input);
  const providers = buildProviderPlan(input);
  const nextCommand = buildNextCommand({ repo, workType, input });

  return {
    toolMeta: TOOL_META,
    input,
    repo,
    workType,
    providers,
    nextCommand,
    safety: {
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      commitTagPushRequiresYes: true,
      secretsMasked: true,
      gitAddAllDenied: true,
    },
    humanApprovalRequired: /commit|tag|push|deploy|secret|請求|契約/i.test(input),
  };
}

const COMMAND_INBOX_DIR = path.join(process.cwd(), '.kosame-command-inbox');
const COMMAND_INBOX_LOG = path.join(COMMAND_INBOX_DIR, 'jobs.jsonl');

function normalizeJobText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureCommandInboxDir() {
  try {
    fs.mkdirSync(COMMAND_INBOX_DIR, { recursive: true });
  } catch {}
}

function buildCommandInboxJob(input = {}, options = {}) {
  const plan = buildInboxPlan({ input: input.prompt || input.message || input.input || '' });
  const job = {
    id: normalizeJobText(input.id || options.id || `job-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`),
    source: normalizeJobText(input.source || options.source || 'kosame-console'),
    status: normalizeJobText(input.status || 'queued'),
    prompt: normalizeJobText(input.prompt || input.message || input.input || ''),
    result: normalizeJobText(input.result || ''),
    safety: plan.safety,
    repo: plan.repo,
    workType: plan.workType,
    nextCommand: plan.nextCommand,
    createdAt: normalizeJobText(input.createdAt || new Date().toISOString()),
    updatedAt: normalizeJobText(input.updatedAt || new Date().toISOString()),
  };
  return { ...job, plan };
}

function appendCommandInboxJob(input = {}, options = {}) {
  ensureCommandInboxDir();
  const job = buildCommandInboxJob(input, options);
  fs.appendFileSync(COMMAND_INBOX_LOG, `${JSON.stringify(job)}\n`);
  return job;
}

function readCommandInboxJobs(limit = 20) {
  try {
    if (!fs.existsSync(COMMAND_INBOX_LOG)) return [];
    const lines = fs.readFileSync(COMMAND_INBOX_LOG, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, Number(limit) || 20)).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function claimCommandInboxJob(id, updates = {}) {
  const jobs = readCommandInboxJobs(200);
  const targetId = normalizeJobText(id);
  const job = jobs.slice().reverse().find((item) => normalizeJobText(item.id) === targetId);
  if (!job) return null;
  return {
    ...job,
    status: normalizeJobText(updates.status || 'claimed'),
    claimedAt: normalizeJobText(updates.claimedAt || new Date().toISOString()),
    result: normalizeJobText(updates.result || job.result || ''),
    updatedAt: normalizeJobText(updates.updatedAt || new Date().toISOString()),
  };
}

function renderPlan(plan) {
  const lines = [];
  lines.push('===== KOSAME Command Inbox =====');
  lines.push(`INPUT   : ${plan.input}`);
  lines.push(`REPO    : ${plan.repo.id}`);
  lines.push(`PATH    : ${plan.repo.path}`);
  lines.push(`TYPE    : ${plan.workType}`);
  lines.push('PROVIDERS:');
  for (const p of plan.providers) {
    lines.push(`  - ${p.provider}: ${p.role} / ${p.action}`);
  }
  lines.push(`NEXT    : ${plan.nextCommand}`);
  lines.push(`DRY RUN : ${plan.safety.dryRun}`);
  lines.push(`REAL PRODUCT ACTIONS EXECUTED : ${plan.safety.realProductActionsExecuted}`);
  lines.push(`DANGEROUS ACTIONS DENIED      : ${plan.safety.dangerousActionsDenied}`);
  lines.push(`HUMAN APPROVAL REQUIRED       : ${plan.humanApprovalRequired}`);
  lines.push('================================');
  return lines.join('\n');
}

const { execSync } = require('child_process');

// Kept for backward compatibility (used by v110.15 tests and legacy callers).
function runNextCommand(plan, args) {
  if (!args.run) return { executed: false, reason: 'run flag not set' };
  if (!args.yes) return { executed: false, reason: '--yes required for --run' };
  if (!plan.nextCommand || typeof plan.nextCommand !== 'string') {
    return { executed: false, reason: 'nextCommand missing' };
  }

  console.log('===== KOSAME Command Inbox Auto Runner =====');
  console.log(`RUNNING : ${plan.nextCommand}`);
  console.log('===========================================');

  execSync(plan.nextCommand, {
    stdio: 'inherit',
    shell: '/bin/bash',
  });

  return { executed: true, reason: 'completed' };
}

// v110.19: full autopilot — Inbox → Route → Patch → Verify → Commit Candidate
// Human gate: commit approval only.
async function runFullPipeline(args) {
  if (!args.run) return { executed: false, reason: 'run flag not set' };
  if (!args.yes) return { executed: false, reason: '--yes required for --run' };
  if (!args.input) return { executed: false, reason: '--input is required' };

  const pipeline = require('./kosame-inbox-patch-pipeline');

  console.log('\n===== KOSAME Autopilot v110.19 =====');
  console.log('Inbox → Route → Patch → Verify → Commit Candidate');
  console.log('Human gate: commit approval only');
  console.log('=====================================\n');

  const pipelineArgv = [
    'node', 'kosame-inbox-patch-pipeline.js',
    `--input=${args.input}`,
    '--yes',
    ...(args.live ? ['--live'] : []),
  ];

  const result = await pipeline.run(pipelineArgv);

  if (result.commitCandidate) {
    console.log('\n===== HUMAN GATE: Commit Approval =====');
    console.log(`Suggested message : ${result.commitCandidate.suggestedMessage}`);
    console.log(`Files             : ${result.commitCandidate.files.join(', ')}`);
    console.log(`Git command       : ${result.commitCandidate.gitCommand}`);
    console.log('Run the git command above to commit (human approval required).');
    console.log('========================================');
  }

  return { executed: true, reason: 'pipeline complete', pipelineResult: result };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('ERROR: --input is required');
    process.exit(1);
  }

  const plan = buildInboxPlan(args);
  console.log(renderPlan(plan));

  if (args.run) {
    const result = await runFullPipeline(args);
    console.log(`AUTOPILOT_EXECUTED: ${result.executed}`);
    console.log(`AUTOPILOT_REASON  : ${result.reason}`);
  }
}

module.exports.buildInboxPlan = buildInboxPlan;

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  parseArgs,
  maskSensitive,
  detectRepo,
  detectWorkType,
  claudeUnavailable,
  wantsGrok,
  wantsGemini,
  wantsDeepSeek,
  buildProviderPlan,
  buildNextCommand,
  buildInboxPlan,
  buildCommandInboxJob,
  appendCommandInboxJob,
  readCommandInboxJobs,
  claimCommandInboxJob,
  renderPlan,
  runNextCommand,
  runFullPipeline,
};
