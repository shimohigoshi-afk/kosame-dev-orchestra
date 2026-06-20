#!/usr/bin/env node
'use strict';

const ORCHESTRA_ROUTER_DECISION = 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first';

const ORCHESTRA_LANE_DEFINITIONS = [
  { id: 'pm_lane', label: 'PM Lane', status: 'active' },
  { id: 'implementation_lane', label: 'Implementation Lane', status: 'active' },
  { id: 'safety_lane', label: 'Safety Lane', status: 'active' },
  { id: 'executor_policy_lane', label: 'Executor Policy Lane', status: 'active' },
  { id: 'prompt_firewall_lane', label: 'Prompt Firewall Lane', status: 'active' },
  { id: 'auto_responder_lane', label: 'Auto-Responder Lane', status: 'active' },
  { id: 'audit_lane', label: 'Audit Lane', status: 'active' },
  { id: 'smoke_lane', label: 'Smoke Lane', status: 'active' },
  { id: 'verify_lane', label: 'Verify Lane', status: 'active' },
  { id: 'ui_console_lane', label: 'UI/Console Lane', status: 'active' },
  { id: 'result_decision_lane', label: 'Result Decision Lane', status: 'active' },
  { id: 'release_lane', label: 'Release Lane', status: 'active' },
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLaneStatus(value, fallback = 'active') {
  const text = normalizeText(value);
  return text || fallback;
}

function normalizeAssignedLanes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/[\r\n,|]+/).map((item) => normalizeText(item)).filter(Boolean);
  }
  return ORCHESTRA_LANE_DEFINITIONS.map((lane) => lane.label);
}

function buildOrchestraEvidence(input = {}) {
  const assignedLanes = normalizeAssignedLanes(input.assigned_lanes || input.assignedLanes);
  const laneStatuses = ORCHESTRA_LANE_DEFINITIONS.map((lane) => {
    const direct = input.lane_statuses && typeof input.lane_statuses === 'object'
      ? input.lane_statuses[lane.label] || input.lane_statuses[lane.id]
      : '';
    const perLane = input[`${lane.id}_status`] || input[`${lane.id}Status`] || input[`${lane.label}Status`];
    return {
      id: lane.id,
      label: lane.label,
      status: normalizeLaneStatus(perLane || direct || lane.status),
    };
  });
  const routerDecision = normalizeText(input.router_decision || input.routerDecision) || ORCHESTRA_ROUTER_DECISION;
  return {
    status: 'captured',
    router_decision: routerDecision,
    assigned_lanes: assignedLanes,
    lane_statuses: laneStatuses,
    summary: [
      `Router decision: ${routerDecision}`,
      `assigned lanes: ${assignedLanes.join(' | ')}`,
      `lane status: ${laneStatuses.map((lane) => `${lane.label}=${lane.status}`).join(' / ')}`,
    ].join(' / '),
  };
}

function summarizeOrchestraEvidence(evidence = {}) {
  const current = evidence && typeof evidence === 'object' ? evidence : buildOrchestraEvidence({});
  const assigned = Array.isArray(current.assigned_lanes) ? current.assigned_lanes.join(' | ') : '—';
  const laneStatuses = Array.isArray(current.lane_statuses)
    ? current.lane_statuses.map((lane) => `${lane.label || lane.id || 'lane'}=${lane.status || 'active'}`).join(' / ')
    : '—';
  return [
    `routerDecision=${normalizeText(current.router_decision || ORCHESTRA_ROUTER_DECISION)}`,
    `assignedLanes=${assigned}`,
    `laneStatuses=${laneStatuses}`,
  ].join(' / ');
}

module.exports = {
  ORCHESTRA_ROUTER_DECISION,
  ORCHESTRA_LANE_DEFINITIONS,
  buildOrchestraEvidence,
  summarizeOrchestraEvidence,
};
