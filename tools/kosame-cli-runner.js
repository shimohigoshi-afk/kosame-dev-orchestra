'use strict';
/**
 * Kosame CLI Runner v3.6.0
 *
 * Cloud Shell 人間読み取り用 CLIランナー。
 * こさめ副社長が npm run kosame:<command> で呼び出す統合インターフェース。
 * すべて dryRun: true — 実行ではなく「判断と安全コマンド案表示」まで。
 */

const { createCombinedStateSnapshot } = require('./combined-state-snapshot');
const { generateAutoDecisionReport } = require('./auto-decision-report-generator');
const { determineVpNextAction } = require('./vp-next-action-controller');
const { generateVpHandoffPacket } = require('./vp-handoff-packet');
const { extractApprovalItems } = require('./vp-human-approval-gate');

const RUNNER_VERSION = '3.6.0';

const FORBIDDEN_ACTIONS = [
  'rm -rf',
  'git reset --hard',
  'git clean -f',
  'cat .env / Secret閲覧 / APIキー直接アクセス',
  'gcloud run deploy',
  'docker build',
  'fetch() / curl 外部APIコール',
  '課金API実行',
  '無承認 git push origin main',
  '無承認 git tag vX.Y.Z'
];

const COMMANDS = ['status', 'commit-check', 'push-check', 'release-check', 'dispatch', 'approval', 'handoff', 'next'];

const DEMO_RAW_DATA = {
  packageVersion: RUNNER_VERSION,
  repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
  actions: { status: 'success', conclusion: 'success', jobResults: [] },
  verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
  providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
};

function runCliCommand(command = 'status', cliInput = {}) {
  const {
    rawData = {},
    sessionGoal = '',
    session_id = `cli-${Date.now()}`
  } = cliInput;

  const snapshot = createCombinedStateSnapshot({ ...rawData, sessionGoal, session_id });
  const decisionReport = generateAutoDecisionReport({ ...snapshot, sessionGoal, session_id });
  const nextActionResult = determineVpNextAction({ ...snapshot, session_id });
  const approvalGate = extractApprovalItems({
    push: decisionReport.push,
    release: decisionReport.release
  });

  let recommendation = 'HOLD';
  let reason = '状態不明';
  let risk = 'unknown';
  let safeCommandSuggestion = [];
  let humanApprovalRequired = false;
  let additionalInfo = {};

  switch (command) {
    case 'status': {
      const health = snapshot.overallHealth || 'unknown';
      recommendation = health === 'healthy' ? 'YES' : health === 'degraded' ? 'HOLD' : 'NO';
      reason = `overallHealth: ${health} | verifyStatus: ${snapshot.verifyStatus} | actionsStatus: ${snapshot.actionsStatus}`;
      risk = health === 'healthy' ? 'low' : health === 'degraded' ? 'medium' : 'high';
      safeCommandSuggestion = ['git status -sb', 'git log --oneline -5', 'npm run verify', 'gh run list --limit 3'];
      humanApprovalRequired = false;
      break;
    }
    case 'commit-check': {
      const cr = decisionReport.commit || {};
      recommendation = cr.recommendation || 'HOLD';
      reason = cr.reason || 'commit判断できません';
      humanApprovalRequired = cr.humanApprovalRequired || false;
      risk = recommendation === 'YES' ? 'low' : 'medium';
      safeCommandSuggestion = recommendation === 'YES'
        ? ['npm run verify', 'git status -sb', 'git diff --stat', 'git add <files>', 'git commit -m "<message>"']
        : ['npm run verify'];
      break;
    }
    case 'push-check': {
      const pr = decisionReport.push || {};
      recommendation = pr.recommendation || 'HOLD';
      reason = pr.reason || 'push判断できません';
      humanApprovalRequired = true;
      risk = 'high';
      safeCommandSuggestion = ['git status -sb', 'git log origin/main..HEAD --oneline', 'git diff --stat'];
      break;
    }
    case 'release-check': {
      const rr = decisionReport.release || {};
      recommendation = rr.recommendation || 'HOLD';
      reason = rr.reason || 'release判断できません';
      humanApprovalRequired = true;
      risk = 'high';
      safeCommandSuggestion = ['gh run list --limit 3', 'git log --oneline -3', 'git tag --list'];
      break;
    }
    case 'dispatch': {
      const dr = decisionReport.dispatch || {};
      recommendation = dr.recommendation || 'HOLD';
      reason = dr.reason || 'dispatch判断できません';
      humanApprovalRequired = false;
      risk = 'low';
      safeCommandSuggestion = ['node tools/auto-decision-report-generator.js'];
      additionalInfo = { target: dr.target || 'unknown' };
      break;
    }
    case 'approval': {
      recommendation = approvalGate.hasItems ? 'YES' : 'HOLD';
      reason = approvalGate.summary || '承認待ちなし';
      humanApprovalRequired = approvalGate.hasItems;
      risk = approvalGate.hasItems ? 'high' : 'low';
      safeCommandSuggestion = approvalGate.hasItems
        ? approvalGate.items.map(i => `# ${i.operation}: じゅんやさんYESが必要`)
        : ['npm run kosame:status'];
      additionalInfo = { itemCount: approvalGate.itemCount, items: approvalGate.items };
      break;
    }
    case 'handoff': {
      const handoffResult = generateVpHandoffPacket({
        session_id,
        sessionGoal,
        currentState: snapshot,
        nextRecommendedAction: nextActionResult.reason,
        pendingApprovals: approvalGate.hasItems
          ? approvalGate.items.map(i => `${i.operation}: ${i.reason}`)
          : [],
        packageVersion: rawData.packageVersion || snapshot.packageVersion || 'unknown'
      });
      recommendation = handoffResult.readyForHandoff ? 'YES' : 'HOLD';
      reason = handoffResult.readyForHandoff ? '引継ぎ準備完了' : '引継ぎ前に確認事項あり';
      humanApprovalRequired = false;
      risk = 'low';
      safeCommandSuggestion = ['node tools/vp-handoff-packet.js'];
      additionalInfo = { readyForHandoff: handoffResult.readyForHandoff };
      break;
    }
    case 'next': {
      recommendation = nextActionResult.action ? 'YES' : 'HOLD';
      reason = nextActionResult.reason || '次アクション未決定';
      humanApprovalRequired = nextActionResult.requiresHumanApproval || false;
      risk = nextActionResult.priority === 'high' ? 'high' : nextActionResult.priority === 'normal' ? 'medium' : 'low';
      safeCommandSuggestion = [`npm run kosame:${nextActionResult.action || 'status'}`];
      additionalInfo = { action: nextActionResult.action, priority: nextActionResult.priority };
      break;
    }
    default: {
      recommendation = 'HOLD';
      reason = `未知のコマンド: ${command}`;
      risk = 'unknown';
      safeCommandSuggestion = ['npm run kosame:status'];
    }
  }

  return {
    runner: 'kosame-cli-runner',
    command,
    recommendation,
    reason,
    risk,
    humanApprovalRequired,
    nextAction: nextActionResult.action || 'read_current_state',
    safeCommandSuggestion,
    forbiddenActions: FORBIDDEN_ACTIONS,
    overallHealth: snapshot.overallHealth || 'unknown',
    session_id,
    additionalInfo,
    version: RUNNER_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

function formatCliOutput(result) {
  const line = '─'.repeat(52);
  const lines = [
    line,
    `KOSAME ${result.command.toUpperCase()}  [v${result.version}]`,
    line,
    `  recommendation  : ${result.recommendation}`,
    `  reason          : ${result.reason}`,
    `  risk            : ${result.risk}`,
    `  humanApproval   : ${result.humanApprovalRequired}`,
    `  nextAction      : ${result.nextAction}`,
    `  overallHealth   : ${result.overallHealth}`,
    '',
    '  Safe Commands:',
    ...result.safeCommandSuggestion.map(c => `    $ ${c}`),
    '',
    '  FORBIDDEN (絶対実行禁止):',
    ...result.forbiddenActions.slice(0, 4).map(f => `    ✗ ${f}`),
    `    ... (+${result.forbiddenActions.length - 4} more)`,
    line
  ];
  return lines.join('\n');
}

module.exports = { runCliCommand, formatCliOutput, RUNNER_VERSION, COMMANDS, FORBIDDEN_ACTIONS };

if (require.main === module) {
  const command = process.argv[2] || 'status';
  const result = runCliCommand(command, {
    rawData: DEMO_RAW_DATA,
    sessionGoal: 'v3.6.0 CLI Runner demo'
  });
  console.log(formatCliOutput(result));
}
