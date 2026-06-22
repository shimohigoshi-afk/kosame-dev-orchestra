#!/usr/bin/env node
'use strict';

const { buildOrchestraEvidence, summarizeOrchestraEvidence } = require('./kosame-orchestra-evidence');

function normalizeCount(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildOperationsBoard(snapshot = {}) {
  const result = snapshot.latestWorkOrderResult || {};
  const decision = snapshot.latestWorkOrderDecision || {};
  const history = Array.isArray(snapshot.workOrderResultHistory) ? snapshot.workOrderResultHistory : [];
  const orchestraEvidence = decision.orchestra_evidence
    || result.orchestra_evidence
    || buildOrchestraEvidence(snapshot.orchestra_evidence || snapshot);
  const latestTag = String(snapshot.latestTag || decision.tag_candidate || '—').trim() || '—';
  const latestCommit = String(snapshot.headCommit || decision.commit_candidate || '—').trim() || '—';
  return {
    route: String(decision.route || result.route || 'zero-confirm'),
    executor: String(decision.executor || result.executor || 'claude-zero-confirm'),
    executionHost: String(decision.execution_host || decision.executionHost || result.execution_host || result.executionHost || 'kosame-runner'),
    executionHostAllowed: decision.execution_host_allowed ?? decision.executionHostAllowed ?? result.execution_host_allowed ?? result.executionHostAllowed,
    interactiveHostBlocked: decision.interactive_host_blocked ?? decision.interactiveHostBlocked ?? result.interactive_host_blocked ?? result.interactiveHostBlocked,
    interactivePromptBlocked: decision.interactive_prompt_blocked ?? decision.interactivePromptBlocked ?? result.interactive_prompt_blocked ?? result.interactivePromptBlocked,
    noYesGateRuntime: decision.no_yes_gate_runtime ?? decision.noYesGateRuntime ?? result.no_yes_gate_runtime ?? result.noYesGateRuntime,
    safeSpawnActive: decision.safe_spawn_active ?? decision.safeSpawnActive ?? result.safe_spawn_active ?? result.safeSpawnActive,
    manualCodeUiAllowed: decision.manual_code_ui_allowed ?? decision.manualCodeUiAllowed ?? result.manual_code_ui_allowed ?? result.manualCodeUiAllowed,
    officialRoute: String(decision.official_route || decision.officialRoute || result.official_route || result.officialRoute || 'Console → Handoff → Runner'),
    codexYesHellGuard: String(decision.codex_yes_hell_guard || decision.codexYesHellGuard || result.codex_yes_hell_guard || result.codexYesHellGuard || 'active').trim() || 'active',
    codexAutoApproveMode: String(decision.codex_auto_approve_mode || decision.codexAutoApproveMode || result.codex_auto_approve_mode || result.codexAutoApproveMode || 'active').trim() || 'active',
    userYesRequired: !!(decision.user_yes_required ?? decision.userYesRequired ?? result.user_yes_required ?? result.userYesRequired),
    safetyStopGuard: String(decision.safety_stop_guard || decision.safetyStopGuard || result.safety_stop_guard || result.safetyStopGuard || 'active').trim() || 'active',
    policyKernel: 'active',
    promptClassifier: 'active',
    autoResponder: 'active',
    autoResponderMode: 'blocklist-only',
    firewall: 'active',
    safetyStopDetector: 'active',
    directSpawnAudit: snapshot.directSpawnAudit && snapshot.directSpawnAudit.pass ? 'PASS' : 'WARN',
    startupAudit: snapshot.startupAudit && snapshot.startupAudit.pass ? 'PASS' : 'WARN',
    queueHealth: snapshot.handoffQueueHealth || 'ok',
    watcherStatus: snapshot.codexWatch && snapshot.codexWatch.running ? 'running' : 'stopped',
    resultPOSTStatus: String(decision.result_post || result.result_post || 'POST /api/work-orders/result 200'),
    runHistoryCount: history.length,
    blockedCount: history.filter((item) => String(item.result_status || item.decision_status || '').includes('fail') || String(item.decision_status || '').includes('block')).length,
    autoApprovedCount: normalizeCount(decision.autoApprovedCount || result.autoApprovedCount),
    recoveredCount: normalizeCount(result.recovered ? 1 : 0),
    latestDecision: String(decision.decision_status || 'wait_for_result'),
    latestTag,
    latestCommit,
    routerDecision: String(orchestraEvidence.router_decision || decision.router_decision || result.router_decision || 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first'),
    assignedLanes: Array.isArray(orchestraEvidence.assigned_lanes) ? orchestraEvidence.assigned_lanes : [],
    laneStatuses: Array.isArray(orchestraEvidence.lane_statuses) ? orchestraEvidence.lane_statuses : [],
    orchestra_evidence: orchestraEvidence,
    summary: [
      `zero-confirm=${String(decision.route || result.route || 'zero-confirm')}`,
      `executor=${String(decision.executor || result.executor || 'claude-zero-confirm')}`,
      `executionHost=${String(decision.execution_host || decision.executionHost || result.execution_host || result.executionHost || 'kosame-runner')}`,
      `executionHostAllowed=${(decision.execution_host_allowed ?? decision.executionHostAllowed ?? result.execution_host_allowed ?? result.executionHostAllowed) !== false ? 'true' : 'false'}`,
      `interactiveHostBlocked=${(decision.interactive_host_blocked ?? decision.interactiveHostBlocked ?? result.interactive_host_blocked ?? result.interactiveHostBlocked) ? 'true' : 'false'}`,
      `interactivePromptBlocked=${(decision.interactive_prompt_blocked ?? decision.interactivePromptBlocked ?? result.interactive_prompt_blocked ?? result.interactivePromptBlocked) ? 'true' : 'false'}`,
      `noYesGateRuntime=${(decision.no_yes_gate_runtime ?? decision.noYesGateRuntime ?? result.no_yes_gate_runtime ?? result.noYesGateRuntime) !== false ? 'true' : 'false'}`,
      `safeSpawnActive=${(decision.safe_spawn_active ?? decision.safeSpawnActive ?? result.safe_spawn_active ?? result.safeSpawnActive) !== false ? 'true' : 'false'}`,
      `manualCodeUiAllowed=${(decision.manual_code_ui_allowed ?? decision.manualCodeUiAllowed ?? result.manual_code_ui_allowed ?? result.manualCodeUiAllowed) ? 'true' : 'false'}`,
      `officialRoute=${String(decision.official_route || decision.officialRoute || result.official_route || result.officialRoute || 'Console → Handoff → Runner')}`,
      `codexYesHellGuard=${String(decision.codex_yes_hell_guard || decision.codexYesHellGuard || result.codex_yes_hell_guard || result.codexYesHellGuard || 'active').trim() || 'active'}`,
      `codexAutoApproveMode=${String(decision.codex_auto_approve_mode || decision.codexAutoApproveMode || result.codex_auto_approve_mode || result.codexAutoApproveMode || 'active').trim() || 'active'}`,
      `userYesRequired=${(decision.user_yes_required ?? decision.userYesRequired ?? result.user_yes_required ?? result.userYesRequired) ? 'true' : 'false'}`,
      `safetyStopGuard=${String(decision.safety_stop_guard || decision.safetyStopGuard || result.safety_stop_guard || result.safetyStopGuard || 'active').trim() || 'active'}`,
      `policyKernel=active`,
      `promptClassifier=active`,
      `autoResponder=active`,
      `firewall=active`,
      `safetyStopDetector=active`,
      `directSpawnAudit=${snapshot.directSpawnAudit && snapshot.directSpawnAudit.pass ? 'PASS' : 'WARN'}`,
      `startupAudit=${snapshot.startupAudit && snapshot.startupAudit.pass ? 'PASS' : 'WARN'}`,
      `queueHealth=${snapshot.handoffQueueHealth || 'ok'}`,
      `history=${history.length}`,
      `blocked=${normalizeCount(snapshot.blockedCount)}`,
      `autoApproved=${normalizeCount(snapshot.autoApprovedCount)}`,
      `recovered=${normalizeCount(snapshot.recoveredCount)}`,
      `latestDecision=${String(decision.decision_status || 'wait_for_result')}`,
      `latestTag=${latestTag}`,
      `latestCommit=${latestCommit}`,
      summarizeOrchestraEvidence(orchestraEvidence),
    ].join(' / '),
  };
}

module.exports = {
  buildOperationsBoard,
};
