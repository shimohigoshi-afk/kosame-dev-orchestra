/**
 * Kosame Operating Decision Packet v3.0.0
 *
 * Generates a concise operating decision packet summarizing current state,
 * recommended action, and next steps for こさめ副社長.
 */

const { evaluateReleaseGate } = require('./release-gate-controller');
const { lookupCommand } = require('./operating-console-command-map');

function generateOperatingDecisionPacket(packetInput = {}) {
  const {
    currentState = {},
    pendingDecisions = [],
    sessionGoal = '',
    recentActions = [],
    session_id = ''
  } = packetInput;

  const {
    actionsStatus = 'unknown',
    verifyStatus = 'not_run',
    workingTreeClean = true,
    isAhead = false,
    overallHealth = 'unknown',
    packageVersion = 'unknown'
  } = currentState;

  // Derive primary recommendation
  let primaryAction = 'wait_for_instruction';
  let primaryReason = 'Stable state.';
  let urgency = 'low';

  if (verifyStatus === 'failed') {
    primaryAction = 'run_claude_repair';
    primaryReason = 'verify FAILED — Claude係長修正必要。';
    urgency = 'high';
  } else if (actionsStatus === 'failed') {
    primaryAction = 'triage_actions_failure';
    primaryReason = 'GitHub Actions FAILED — トリアージ必要。';
    urgency = 'high';
  } else if (!workingTreeClean && verifyStatus !== 'passed') {
    primaryAction = 'run_verify';
    primaryReason = '未コミット変更あり + verify未実行 → npm run verify 先に実行。';
    urgency = 'normal';
  } else if (!workingTreeClean && verifyStatus === 'passed') {
    primaryAction = 'run_commit_check';
    primaryReason = 'verify済み変更あり → commit-check を実行。';
    urgency = 'normal';
  } else if (isAhead) {
    primaryAction = 'run_push_check';
    primaryReason = 'originより進んでいる → push-check を実行。';
    urgency = 'normal';
  } else if (actionsStatus === 'success' && verifyStatus === 'passed') {
    primaryAction = 'run_release_check';
    primaryReason = '全グリーン → release-check を実行。';
    urgency = 'low';
  }

  const commandMeta = lookupCommand(primaryAction.replace('run_', '').replace('_', '-')) || null;

  const humanApprovalPending = pendingDecisions.filter(d => d.requiresHumanApproval);

  return {
    packet: 'kosame-operating-decision-packet',
    session_id,
    sessionGoal,
    packageVersion,
    overallHealth,
    primaryAction,
    primaryReason,
    urgency,
    suggestedCommand: primaryAction.startsWith('run_') ? primaryAction.replace('run_', '') : null,
    commandMeta,
    pendingDecisions,
    humanApprovalPending,
    humanApprovalRequired: humanApprovalPending.length > 0,
    recentActions,
    currentState,
    version: '3.0.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateOperatingDecisionPacket };

if (require.main === module) {
  const result = generateOperatingDecisionPacket({
    currentState: {
      actionsStatus: 'success',
      verifyStatus: 'passed',
      workingTreeClean: true,
      isAhead: false,
      overallHealth: 'healthy',
      packageVersion: '3.0.0'
    },
    sessionGoal: 'Release v3.0.0',
    pendingDecisions: []
  });
  console.log(JSON.stringify(result, null, 2));
}
