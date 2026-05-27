'use strict';
/**
 * Kosame VP Practical Operating Console v4.0.0
 *
 * v3.6.0〜v3.9.0を統合した実用コンソール。
 * こさめ副社長が1コマンドで状態読取・判断・承認ゲート・引継ぎを行う。
 *
 * Commands: status / commit-check / push-check / release-check /
 *           dispatch / approval-board / handoff / next
 */

const { runCliCommand, FORBIDDEN_ACTIONS } = require('./kosame-cli-runner');
const { readRealRepoSnapshot, RISK_LEVELS } = require('./kosame-real-repo-snapshot');
const { buildApprovalBoard } = require('./kosame-approval-board');
const { generateHandoff, TONE_PROFILES } = require('./kosame-handoff-auto-generator');
const { createCombinedStateSnapshot } = require('./combined-state-snapshot');
const { determineVpNextAction } = require('./vp-next-action-controller');

const CONSOLE_VERSION = '4.0.0';

const COMMAND_MAP = {
  'npm run kosame:status': 'こさめ 全体健全性確認',
  'npm run kosame:commit-check': 'こさめ commit YES/NO/HOLD判断',
  'npm run kosame:push-check': 'こさめ push判断 (じゅんやさんYES必要)',
  'npm run kosame:release-check': 'こさめ release判断 (じゅんやさんYES必要)',
  'npm run kosame:dispatch': 'こさめ 次エージェントdispatch判断',
  'npm run kosame:approval': 'こさめ 承認ゲート確認',
  'npm run kosame:handoff': 'こさめ 引継ぎ準備確認',
  'npm run kosame:next': 'こさめ 次の最優先アクション'
};

const SAFE_COMMAND_BOUNDARY = {
  proposable: [
    'git status',
    'git log --oneline -N',
    'git diff --name-only',
    'node --check <file>',
    'npm run verify',
    'gh run list --limit N',
    'git add package.json docs/ai-dev-team tools smoke fixtures',
    'git commit -m "<message>"  (humanApprovalRequired: false)',
    'git push origin main  (humanApprovalRequired: true)',
    'git tag -a vX.Y.Z  (humanApprovalRequired: true)',
    'git push origin vX.Y.Z  (humanApprovalRequired: true)'
  ],
  neverGenerate: [
    'rm -rf',
    'git reset --hard',
    'git clean -f',
    'cat .env / Secret閲覧 / APIキーアクセス',
    'gcloud run deploy',
    'docker build',
    'fetch() / curl 外部APIコール',
    '課金API実行',
    '無承認 git push',
    '無承認 git tag'
  ]
};

function buildVpDecisionPacket(snapshot = {}, session_id = '') {
  const nextAction = determineVpNextAction({ ...snapshot, session_id });

  const topPriority = {
    action: nextAction.action,
    priority: nextAction.priority,
    reason: nextAction.reason,
    requiresHumanApproval: nextAction.requiresHumanApproval,
    risk: nextAction.priority === 'high' ? 'high' : nextAction.priority === 'normal' ? 'medium' : 'low',
    suggestedCommand: nextAction.requiresHumanApproval
      ? `npm run kosame:${nextAction.action === 'request_push_approval' ? 'push-check' : 'release-check'}`
      : `npm run kosame:${nextAction.action === 'fix_verify' ? 'status' : 'next'}`
  };

  return {
    packet: 'vp-practical-decision-packet',
    session_id,
    topPriority,
    overallHealth: snapshot.overallHealth || 'unknown',
    verifyStatus: snapshot.verifyStatus || 'unknown',
    actionsStatus: snapshot.actionsStatus || 'unknown',
    commandMap: COMMAND_MAP,
    safeCommandBoundary: SAFE_COMMAND_BOUNDARY,
    version: CONSOLE_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

function runPracticalConsole(command = 'status', consoleInput = {}) {
  const {
    rawData = {},
    textInputs = {},
    snapshot: inputSnapshot = null,
    sessionGoal = '',
    session_id = `console-${Date.now()}`,
    handoffTone = TONE_PROFILES.CONCISE
  } = consoleInput;

  // Build snapshot from rawData or textInputs
  let snapshot = inputSnapshot;
  let snapshotSource = 'raw';

  if (!snapshot) {
    if (Object.values(textInputs).some(v => v)) {
      const realSnapshot = readRealRepoSnapshot({ ...textInputs, session_id });
      snapshotSource = 'text';
      snapshot = {
        verifyStatus: realSnapshot.snapshot.verifyStatus,
        actionsStatus: realSnapshot.snapshot.actionsStatus,
        workingTreeClean: realSnapshot.snapshot.workingTreeClean,
        isAhead: realSnapshot.snapshot.aheadBehind.ahead > 0,
        hasUncommittedChanges: !realSnapshot.snapshot.workingTreeClean,
        overallHealth: realSnapshot.riskLevel === RISK_LEVELS.RELEASE_READY ? 'healthy'
          : realSnapshot.riskLevel === RISK_LEVELS.ACTIONS_FAILED ? 'critical' : 'degraded',
        packageVersion: realSnapshot.snapshot.currentVersion,
        releaseDocsExist: realSnapshot.snapshot.latestTag !== 'none',
        latestTag: realSnapshot.snapshot.latestTag,
        riskLevel: realSnapshot.riskLevel
      };
    } else {
      snapshot = createCombinedStateSnapshot({ ...rawData, sessionGoal, session_id });
      snapshotSource = 'combined';
    }
  }

  let result = {};

  if (command === 'approval-board') {
    // Special: return full approval board
    const board = buildApprovalBoard({ snapshot, session_id, sessionGoal });
    result = {
      console: 'kosame-vp-practical-console',
      command,
      board,
      requiresJunyaYes: board.requiresJunyaYes,
      session_id,
      version: CONSOLE_VERSION,
      dryRun: true
    };
  } else if (command === 'handoff') {
    // Special: generate handoff note
    const handoffResult = generateHandoff({
      currentVersion: snapshot.packageVersion || rawData.packageVersion || 'unknown',
      currentHead: snapshot.headCommit || 'unknown',
      latestTag: snapshot.latestTag || 'unknown',
      actionsStatus: snapshot.actionsStatus || 'unknown',
      completedWork: consoleInput.completedWork || [],
      uncommittedWork: snapshot.workingTreeClean === false ? ['未コミット変更あり'] : [],
      nextRecommendedAction: consoleInput.nextRecommendedAction || '',
      riskNotes: consoleInput.riskNotes || [],
      nextClaudePromptSummary: consoleInput.nextClaudePromptSummary || '',
      nextGeminiFallbackSummary: consoleInput.nextGeminiFallbackSummary || '',
      humanApprovalStatus: consoleInput.humanApprovalStatus || '確認中',
      tone: handoffTone,
      session_id
    });
    result = {
      console: 'kosame-vp-practical-console',
      command,
      handoffResult,
      session_id,
      version: CONSOLE_VERSION,
      dryRun: true
    };
  } else {
    // Standard CLI commands via runCliCommand
    const cliResult = runCliCommand(command, { rawData, sessionGoal, session_id });
    const decisionPacket = buildVpDecisionPacket(snapshot, session_id);

    result = {
      console: 'kosame-vp-practical-console',
      command,
      ...cliResult,
      decisionPacket,
      snapshotSource,
      commandMap: COMMAND_MAP,
      safeCommandBoundary: SAFE_COMMAND_BOUNDARY,
      session_id,
      version: CONSOLE_VERSION,
      generatedAt: new Date().toISOString(),
      dryRun: true
    };
  }

  return result;
}

module.exports = {
  runPracticalConsole,
  buildVpDecisionPacket,
  CONSOLE_VERSION,
  COMMAND_MAP,
  SAFE_COMMAND_BOUNDARY,
  FORBIDDEN_ACTIONS
};

if (require.main === module) {
  const command = process.argv[2] || 'status';
  const result = runPracticalConsole(command, {
    rawData: {
      packageVersion: CONSOLE_VERSION,
      repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
      actions: { status: 'success', conclusion: 'success', jobResults: [] },
      verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
      providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
    },
    sessionGoal: 'v4.0.0 Practical Console demo'
  });
  if (command === 'approval-board') {
    console.log(result.board.boardSummary);
  } else if (command === 'handoff') {
    console.log(result.handoffResult.handoffNote);
  } else {
    console.log(JSON.stringify({
      console: result.console,
      command: result.command,
      recommendation: result.recommendation,
      risk: result.risk,
      humanApprovalRequired: result.humanApprovalRequired,
      nextAction: result.nextAction,
      topPriority: result.decisionPacket && result.decisionPacket.topPriority
    }, null, 2));
  }
}
