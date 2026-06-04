'use strict';

const { buildDefaultPacket, DANGEROUS_ACTIONS_DENIED: DAD_V48 } = require('./dev-agent-practical-operation-board-display-pack');
const { getTemplate, TASK_TEMPLATES }                            = require('./dev-agent-operation-board-task-template-bank-pack');

const TOOL_META = {
  version: '50.0.0',
  title:   'KOSAME Dev Orchestra Practical Build Line Pack',
  slug:    'dev-agent-practical-build-line-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

function buildClaudePromptPacket(template, target) {
  target = target || {};
  const tpl = template || {};
  return {
    promptTitle:      `${tpl.title || 'Task'} — controlled task prompt`,
    targetProduct:    target.product || 'KOSAME Dev Orchestra',
    targetRepo:       target.repo    || '/home/shimohigoshi/kosame-dev-orchestra',
    allowedFiles:     tpl.allowedFiles    || [],
    forbiddenFiles:   tpl.forbiddenFiles  || [],
    allowedCommands:  tpl.allowedCommands || [],
    forbiddenCommands: tpl.forbiddenCommands || [],
    verificationCommands: tpl.verificationCommands || ['npm run verify'],
    doneCriteria:     tpl.doneCriteria    || [],
    commitStopRule:   tpl.commitStopRule  || 'Stop before git add. Human YES required.',
    prompt:           buildPromptText(tpl, target)
  };
}

function buildPromptText(tpl, target) {
  tpl    = tpl    || {};
  target = target || {};
  return [
    `あなたは KOSAME Dev Orchestra の実装担当 Claude です。`,
    ``,
    `【タスク】${tpl.title || '-'}`,
    `【対象repo】${target.repo || '-'}`,
    ``,
    `【作業対象ファイル (許可)】`,
    (tpl.allowedFiles || []).map(f => `- ${f}`).join('\n'),
    ``,
    `【絶対に触ってはいけないファイル】`,
    (tpl.forbiddenFiles || []).map(f => `- ${f}`).join('\n'),
    ``,
    `【絶対に実行してはいけないコマンド】`,
    (tpl.forbiddenCommands || []).map(c => `- ${c}`).join('\n'),
    ``,
    `【検証コマンド】`,
    (tpl.verificationCommands || []).map(c => `- ${c}`).join('\n'),
    ``,
    `【完了基準】`,
    (tpl.doneCriteria || []).map(d => `- ${d}`).join('\n'),
    ``,
    `【重要】${tpl.commitStopRule || 'Stop before git add. Human YES required.'}`
  ].join('\n');
}

function buildSafetyGate(template, overrides) {
  const tpl = template || {};
  overrides = overrides || {};
  const blockers = [];

  if (overrides.secretTouched)  blockers.push('secret/env file detected in scope');
  if (overrides.deployInScope)  blockers.push('deploy command in scope');
  if (overrides.botJsTouched)   blockers.push('bot.js touched');
  if (overrides.extraBlockers)  blockers.push(...overrides.extraBlockers);

  return {
    passed:    blockers.length === 0,
    blockers,
    dangerGates: {
      secretRead:        'BLOCKED',
      envRead:           'BLOCKED',
      deploy:            'BLOCKED',
      gitPushByAI:       'BLOCKED',
      customerDataRead:  'BLOCKED',
      destructiveDelete: 'BLOCKED'
    }
  };
}

function buildVerificationPlan(template) {
  const tpl = template || {};
  return {
    commands:        tpl.verificationCommands || ['npm run verify'],
    doneCriteria:    tpl.doneCriteria          || [],
    rollbackInstruction: tpl.rollbackInstruction || 'Revert changed files (human only)'
  };
}

function buildAcceptanceGate(safetyGate, overrides) {
  overrides = overrides || {};
  const blockers = [
    ...(safetyGate ? safetyGate.blockers : []),
    ...(overrides.extraBlockers || [])
  ];
  return {
    commitCandidate:       blockers.length === 0,
    humanApprovalRequired: true,
    blockers,
    reviewerNote:          blockers.length === 0
      ? 'こさめ/GPTレビュー → じゅんやさん最終YES'
      : `BLOCKED: ${blockers.join(', ')} を解消してから再提出`
  };
}

function buildHumanApprovalPacket(acceptanceGate) {
  const acc = acceptanceGate || {};
  return {
    junyaApprovalRequired: true,
    currentStatus:         acc.commitCandidate ? 'READY_FOR_APPROVAL' : 'BLOCKED',
    reviewNote:            acc.reviewerNote || '-',
    blockers:              acc.blockers || [],
    approvalActions:       ['git add', 'git commit', 'git push'],
    deniedActions:         DANGEROUS_ACTIONS_DENIED
  };
}

function buildPracticalBuildLine(opts) {
  opts = opts || {};
  const now          = opts.timestamp || Date.now();
  const templateId   = opts.templateId || 'docs_update';
  const template     = getTemplate(templateId) || TASK_TEMPLATES[0];
  const target       = opts.target || {
    product: 'KOSAME Dev Orchestra',
    task:    template.title,
    repo:    '/home/shimohigoshi/kosame-dev-orchestra',
    version: TOOL_META.version,
    commit:  'HEAD'
  };

  const operationBoard   = buildDefaultPacket(Object.assign({}, target, { blockers: opts.blockers || [] }));
  const claudePromptPacket = buildClaudePromptPacket(template, target);
  const safetyGate         = buildSafetyGate(template, opts.safetyOverrides || {});
  const verificationPlan   = buildVerificationPlan(template);
  const acceptanceGate     = buildAcceptanceGate(safetyGate, opts.acceptanceOverrides || {});
  const humanApprovalPacket = buildHumanApprovalPacket(acceptanceGate);

  const nextAction = acceptanceGate.commitCandidate
    ? 'こさめ/GPTレビュー → じゅんやさん最終YES → git add/commit/push'
    : `blockers解消: ${acceptanceGate.blockers.join(', ')}`;

  return {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    operationBoard,
    selectedTaskTemplate:  template,
    claudePromptPacket,
    safetyGate,
    verificationPlan,
    acceptanceGate,
    humanApprovalPacket,
    nextAction,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildClaudePromptPacket,
  buildSafetyGate,
  buildVerificationPlan,
  buildAcceptanceGate,
  buildHumanApprovalPacket,
  buildPracticalBuildLine
};

if (require.main === module) {
  const line = buildPracticalBuildLine({ templateId: 'docs_update' });
  console.log(JSON.stringify(line, null, 2));
}
