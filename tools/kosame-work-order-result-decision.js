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
  const parts = [
    `status=${normalizeText(current.decision_status || current.nextRecommendedAction || 'wait_for_result')}`,
    `next=${normalizeText(current.nextRecommendedAction || 'wait_for_result')}`,
    `humanGate=${current.human_gate_required ? 'yes' : 'no'}`,
    `commitTagPush=${current.commit_tag_push_allowed ? 'candidate' : 'hold'}`,
    `yesCount=${Number.isFinite(Number(current.yes_count)) ? Number(current.yes_count) : 0}`,
    `copyCount=${Number.isFinite(Number(current.copy_count)) ? Number(current.copy_count) : 0}`,
    `humanWait=${Number.isFinite(Number(current.human_wait)) ? Number(current.human_wait) : 0}`,
  ];
  const reason = clamp(current.reason || current.summary || '', 120);
  if (reason) parts.push(`reason=${reason}`);
  const required = clamp(current.required_next_work || '', 80);
  if (required) parts.push(`required=${required}`);
  return parts.join(' / ');
}

function buildDecisionBase(status, smoke, verify) {
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
  const humanGateRequired = latestWorkOrderResult
    ? latestWorkOrderResult.human_gate_required !== false
    : latestHandoffWorkOrder
      ? latestHandoffWorkOrder.human_gate_required !== false
      : latestApprovedWorkOrder
        ? latestApprovedWorkOrder.requires_human_confirmation !== false
        : base.human_gate_required;

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
    yes_count: Number.isFinite(Number(latestWorkOrderResult?.yes_count)) ? Number(latestWorkOrderResult.yes_count) : 0,
    copy_count: Number.isFinite(Number(latestWorkOrderResult?.copy_count)) ? Number(latestWorkOrderResult.copy_count) : 0,
    human_wait: Number.isFinite(Number(latestWorkOrderResult?.human_wait)) ? Number(latestWorkOrderResult.human_wait) : 0,
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
