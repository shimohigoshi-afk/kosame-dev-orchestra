/**
 * Dispatch Decision Report v3.3.0
 *
 * Derives next dispatch target (Claude / Gemini / Cloud Shell / Human Approval)
 * from Combined State Snapshot.
 */

const TARGETS = {
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  CLOUD_SHELL: 'cloud_shell',
  HUMAN: 'human_approval',
  HOLD: 'hold'
};

function generateDispatchDecisionReport(snapshot = {}) {
  const {
    verifyStatus = 'not_run',
    actionsStatus = 'unknown',
    overallHealth = 'unknown',
    workingTreeClean = true,
    isAhead = false,
    geminiAvailable = false,
    issueCount = 0,
    session_id = '',
    taskHints = {}
  } = snapshot;

  const {
    needsRepair = false,
    needsBulkGen = false,
    needsArchitecture = false,
    riskLevel = 'Low',
    dangerousActionsPresent = false
  } = taskHints;

  let target = TARGETS.HOLD;
  let reason = '';
  let nextInstructions = [];

  if (riskLevel === 'Critical' || dangerousActionsPresent) {
    target = TARGETS.HUMAN;
    reason = 'Critical/dangerous operation — じゅんやさんYES必要';
    nextInstructions = ['Generate approval packet', 'Present to じゅんやさん'];
  } else if (verifyStatus === 'failed' || needsRepair) {
    target = TARGETS.CLAUDE;
    reason = 'Repair/fix task — Claude係長が修正';
    nextInstructions = ['Claude係長にrepair-intake送付', 'fix → verify loopを実行'];
  } else if (actionsStatus === 'failed') {
    target = TARGETS.CLAUDE;
    reason = 'Actions failure triage — Claude係長で調査';
    nextInstructions = ['GitHub Actions logを確認', 'Claude係長にtriage依頼'];
  } else if (needsBulkGen && geminiAvailable) {
    target = TARGETS.GEMINI;
    reason = 'Bulk generation — Gemini課長が担当';
    nextInstructions = ['Gemini bulk promptを準備', '結果をClaude係長にreview依頼'];
  } else if (needsArchitecture) {
    target = TARGETS.CLAUDE;
    reason = 'Architecture/design task — Claude係長が設計';
    nextInstructions = ['Claude係長に設計依頼', '承認後に実装'];
  } else if (needsBulkGen && !geminiAvailable) {
    target = TARGETS.CLAUDE;
    reason = 'Bulk gen requested / Gemini unavailable → Claude係長fallback';
    nextInstructions = ['Claude係長にbulk gen依頼', 'token使用量に注意'];
  } else if (riskLevel === 'High' || (isAhead && actionsStatus === 'success')) {
    target = TARGETS.HUMAN;
    reason = 'High-risk or release-ready action — じゅんやさん確認';
    nextInstructions = ['承認サマリを生成', 'じゅんやさんへ提示'];
  } else if (!workingTreeClean && verifyStatus === 'passed') {
    target = TARGETS.CLOUD_SHELL;
    reason = 'Commit-ready changes — Cloud Shellでcommit実行';
    nextInstructions = ['kosame:commit-check を実行', '安全commit commandを生成'];
  } else {
    target = TARGETS.CLAUDE;
    reason = 'Standard task — Claude係長で実装';
    nextInstructions = ['Claude係長にタスク依頼', 'verify後にcommit'];
  }

  return {
    report: 'dispatch-decision-report',
    session_id,
    target,
    reason,
    nextInstructions,
    verifyStatus,
    actionsStatus,
    geminiAvailable,
    riskLevel,
    humanApprovalRequired: target === TARGETS.HUMAN,
    targets: TARGETS,
    version: '3.3.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateDispatchDecisionReport, TARGETS };

if (require.main === module) {
  const result = generateDispatchDecisionReport({
    verifyStatus: 'passed',
    actionsStatus: 'success',
    workingTreeClean: false,
    isAhead: false,
    geminiAvailable: false,
    taskHints: { needsRepair: false, riskLevel: 'Low' }
  });
  console.log(JSON.stringify(result, null, 2));
}
