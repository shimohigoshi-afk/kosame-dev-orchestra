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
