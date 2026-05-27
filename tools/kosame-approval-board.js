'use strict';
/**
 * Kosame Approval Board Practical Console v3.8.0
 *
 * commit / push / tag / release / dispatch / handoff の承認状態を
 * 1つのBoardにまとめ、じゅんやさんのYES圧縮サマリーを生成する。
 */

const BOARD_VERSION = '3.8.0';

const OPERATIONS = ['commit', 'push', 'tag', 'release', 'dispatch', 'handoff'];

const DANGEROUS_ACTIONS = {
  commit: [],
  push: ['git push origin main (リモートに影響)'],
  tag: ['git tag vX.Y.Z', 'git push origin vX.Y.Z'],
  release: ['git tag vX.Y.Z', 'git push origin vX.Y.Z', 'GitHub Release作成'],
  dispatch: [],
  handoff: []
};

const REQUIRED_EVIDENCE = {
  commit: ['verifyStatus === passed', 'uncommitted files exist'],
  push: ['verifyStatus === passed', 'workingTreeClean', 'isAhead'],
  tag: ['actionsStatus === success', 'verifyStatus === passed', 'workingTreeClean', 'release docs exist'],
  release: ['actionsStatus === success', 'verifyStatus === passed', 'workingTreeClean', '!isAhead', 'release docs exist'],
  dispatch: ['snapshot available'],
  handoff: ['openIssues empty', 'verifyStatus !== failed']
};

function buildBoardRow(operation, snapshot = {}, customData = {}) {
  const {
    verifyStatus = 'not_run',
    actionsStatus = 'unknown',
    workingTreeClean = true,
    isAhead = false,
    hasUncommittedChanges = false,
    releaseDocsExist = false,
    openIssues = []
  } = snapshot;

  let recommendation = 'HOLD';
  let reason = '';
  let humanApprovalRequired = false;
  let safeNextStep = '';

  switch (operation) {
    case 'commit':
      if (verifyStatus === 'passed' && hasUncommittedChanges) {
        recommendation = 'YES';
        reason = 'verify PASS + 未コミット変更あり';
        safeNextStep = 'git add <files> && git commit -m "<message>"';
      } else if (verifyStatus !== 'passed') {
        recommendation = 'HOLD';
        reason = 'verify未実行/FAIL — npm run verifyを先に実行';
        safeNextStep = 'npm run verify';
      } else {
        recommendation = 'HOLD';
        reason = 'コミット対象の変更なし';
        safeNextStep = 'git status -sb';
      }
      humanApprovalRequired = false;
      break;

    case 'push':
      humanApprovalRequired = true;
      if (workingTreeClean && verifyStatus === 'passed' && isAhead) {
        recommendation = 'YES';
        reason = 'verify PASS / clean tree / origin先行 — じゅんやさんYES待ち';
        safeNextStep = 'git log origin/main..HEAD --oneline';
      } else if (!workingTreeClean) {
        recommendation = 'NO';
        reason = '未コミット変更あり — commitを先に';
        safeNextStep = 'npm run kosame:commit-check';
      } else if (!isAhead) {
        recommendation = 'HOLD';
        reason = 'origin先行なし — pushするものがない';
        safeNextStep = 'git log --oneline -5';
      } else {
        recommendation = 'HOLD';
        reason = 'verify未実行/FAIL';
        safeNextStep = 'npm run verify';
      }
      break;

    case 'tag':
      humanApprovalRequired = true;
      if (actionsStatus === 'success' && verifyStatus === 'passed' && workingTreeClean && !isAhead) {
        recommendation = 'YES';
        reason = 'Actions success / verify PASS / clean — じゅんやさんYES待ち';
        safeNextStep = 'git tag --list && git log --oneline -3';
      } else if (actionsStatus === 'failed') {
        recommendation = 'NO';
        reason = 'GitHub Actions FAIL — tagは不可';
        safeNextStep = 'gh run list --limit 3';
      } else {
        recommendation = 'HOLD';
        reason = '条件未達 (actions/verify/tree確認)';
        safeNextStep = 'npm run kosame:status';
      }
      break;

    case 'release':
      humanApprovalRequired = true;
      if (actionsStatus === 'success' && verifyStatus === 'passed' && workingTreeClean && !isAhead && releaseDocsExist) {
        recommendation = 'YES';
        reason = '全グリーン + release docs確認済み — じゅんやさんYES待ち';
        safeNextStep = 'git tag -a vX.Y.Z && git push origin vX.Y.Z';
      } else if (actionsStatus === 'failed') {
        recommendation = 'NO';
        reason = 'GitHub Actions FAIL — release不可';
        safeNextStep = 'gh run list --limit 3';
      } else {
        recommendation = 'HOLD';
        reason = 'release条件未達';
        safeNextStep = 'npm run kosame:release-check';
      }
      break;

    case 'dispatch':
      recommendation = 'YES';
      reason = 'こさめ副社長がClaude/Gemini/Cloud Shellへ指示可能';
      humanApprovalRequired = false;
      safeNextStep = 'node tools/auto-decision-report-generator.js';
      break;

    case 'handoff':
      if (openIssues.length === 0 && verifyStatus !== 'failed') {
        recommendation = 'YES';
        reason = '未解決事項なし — 引継ぎ準備完了';
        safeNextStep = 'node tools/vp-handoff-packet.js';
      } else {
        recommendation = 'HOLD';
        reason = `未解決事項: ${openIssues.length}件 or verify FAIL`;
        safeNextStep = 'npm run kosame:status';
      }
      humanApprovalRequired = false;
      break;
  }

  return {
    operation,
    recommendation,
    reason,
    requiredEvidence: REQUIRED_EVIDENCE[operation] || [],
    humanApprovalRequired,
    dangerousActions: DANGEROUS_ACTIONS[operation] || [],
    safeNextStep
  };
}

function buildApprovalBoard(boardInput = {}) {
  const {
    snapshot = {},
    session_id = '',
    sessionGoal = '',
    customRows = {}
  } = boardInput;

  const rows = OPERATIONS.map(op => buildBoardRow(op, snapshot, customRows[op] || {}));

  // Human YES compression
  const needsJunyaYes = rows.filter(r => r.humanApprovalRequired && r.recommendation === 'YES');
  const cannotYes = rows.filter(r => r.recommendation === 'NO');
  const aiCanContinue = rows.filter(r => !r.humanApprovalRequired && r.recommendation === 'YES');
  const cloudShellCheck = rows.filter(r => r.recommendation === 'HOLD');

  const boardSummary = [
    `## 承認Board サマリー`,
    ``,
    `### じゅんやさんがYESする必要があるもの (${needsJunyaYes.length}件)`,
    needsJunyaYes.length > 0
      ? needsJunyaYes.map(r => `- **${r.operation}**: ${r.reason}`).join('\n')
      : '- なし',
    ``,
    `### YESしてはいけないもの (${cannotYes.length}件)`,
    cannotYes.length > 0
      ? cannotYes.map(r => `- **${r.operation}**: ${r.reason}`).join('\n')
      : '- なし',
    ``,
    `### AI側で続行できるもの (${aiCanContinue.length}件)`,
    aiCanContinue.length > 0
      ? aiCanContinue.map(r => `- **${r.operation}**: ${r.reason}`).join('\n')
      : '- なし',
    ``,
    `### Cloud Shellで確認すべきもの (${cloudShellCheck.length}件)`,
    cloudShellCheck.length > 0
      ? cloudShellCheck.map(r => `- **${r.operation}**: ${r.safeNextStep}`).join('\n')
      : '- なし'
  ].join('\n');

  return {
    board: 'kosame-approval-board',
    session_id,
    sessionGoal,
    rows,
    humanYesCompression: {
      needsJunyaYes: needsJunyaYes.map(r => r.operation),
      cannotYes: cannotYes.map(r => r.operation),
      aiCanContinue: aiCanContinue.map(r => r.operation),
      cloudShellCheck: cloudShellCheck.map(r => r.operation)
    },
    boardSummary,
    totalItems: rows.length,
    requiresJunyaYes: needsJunyaYes.length > 0,
    version: BOARD_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { buildApprovalBoard, buildBoardRow, BOARD_VERSION, OPERATIONS, DANGEROUS_ACTIONS };

if (require.main === module) {
  const result = buildApprovalBoard({
    snapshot: {
      verifyStatus: 'passed',
      actionsStatus: 'success',
      workingTreeClean: true,
      isAhead: false,
      hasUncommittedChanges: false,
      releaseDocsExist: true,
      openIssues: []
    },
    sessionGoal: 'v3.8.0 demo',
    session_id: 'demo-001'
  });
  console.log(result.boardSummary);
  console.log('\nhumanYesCompression:', JSON.stringify(result.humanYesCompression, null, 2));
}
