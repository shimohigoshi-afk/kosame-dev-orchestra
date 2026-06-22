#!/usr/bin/env node
'use strict';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOutcome(value) {
  const text = normalizeText(value).toUpperCase();
  if (!text) return 'unknown';
  if (text.includes('PASS')) return 'PASS';
  if (text.includes('FAIL')) return 'FAIL';
  return 'unknown';
}

function clamp(text, maxLength = 160) {
  const value = normalizeText(text);
  if (!value) return '';
  if (!Number.isFinite(maxLength) || maxLength <= 0 || value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function summarizeDecision(decision) {
  const current = decision && typeof decision === 'object' ? decision : {};
  const approvalCount = Number.isFinite(Number(current.approval_request_count ?? current.yes_count)) ? Number(current.approval_request_count ?? current.yes_count) : 0;
  const manualPasteCount = Number.isFinite(Number(current.manual_paste_count ?? current.copy_count)) ? Number(current.manual_paste_count ?? current.copy_count) : 0;
  const waitCount = Number.isFinite(Number(current.wait_request_count ?? current.human_wait)) ? Number(current.wait_request_count ?? current.human_wait) : 0;
  const autoApprovedCount = Number.isFinite(Number(current.auto_approved_count ?? current.autoApprovedCount)) ? Number(current.auto_approved_count ?? current.autoApprovedCount) : 0;
  const autoBlockedCount = Number.isFinite(Number(current.auto_blocked_count ?? current.autoBlockedCount)) ? Number(current.auto_blocked_count ?? current.autoBlockedCount) : 0;
  const retryCount = Number.isFinite(Number(current.retry_count ?? current.retryCount)) ? Number(current.retry_count ?? current.retryCount) : 0;
  const executionHost = normalizeText(current.execution_host || current.executionHost || '');
  const executionHostAllowed = current.execution_host_allowed ?? current.executionHostAllowed;
  const interactiveHostBlocked = current.interactive_host_blocked ?? current.interactiveHostBlocked;
  const noYesGateRuntime = current.no_yes_gate_runtime ?? current.noYesGateRuntime;
  const safeSpawnActive = current.safe_spawn_active ?? current.safeSpawnActive;
  const manualCodeUiAllowed = current.manual_code_ui_allowed ?? current.manualCodeUiAllowed;
  const officialRoute = normalizeText(current.official_route || current.officialRoute || '');
  const promptOrigin = normalizeText(current.prompt_origin || current.promptOrigin || '');
  const blockedReason = normalizeText(current.blocked_reason || current.blockedReason || '');
  const routerDecision = normalizeText(current.router_decision || current.routerDecision || current.orchestra_evidence?.router_decision || '');
  const assignedLanes = Array.isArray(current.assigned_lanes)
    ? current.assigned_lanes.join(' | ')
    : Array.isArray(current.orchestra_evidence?.assigned_lanes)
      ? current.orchestra_evidence.assigned_lanes.join(' | ')
      : '';
  const laneStatuses = Array.isArray(current.lane_statuses)
    ? current.lane_statuses.map((lane) => `${lane.label || lane.id || 'lane'}=${lane.status || 'active'}`).join(' / ')
    : Array.isArray(current.orchestra_evidence?.lane_statuses)
      ? current.orchestra_evidence.lane_statuses.map((lane) => `${lane.label || lane.id || 'lane'}=${lane.status || 'active'}`).join(' / ')
      : '';
  const parts = [
    `status=${normalizeText(current.decision_status || current.nextRecommendedAction || 'wait_for_result')}`,
    `next=${normalizeText(current.nextRecommendedAction || 'wait_for_result')}`,
    `executor=${normalizeText(current.executor || current.assigned_agent || 'Codex')}`,
    `route=${normalizeText(current.route || 'zero-confirm')}`,
    `resultPOST=${normalizeText(current.result_post || current.resultPOST || 'POST /api/work-orders/result 200')}`,
    `executionHost=${executionHost || '—'}`,
    `executionHostAllowed=${executionHostAllowed !== false ? 'true' : 'false'}`,
    `interactiveHostBlocked=${interactiveHostBlocked ? 'true' : 'false'}`,
    `noYesGateRuntime=${noYesGateRuntime !== false ? 'true' : 'false'}`,
    `safeSpawnActive=${safeSpawnActive !== false ? 'true' : 'false'}`,
    `manualCodeUiAllowed=${manualCodeUiAllowed ? 'true' : 'false'}`,
    `officialRoute=${officialRoute || 'Console → Handoff → Runner'}`,
    `humanGate=${current.human_gate_required ? 'yes' : 'no'}`,
    `commitTagPush=${current.commit_tag_push_allowed ? 'candidate' : 'hold'}`,
    `承認要求回数=${approvalCount}`,
    `手動貼付回数=${manualPasteCount}`,
    `待機要求回数=${waitCount}`,
    `自動YES回数=${autoApprovedCount}`,
    `自動遮断回数=${autoBlockedCount}`,
    `retryCount=${retryCount}`,
  ];
  if (routerDecision) parts.push(`routerDecision=${routerDecision}`);
  if (promptOrigin) parts.push(`promptOrigin=${promptOrigin}`);
  if (blockedReason) parts.push(`blockedReason=${blockedReason}`);
  if (assignedLanes) parts.push(`assignedLanes=${assignedLanes}`);
  if (laneStatuses) parts.push(`laneStatuses=${laneStatuses}`);
  const reason = clamp(current.reason || current.summary || '', 120);
  if (reason) parts.push(`reason=${reason}`);
  const required = clamp(current.required_next_work || '', 80);
  if (required) parts.push(`required=${required}`);
  return parts.join(' / ');
}

function buildDecisionBase(status, smoke, verify) {
  if (status === 'safety_stop') {
    return {
      decision_status: 'safety_stop',
      nextRecommendedAction: 'safety_stop',
      reason: 'Safety Stop が検出されました。',
      required_next_work: '安全条件を確認してから official route で再投入する',
      human_gate_required: true,
      commit_tag_push_allowed: false,
      activity_status: 'blocked',
    };
  }

  if (status === 'blocked_interactive_host' || status === 'blocked_by_interactive_prompt' || status === 'blocked') {
    return {
      decision_status: status === 'blocked_interactive_host' ? 'blocked_interactive_host' : 'blocked_by_interactive_prompt',
      nextRecommendedAction: status === 'blocked_interactive_host' ? 'blocked_interactive_host' : 'blocked_by_interactive_prompt',
      reason: status === 'blocked_interactive_host'
        ? 'interactive host が正規実行ルートから隔離されました。'
        : 'interactive prompt が検出され、ユーザー入力待ちにせず遮断しました。',
      required_next_work: 'KOSAME Console から再投入し、official route で実行する',
      human_gate_required: true,
      commit_tag_push_allowed: false,
      activity_status: 'blocked',
    };
  }

  if (status === 'needs_fix') {
    return {
      decision_status: 'request_fix',
      nextRecommendedAction: 'request_fix',
      reason: '修正依頼が必要です。',
      required_next_work: '修正内容を整理して再依頼する',
      human_gate_required: true,
      commit_tag_push_allowed: false,
      activity_status: 'human_gate',
    };
  }

  if (status === 'failed' || smoke === 'FAIL' || verify === 'FAIL') {
    return {
      decision_status: 'stop_and_investigate',
      nextRecommendedAction: 'stop_and_investigate',
      reason: 'failed または smoke と verify に FAIL があるため、先に原因調査が必要です。',
      required_next_work: '原因調査と切り分けを行う',
      human_gate_required: true,
      commit_tag_push_allowed: false,
      activity_status: 'blocked',
    };
  }

  if (status === 'success' && smoke === 'PASS' && verify === 'PASS') {
    return {
      decision_status: 'ready_for_commit',
      nextRecommendedAction: 'ready_for_commit',
      reason: '実装結果と smoke と verify がそろって PASS です。',
      required_next_work: 'commit 前 review と人間承認を待つ',
      human_gate_required: true,
      commit_tag_push_allowed: true,
      activity_status: 'human_gate',
    };
  }

  if (status === 'success') {
    return {
      decision_status: 'ready_for_review',
      nextRecommendedAction: 'ready_for_review',
      reason: '実装結果は PASS ですが、smoke / verify の確認がまだ揃っていません。',
      required_next_work: 'smoke と verify を確認してから commit 候補へ進める',
      human_gate_required: true,
      commit_tag_push_allowed: false,
      activity_status: 'human_gate',
    };
  }

  return {
    decision_status: 'wait_for_result',
    nextRecommendedAction: 'wait_for_result',
    reason: 'まだ実装結果が届いていません。',
    required_next_work: 'Handoff 済みの作業票から結果貼り戻しを待つ',
    human_gate_required: false,
    commit_tag_push_allowed: false,
    activity_status: 'waiting',
  };
}

function buildWorkOrderResultDecision(input = {}) {
  const latestWorkOrderResult = input.latestWorkOrderResult && typeof input.latestWorkOrderResult === 'object'
    ? input.latestWorkOrderResult
    : null;
  const latestHandoffWorkOrder = input.latestHandoffWorkOrder && typeof input.latestHandoffWorkOrder === 'object'
    ? input.latestHandoffWorkOrder
    : null;
  const latestApprovedWorkOrder = input.latestApprovedWorkOrder && typeof input.latestApprovedWorkOrder === 'object'
    ? input.latestApprovedWorkOrder
    : null;

  const hasResult = !!latestWorkOrderResult;
  const resultStatus = normalizeText(latestWorkOrderResult?.result_status || '').toLowerCase();
  const smoke = normalizeOutcome(latestWorkOrderResult?.smoke_result);
  const verify = normalizeOutcome(latestWorkOrderResult?.verify_result);
  const base = buildDecisionBase(resultStatus, smoke, verify);
  const workOrder = latestWorkOrderResult || latestHandoffWorkOrder || latestApprovedWorkOrder || {};
  const title = clamp(workOrder.title || latestWorkOrderResult?.title || latestHandoffWorkOrder?.title || latestApprovedWorkOrder?.title || '作業票', 120);
  const targetRepo = clamp(workOrder.target_repo || latestWorkOrderResult?.target_repo || latestHandoffWorkOrder?.target_repo || latestApprovedWorkOrder?.target_repo || '', 120);
  const assignedAgent = clamp(workOrder.assigned_agent || workOrder.recommended_agent || latestWorkOrderResult?.assigned_agent || latestHandoffWorkOrder?.assigned_agent || latestApprovedWorkOrder?.agent || latestApprovedWorkOrder?.recommended_agent || 'Codex', 60);
  const riskLevel = clamp(workOrder.risk_level || latestWorkOrderResult?.risk_level || latestHandoffWorkOrder?.risk_level || latestApprovedWorkOrder?.risk_level || 'low', 24);
  const executor = clamp(
    latestWorkOrderResult?.executor
    || latestHandoffWorkOrder?.executor
    || latestApprovedWorkOrder?.agent
    || assignedAgent
    || 'Codex',
    60
  );
  const resultPost = clamp(
    latestWorkOrderResult?.result_post
    || latestWorkOrderResult?.resultPOST
    || latestWorkOrderResult?.result_post_status
    || latestHandoffWorkOrder?.result_post
    || 'POST /api/work-orders/result 200',
    120
  );
  const route = clamp(
    latestWorkOrderResult?.route
    || latestHandoffWorkOrder?.route
    || latestApprovedWorkOrder?.route
    || 'zero-confirm',
    40
  );
  const promptType = clamp(
    latestWorkOrderResult?.prompt_type
    || latestWorkOrderResult?.promptType
    || latestHandoffWorkOrder?.prompt_type
    || '',
    40
  );
  const executionHost = clamp(
    latestWorkOrderResult?.execution_host
    || latestWorkOrderResult?.executionHost
    || latestHandoffWorkOrder?.execution_host
    || latestHandoffWorkOrder?.executionHost
    || latestApprovedWorkOrder?.execution_host
    || latestApprovedWorkOrder?.executionHost
    || 'kosame-runner',
    60
  );
  const executionHostAllowed = latestWorkOrderResult?.execution_host_allowed
    ?? latestWorkOrderResult?.executionHostAllowed
    ?? latestHandoffWorkOrder?.execution_host_allowed
    ?? latestHandoffWorkOrder?.executionHostAllowed
    ?? latestApprovedWorkOrder?.execution_host_allowed
    ?? latestApprovedWorkOrder?.executionHostAllowed;
  const interactiveHostBlocked = latestWorkOrderResult?.interactive_host_blocked
    ?? latestWorkOrderResult?.interactiveHostBlocked
    ?? latestHandoffWorkOrder?.interactive_host_blocked
    ?? latestHandoffWorkOrder?.interactiveHostBlocked
    ?? latestApprovedWorkOrder?.interactive_host_blocked
    ?? latestApprovedWorkOrder?.interactiveHostBlocked;
  const noYesGateRuntime = latestWorkOrderResult?.no_yes_gate_runtime
    ?? latestWorkOrderResult?.noYesGateRuntime
    ?? latestHandoffWorkOrder?.no_yes_gate_runtime
    ?? latestHandoffWorkOrder?.noYesGateRuntime
    ?? latestApprovedWorkOrder?.no_yes_gate_runtime
    ?? latestApprovedWorkOrder?.noYesGateRuntime;
  const safeSpawnActive = latestWorkOrderResult?.safe_spawn_active
    ?? latestWorkOrderResult?.safeSpawnActive
    ?? latestHandoffWorkOrder?.safe_spawn_active
    ?? latestHandoffWorkOrder?.safeSpawnActive
    ?? latestApprovedWorkOrder?.safe_spawn_active
    ?? latestApprovedWorkOrder?.safeSpawnActive;
  const manualCodeUiAllowed = latestWorkOrderResult?.manual_code_ui_allowed
    ?? latestWorkOrderResult?.manualCodeUiAllowed
    ?? latestHandoffWorkOrder?.manual_code_ui_allowed
    ?? latestHandoffWorkOrder?.manualCodeUiAllowed
    ?? latestApprovedWorkOrder?.manual_code_ui_allowed
    ?? latestApprovedWorkOrder?.manualCodeUiAllowed;
  const officialRoute = clamp(
    latestWorkOrderResult?.official_route
    || latestWorkOrderResult?.officialRoute
    || latestHandoffWorkOrder?.official_route
    || latestHandoffWorkOrder?.officialRoute
    || latestApprovedWorkOrder?.official_route
    || latestApprovedWorkOrder?.officialRoute
    || 'Console → Handoff → Runner',
    80
  );
  const promptOrigin = clamp(
    latestWorkOrderResult?.prompt_origin
    || latestWorkOrderResult?.promptOrigin
    || latestHandoffWorkOrder?.prompt_origin
    || latestHandoffWorkOrder?.promptOrigin
    || '',
    60
  );
  const blockedReason = clamp(
    latestWorkOrderResult?.blocked_reason
    || latestWorkOrderResult?.blockedReason
    || latestHandoffWorkOrder?.blocked_reason
    || latestHandoffWorkOrder?.blockedReason
    || '',
    120
  );
  const userInputRequired = latestWorkOrderResult?.user_input_required
    ?? latestWorkOrderResult?.userInputRequired
    ?? latestHandoffWorkOrder?.user_input_required
    ?? latestHandoffWorkOrder?.userInputRequired
    ?? latestApprovedWorkOrder?.user_input_required
    ?? latestApprovedWorkOrder?.userInputRequired;
  const executionPath = clamp(
    latestWorkOrderResult?.execution_path
    || latestWorkOrderResult?.executionPath
    || latestHandoffWorkOrder?.execution_path
    || 'Console → 作業票採用 → watcher → claude-zero-confirm → verify / smoke → commit → tag → push → resultPOST → Result Decision',
    180
  );
  const humanGateRequired = latestWorkOrderResult
    ? latestWorkOrderResult.human_gate_required !== false
    : latestHandoffWorkOrder
      ? latestHandoffWorkOrder.human_gate_required !== false
      : latestApprovedWorkOrder
        ? latestApprovedWorkOrder.requires_human_confirmation !== false
    : base.human_gate_required;
  const orchestraEvidence = latestWorkOrderResult?.orchestra_evidence
    || latestHandoffWorkOrder?.orchestra_evidence
    || latestApprovedWorkOrder?.orchestra_evidence
    || {
      router_decision: input.router_decision || input.routerDecision || 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first',
      assigned_lanes: Array.isArray(input.assigned_lanes) ? input.assigned_lanes : [],
      lane_statuses: Array.isArray(input.lane_statuses) ? input.lane_statuses : [],
    };

  const decision = {
    title,
    target_repo: targetRepo,
    assigned_agent: assignedAgent,
    risk_level: riskLevel,
    human_gate_required: hasResult ? base.human_gate_required : humanGateRequired,
    commit_tag_push_allowed: hasResult ? base.commit_tag_push_allowed : false,
    decision_status: hasResult ? base.decision_status : base.decision_status,
    nextRecommendedAction: hasResult ? base.nextRecommendedAction : base.nextRecommendedAction,
    reason: hasResult ? base.reason : base.reason,
    required_next_work: hasResult ? base.required_next_work : base.required_next_work,
    activity_status: hasResult ? base.activity_status : base.activity_status,
    executor,
    route,
    result_post: resultPost,
    execution_path: executionPath,
    execution_host: executionHost,
    executionHost,
    execution_host_allowed: executionHostAllowed !== undefined ? !!executionHostAllowed : true,
    executionHostAllowed: executionHostAllowed !== undefined ? !!executionHostAllowed : true,
    interactive_host_blocked: interactiveHostBlocked !== undefined ? !!interactiveHostBlocked : false,
    interactiveHostBlocked: interactiveHostBlocked !== undefined ? !!interactiveHostBlocked : false,
    no_yes_gate_runtime: noYesGateRuntime !== undefined ? !!noYesGateRuntime : true,
    noYesGateRuntime: noYesGateRuntime !== undefined ? !!noYesGateRuntime : true,
    safe_spawn_active: safeSpawnActive !== undefined ? !!safeSpawnActive : true,
    safeSpawnActive: safeSpawnActive !== undefined ? !!safeSpawnActive : true,
    manual_code_ui_allowed: manualCodeUiAllowed !== undefined ? !!manualCodeUiAllowed : false,
    manualCodeUiAllowed: manualCodeUiAllowed !== undefined ? !!manualCodeUiAllowed : false,
    official_route: officialRoute,
    officialRoute,
    yes_count: Number.isFinite(Number(latestWorkOrderResult?.yes_count)) ? Number(latestWorkOrderResult.yes_count) : 0,
    copy_count: Number.isFinite(Number(latestWorkOrderResult?.copy_count)) ? Number(latestWorkOrderResult.copy_count) : 0,
    human_wait: Number.isFinite(Number(latestWorkOrderResult?.human_wait)) ? Number(latestWorkOrderResult.human_wait) : 0,
    approval_request_count: Number.isFinite(Number(latestWorkOrderResult?.approval_request_count ?? latestWorkOrderResult?.yes_count)) ? Number(latestWorkOrderResult.approval_request_count ?? latestWorkOrderResult.yes_count) : 0,
    manual_paste_count: Number.isFinite(Number(latestWorkOrderResult?.manual_paste_count ?? latestWorkOrderResult?.copy_count)) ? Number(latestWorkOrderResult.manual_paste_count ?? latestWorkOrderResult.copy_count) : 0,
    wait_request_count: Number.isFinite(Number(latestWorkOrderResult?.wait_request_count ?? latestWorkOrderResult?.human_wait)) ? Number(latestWorkOrderResult.wait_request_count ?? latestWorkOrderResult.human_wait) : 0,
    auto_approved_count: Number.isFinite(Number(latestWorkOrderResult?.auto_approved_count ?? latestWorkOrderResult?.autoApprovedCount)) ? Number(latestWorkOrderResult.auto_approved_count ?? latestWorkOrderResult.autoApprovedCount) : 0,
    auto_blocked_count: Number.isFinite(Number(latestWorkOrderResult?.auto_blocked_count ?? latestWorkOrderResult?.autoBlockedCount)) ? Number(latestWorkOrderResult.auto_blocked_count ?? latestWorkOrderResult.autoBlockedCount) : 0,
    retry_count: Number.isFinite(Number(latestWorkOrderResult?.retry_count ?? latestWorkOrderResult?.retryCount)) ? Number(latestWorkOrderResult.retry_count ?? latestWorkOrderResult.retryCount) : 0,
    recovered: !!(latestWorkOrderResult?.recovered || latestHandoffWorkOrder?.recovered),
    prompt_type: promptType,
    prompt_origin: promptOrigin,
    promptOrigin,
    blocked_reason: blockedReason,
    blockedReason,
    user_input_required: userInputRequired !== undefined ? !!userInputRequired : false,
    userInputRequired: userInputRequired !== undefined ? !!userInputRequired : false,
    orchestra_evidence: orchestraEvidence,
    router_decision: normalizeText(orchestraEvidence.router_decision || input.router_decision || input.routerDecision || ''),
    routerDecision: normalizeText(orchestraEvidence.router_decision || input.routerDecision || input.router_decision || ''),
    assigned_lanes: Array.isArray(orchestraEvidence.assigned_lanes) ? orchestraEvidence.assigned_lanes : [],
    assignedLanes: Array.isArray(orchestraEvidence.assigned_lanes) ? orchestraEvidence.assigned_lanes : [],
    lane_statuses: Array.isArray(orchestraEvidence.lane_statuses) ? orchestraEvidence.lane_statuses : [],
    laneStatuses: Array.isArray(orchestraEvidence.lane_statuses) ? orchestraEvidence.lane_statuses : [],
  };

  decision.summary = summarizeDecision(decision);
  decision.commit_tag_push_state = decision.commit_tag_push_allowed ? 'commit候補 / commit前review' : decision.decision_status === 'wait_for_result' ? '結果待ち' : '保留';
  decision.display_status = decision.decision_status;
  return decision;
}

module.exports = {
  buildWorkOrderResultDecision,
  normalizeOutcome,
  summarizeDecision,
};
