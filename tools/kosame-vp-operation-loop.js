/**
 * Kosame VP Operation Loop v3.5.0
 *
 * こさめ副社長の標準operation loopを実行する統合エンジン。
 *
 * Loop:
 *   State Read → Decision Report → Safe Command Proposal
 *   → Human Approval Gate → Execution Review → Next Dispatch → Handoff
 */

const { createCombinedStateSnapshot } = require('./combined-state-snapshot');
const { generateAutoDecisionReport } = require('./auto-decision-report-generator');
const { generateSafeCommands } = require('./kosame-safe-command-generator');
const { extractApprovalItems } = require('./vp-human-approval-gate');
const { determineVpNextAction } = require('./vp-next-action-controller');
const { generateVpHandoffPacket } = require('./vp-handoff-packet');

const LOOP_VERSION = '3.5.0';

const LOOP_PHASES = [
  'state_read',
  'decision_report',
  'safe_command_proposal',
  'human_approval_gate',
  'execution_review',
  'next_dispatch',
  'handoff'
];

function runVpOperationLoop(loopInput = {}) {
  const {
    rawData = {},
    sessionGoal = '',
    executionResult = null,
    commandOperation = 'status',
    commandInput = {},
    session_id = '',
    skipPhases = []
  } = loopInput;

  const phases = {};

  // Phase 1: State Read
  if (!skipPhases.includes('state_read')) {
    phases.state_read = createCombinedStateSnapshot({ ...rawData, sessionGoal, session_id });
  }

  const snapshot = phases.state_read || rawData.snapshot || {};

  // Phase 2: Decision Report
  if (!skipPhases.includes('decision_report')) {
    phases.decision_report = generateAutoDecisionReport({ ...snapshot, sessionGoal, session_id });
  }

  // Phase 3: Safe Command Proposal
  if (!skipPhases.includes('safe_command_proposal')) {
    phases.safe_command_proposal = generateSafeCommands({
      operation: commandOperation,
      commitInput: commandInput,
      pushInput: commandInput,
      tagInput: commandInput,
      session_id
    });
  }

  // Phase 4: Human Approval Gate
  if (!skipPhases.includes('human_approval_gate')) {
    const decisionReports = phases.decision_report || {};
    phases.human_approval_gate = extractApprovalItems({
      push: decisionReports.push,
      release: decisionReports.release
    });
  }

  // Phase 5: Execution Review (if result provided)
  if (!skipPhases.includes('execution_review') && executionResult) {
    phases.execution_review = {
      provided: true,
      result: executionResult,
      note: 'Use vp-execution-review-packet for full review'
    };
  }

  // Phase 6: Next Action
  if (!skipPhases.includes('next_dispatch')) {
    phases.next_dispatch = determineVpNextAction({ ...snapshot, session_id });
  }

  // Phase 7: Handoff
  if (!skipPhases.includes('handoff')) {
    phases.handoff = generateVpHandoffPacket({
      session_id,
      sessionGoal,
      currentState: snapshot,
      nextRecommendedAction: phases.next_dispatch ? phases.next_dispatch.reason : '',
      pendingApprovals: phases.human_approval_gate && phases.human_approval_gate.hasItems
        ? phases.human_approval_gate.items.map(i => `${i.operation}: ${i.reason}`)
        : [],
      packageVersion: rawData.packageVersion || snapshot.packageVersion || 'unknown'
    });
  }

  const completedPhases = Object.keys(phases);
  const requiresHumanApproval = phases.human_approval_gate && phases.human_approval_gate.hasItems;

  return {
    loop: 'kosame-vp-operation-loop',
    loop_version: LOOP_VERSION,
    session_id,
    sessionGoal,
    phases,
    completedPhases,
    loopPhases: LOOP_PHASES,
    primaryNextAction: phases.next_dispatch ? phases.next_dispatch.action : 'unknown',
    requiresHumanApproval: !!requiresHumanApproval,
    overallHealth: snapshot.overallHealth || 'unknown',
    version: LOOP_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { runVpOperationLoop, LOOP_VERSION, LOOP_PHASES };

if (require.main === module) {
  const result = runVpOperationLoop({
    rawData: {
      packageVersion: '3.5.0',
      repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
      actions: { status: 'success', conclusion: 'success', jobResults: [] },
      verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
      providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
    },
    sessionGoal: 'v3.5.0 release preparation',
    commandOperation: 'status'
  });
  console.log(JSON.stringify({
    loop: result.loop,
    primaryNextAction: result.primaryNextAction,
    requiresHumanApproval: result.requiresHumanApproval,
    overallHealth: result.overallHealth,
    completedPhases: result.completedPhases
  }, null, 2));
}
