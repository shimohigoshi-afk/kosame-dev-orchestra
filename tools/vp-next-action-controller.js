/**
 * VP Next Action Controller v3.5.0
 *
 * Returns exactly ONE highest-priority next action for こさめ副社長.
 * Input: Combined State Snapshot (v3.2.0).
 */

const VP_ACTIONS = {
  FIX_VERIFY: 'fix_verify',
  TRIAGE_ACTIONS: 'triage_actions',
  RUN_VERIFY: 'run_verify',
  COMMIT: 'run_commit_check',
  PUSH: 'request_push_approval',
  RELEASE: 'request_release_approval',
  WAIT_ACTIONS: 'wait_for_actions',
  READ_STATE: 'read_current_state',
  IDLE: 'idle'
};

function determineVpNextAction(snapshot = {}) {
  const {
    verifyStatus = 'not_run',
    actionsStatus = 'unknown',
    workingTreeClean = true,
    isAhead = false,
    overallHealth = 'unknown',
    issueCount = 0,
    session_id = ''
  } = snapshot;

  let action = VP_ACTIONS.IDLE;
  let priority = 'low';
  let reason = '';
  let requiresHumanApproval = false;

  if (verifyStatus === 'failed' || verifyStatus === 'timeout') {
    action = VP_ACTIONS.FIX_VERIFY;
    priority = 'high';
    reason = `verify ${verifyStatus} — Claude係長修正が最優先`;
    requiresHumanApproval = false;
  } else if (actionsStatus === 'failed') {
    action = VP_ACTIONS.TRIAGE_ACTIONS;
    priority = 'high';
    reason = 'GitHub Actions FAILED — トリアージ最優先';
    requiresHumanApproval = false;
  } else if (!workingTreeClean && verifyStatus !== 'passed') {
    action = VP_ACTIONS.RUN_VERIFY;
    priority = 'normal';
    reason = '未コミット変更あり + verify未実行 — npm run verifyを実行';
    requiresHumanApproval = false;
  } else if (!workingTreeClean && verifyStatus === 'passed') {
    action = VP_ACTIONS.COMMIT;
    priority = 'normal';
    reason = 'verify済み変更あり — commit-checkを実行';
    requiresHumanApproval = false;
  } else if (isAhead && verifyStatus === 'passed') {
    action = VP_ACTIONS.PUSH;
    priority = 'normal';
    reason = 'origin先行 + verify PASS — じゅんやさんYESでpush';
    requiresHumanApproval = true;
  } else if (actionsStatus === 'success' && verifyStatus === 'passed' && workingTreeClean && !isAhead) {
    action = VP_ACTIONS.RELEASE;
    priority = 'low';
    reason = '全グリーン — じゅんやさんYESでrelease候補';
    requiresHumanApproval = true;
  } else if (actionsStatus === 'pending') {
    action = VP_ACTIONS.WAIT_ACTIONS;
    priority = 'low';
    reason = 'GitHub Actions pending — 完了を待機';
    requiresHumanApproval = false;
  } else if (overallHealth === 'unknown' || verifyStatus === 'not_run') {
    action = VP_ACTIONS.READ_STATE;
    priority = 'low';
    reason = '状態不明 — 現在状態を読み取り';
    requiresHumanApproval = false;
  }

  return {
    controller: 'vp-next-action-controller',
    session_id,
    action,
    priority,
    reason,
    requiresHumanApproval,
    snapshot_health: overallHealth,
    available_actions: VP_ACTIONS,
    version: '3.5.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { determineVpNextAction, VP_ACTIONS };

if (require.main === module) {
  const result = determineVpNextAction({
    verifyStatus: 'passed',
    actionsStatus: 'success',
    workingTreeClean: true,
    isAhead: false,
    overallHealth: 'healthy'
  });
  console.log(JSON.stringify(result, null, 2));
}
