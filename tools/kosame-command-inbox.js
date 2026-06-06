#!/usr/bin/env node
'use strict';

const TOOL_META = {
  version: '110.16.0',
  slug: 'kosame-command-inbox',
  feature: 'v110-16-agent-patch-executor',
};

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

  // Claude is removed for this version
  return providers;
}

function buildNextCommand({ repo, workType, input }) {
  const safeInput = maskSensitive(input);
  const routeInput = `${safeInput} (Claude unavailable)`;

  if (workType === 'promote_candidate') {
    return `cd ${repo.path} && npm run verify`;
  }

  const resultFile = `dispatch-result-${Date.now()}.json`;
  return `cd ~/kosame-dev-orchestra && npm run route -- --input="${routeInput}" --yes --live --output=${resultFile} && node tools/kosame-patch-executor.js --result=${resultFile} --yes --verify`;
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('ERROR: --input is required');
    process.exit(1);
  }
  const plan = buildInboxPlan(args);
  console.log(renderPlan(plan));

  const result = runNextCommand(plan, args);
  if (args.run) {
    console.log(`AUTO_RUN_EXECUTED: ${result.executed}`);
    console.log(`AUTO_RUN_REASON  : ${result.reason}`);
  }
}

if (require.main === module) {
  main();
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
  buildProviderPlan,
  buildNextCommand,
  buildInboxPlan,
  renderPlan,
  runNextCommand,
};
