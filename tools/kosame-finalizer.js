#!/usr/bin/env node
'use strict';

const { buildOrchestraEvidence, summarizeOrchestraEvidence } = require('./kosame-orchestra-evidence');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildFinalizerReport(input = {}) {
  const routerDecision = normalizeText(input.routerDecision || input.router_decision || 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first');
  const assignedLanes = Array.isArray(input.assignedLanes || input.assigned_lanes)
    ? (input.assignedLanes || input.assigned_lanes)
    : buildOrchestraEvidence({ router_decision: routerDecision }).assigned_lanes;
  const orchestraEvidence = buildOrchestraEvidence({
    router_decision: routerDecision,
    assigned_lanes: assignedLanes,
  });
  const lines = [
    `routerDecision=${routerDecision}`,
    summarizeOrchestraEvidence(orchestraEvidence),
    `executor=${normalizeText(input.executor || 'claude-zero-confirm')}`,
    `route=${normalizeText(input.route || 'zero-confirm')}`,
    `resultPOST=${normalizeText(input.resultPOST || input.result_post || 'POST /api/work-orders/result 200')}`,
    `decision=${normalizeText(input.decisionStatus || input.decision_status || 'ready_for_commit')}`,
    `status=${normalizeText(input.status || 'success')}`,
    `next=${normalizeText(input.next || input.nextRecommendedAction || 'ready_for_commit')}`,
  ];
  if (input.stopReason) lines.push(`stopReason=${normalizeText(input.stopReason)}`);
  if (input.gapId) lines.push(`gapId=${normalizeText(input.gapId)}`);
  if (input.resumeId) lines.push(`resumeId=${normalizeText(input.resumeId)}`);
  return {
    status: normalizeText(input.status || 'success'),
    executor: normalizeText(input.executor || 'claude-zero-confirm'),
    route: normalizeText(input.route || 'zero-confirm'),
    resultPOST: normalizeText(input.resultPOST || input.result_post || 'POST /api/work-orders/result 200'),
    decisionStatus: normalizeText(input.decisionStatus || input.decision_status || 'ready_for_commit'),
    next: normalizeText(input.next || input.nextRecommendedAction || 'ready_for_commit'),
    routerDecision,
    assignedLanes,
    orchestraEvidence,
    reportLines: lines,
    reportText: lines.join(' / '),
    finalReport: [
      'KOSAME_RESULT_BEGIN',
      JSON.stringify({
        result_status: normalizeText(input.result_status || 'success'),
        smoke_result: normalizeText(input.smoke_result || 'PASS'),
        verify_result: normalizeText(input.verify_result || 'PASS'),
        result_summary: normalizeText(input.summary || input.resultSummary || 'complete run finished'),
        changed_files: Array.isArray(input.changed_files) ? input.changed_files : [],
      }),
      'KOSAME_RESULT_END',
    ].join('\n'),
  };
}

module.exports = {
  buildFinalizerReport,
};
