#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');
const { handleChatRequest } = require('../tools/kosame-cockpit-chat-server');
const { buildOrchestraEvidence, summarizeOrchestraEvidence } = require('../tools/kosame-orchestra-evidence');
const { buildWorkOrderResultDecision } = require('../tools/kosame-work-order-result-decision');
const { buildOperationsBoard } = require('../tools/kosame-operations-board');
const { buildConsoleContextSummary } = require('../tools/kosame-cockpit-context');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const RESULT_STORE_PATH = path.join(ROOT, 'tools', 'kosame-work-order-result-store.js');
const DECISION_PATH = path.join(ROOT, 'tools', 'kosame-work-order-result-decision.js');
const OPERATIONS_BOARD_PATH = path.join(ROOT, 'tools', 'kosame-operations-board.js');
const CONTEXT_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-context.js');

function assertIncludesAll(text, tokens, label) {
  for (const token of tokens) {
    assert.ok(text.includes(token), `${label} must include ${token}`);
  }
}

function laneStatuses() {
  const lanes = [
    'PM Lane',
    'Implementation Lane',
    'Safety Lane',
    'Executor Policy Lane',
    'Prompt Firewall Lane',
    'Auto-Responder Lane',
    'Audit Lane',
    'Smoke Lane',
    'Verify Lane',
    'UI/Console Lane',
    'Result Decision Lane',
    'Release Lane',
  ];
  return lanes.map((label) => ({ label, status: 'active' }));
}

async function main() {
  console.log('=== v113.3.1 orchestra evidence gate smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.1'), `version must be >= 113.3.1 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-1'], 'smoke:v113-3-1 must exist');
  assert.ok(pkg.scripts['smoke:v113-3-1:handoff-result-collapse'], 'smoke:v113-3-1:handoff-result-collapse must exist');
  assert.ok(pkg.scripts['smoke:v113-3-1:orchestra-evidence'], 'smoke:v113-3-1:orchestra-evidence must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-1'), 'verify must include smoke:v113-3-1');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-1:handoff-result-collapse'), 'verify must include outer collapse smoke');
  console.log('  PASS: package wiring');

  const evidence = buildOrchestraEvidence({
    router_decision: 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first',
    assigned_lanes: laneStatuses().map((lane) => lane.label),
    lane_statuses: laneStatuses(),
  });
  assert.ok(Array.isArray(evidence.assigned_lanes), 'orchestra evidence assigned_lanes must be array');
  assert.equal(evidence.assigned_lanes.length, 12, 'orchestra evidence must have 12 assigned lanes');
  assert.equal(Array.isArray(evidence.lane_statuses) ? evidence.lane_statuses.length : 0, 12, 'orchestra evidence must have 12 lane statuses');
  assert.ok(evidence.summary.includes('Router decision:'), 'orchestra evidence summary must mention router decision');
  assert.ok(summarizeOrchestraEvidence(evidence).includes('assignedLanes='), 'summarizeOrchestraEvidence must mention assigned lanes');
  console.log('  PASS: orchestra evidence helper');

  const workOrderResponse = await handleChatRequest({
    message: 'KOSAME Dev Orchestraの作業票を作成して',
    project: 'dev-orchestra',
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    context: 'currentVersion=113.3.1; verify=PASS; smoke=PASS',
  });
  assert.ok(workOrderResponse.ok, 'work order request must succeed');
  assert.ok(workOrderResponse.work_order, 'work order payload must exist');
  assert.equal(workOrderResponse.work_order.executor, 'claude-zero-confirm', 'executor must be claude-zero-confirm');
  assert.equal(workOrderResponse.work_order.route, 'zero-confirm', 'route must be zero-confirm');
  assert.equal(workOrderResponse.work_order.target_repo, '/home/lavie/kosame-dev-orchestra', 'target repo must stay dev-orchestra');
  assert.equal(workOrderResponse.work_order.router_decision, evidence.router_decision, 'router decision must flow into work order');
  assert.equal(workOrderResponse.work_order.routerDecision, evidence.router_decision, 'routerDecision alias must flow into work order');
  assert.deepEqual(workOrderResponse.work_order.assigned_lanes, evidence.assigned_lanes, 'assigned lanes must flow into work order');
  assert.deepEqual(workOrderResponse.work_order.assignedLanes, evidence.assigned_lanes, 'assignedLanes alias must flow into work order');
  assert.deepEqual(workOrderResponse.work_order.lane_statuses, evidence.lane_statuses, 'lane statuses must flow into work order');
  assert.deepEqual(workOrderResponse.work_order.laneStatuses, evidence.lane_statuses, 'laneStatuses alias must flow into work order');
  assert.ok(workOrderResponse.work_order.orchestra_evidence, 'work order must carry orchestra_evidence');
  assert.ok(workOrderResponse.reply.includes('Orchestra証跡'), 'reply must mention orchestra evidence');
  assert.ok(workOrderResponse.work_order.body.includes('Orchestra証跡'), 'work order body must mention orchestra evidence');
  assert.ok(workOrderResponse.work_order.body.includes('PM Lane'), 'work order body must list lanes');
  console.log('  PASS: work order carries orchestra evidence');

  const result = {
    result_status: 'success',
    smoke_result: 'PASS',
    verify_result: 'PASS',
    executor: 'claude-zero-confirm',
    route: 'zero-confirm',
    result_post: 'POST /api/work-orders/result 200',
    router_decision: evidence.router_decision,
    assigned_lanes: evidence.assigned_lanes,
    lane_statuses: evidence.lane_statuses,
    orchestra_evidence: evidence,
    yes_count: 0,
    copy_count: 0,
    human_wait: 0,
    retry_count: 0,
    recovered: false,
    result_summary: 'Orchestra evidence gate smoke',
    changed_files: ['tools/kosame-cockpit-chat-server.js', 'tools/kosame-operations-board.js', 'public/kosame-live-cockpit.html'],
  };
  const decision = buildWorkOrderResultDecision({
    latestWorkOrderResult: result,
    latestHandoffWorkOrder: {
      title: 'Orchestra Evidence Gate',
      target_repo: '/home/lavie/kosame-dev-orchestra',
      assigned_agent: 'Codex',
      risk_level: 'low',
      human_gate_required: true,
      orchestra_evidence: evidence,
    },
    latestApprovedWorkOrder: {
      title: 'Orchestra Evidence Gate',
      target_repo: '/home/lavie/kosame-dev-orchestra',
      agent: 'Codex',
      risk_level: 'low',
      orchestra_evidence: evidence,
    },
  });
  assert.equal(decision.router_decision, evidence.router_decision, 'decision router_decision must flow');
  assert.deepEqual(decision.assigned_lanes, evidence.assigned_lanes, 'decision assigned lanes must flow');
  assert.equal(decision.lane_statuses.length, 12, 'decision lane status count must be 12');
  assert.ok(decision.summary.includes('routerDecision='), 'decision summary must include routerDecision');
  console.log('  PASS: decision carries orchestra evidence');

  const board = buildOperationsBoard({
    latestWorkOrderResult: result,
    latestWorkOrderDecision: decision,
    workOrderResultHistory: [result],
    codexWatch: { running: true },
    directSpawnAudit: { pass: true },
    startupAudit: { pass: true },
    handoffQueueHealth: 'ok',
    latestTag: 'v113.3.1',
    headCommit: 'deadbeef',
    orchestra_evidence: evidence,
  });
  assert.equal(board.routerDecision, evidence.router_decision, 'operations board routerDecision must flow');
  assert.deepEqual(board.assignedLanes, evidence.assigned_lanes, 'operations board assigned lanes must flow');
  assert.equal(board.laneStatuses.length, 12, 'operations board lane status count must be 12');
  assert.ok(board.summary.includes('routerDecision='), 'operations board summary must include routerDecision');
  console.log('  PASS: operations board carries orchestra evidence');

  const contextSummary = buildConsoleContextSummary({
    version: pkg.version,
    currentVersion: pkg.version,
    packageVersion: pkg.version,
    latestTag: 'v113.3.1',
    headCommit: 'deadbeef',
    mode: 'Readonly',
    projectRegistryPath: path.join(ROOT, 'config', 'kosame-projects.json'),
    projects: [],
    projectStrip: [],
    devOrchestra: { recentCommits: [{ raw: 'deadbeef orchestra' }] },
    salesDx: {},
    monitoredRepos: [],
    taskFeeder: { selectedTasks: [], readyTaskCount: 0, blockedCount: 0, humanGateWaitingCount: 0, warnings: [] },
    wishlist: {},
    memoryVault: {},
    autoSave: {},
    apiCost: {},
    agentEventFeed: { items: [], counts: {} },
    shellAgentActivity: { items: [], counts: {} },
    latestApprovedWorkOrder: null,
    latestHandoffWorkOrder: null,
    latestWorkOrderResult: result,
    workOrderResultHistory: [result],
    latestWorkOrderDecision: decision,
    workOrderDecisionQueue: [decision],
    directSpawnAudit: { pass: true },
    startupAudit: { pass: true },
    operationsBoard: board,
    confirmationBridge: { detected: false },
    humanGate: [],
    warnings: [],
    selectedProjectId: 'dev-orchestra',
    generatedAt: new Date().toISOString(),
    generatedAtLocal: new Date().toISOString(),
  });
  assert.ok(contextSummary.summary.includes('orchestraEvidence='), 'console context summary must include orchestraEvidence');
  assert.ok(contextSummary.summary.includes('PM Lane'), 'console context summary must include lane names');
  console.log('  PASS: console context exposes orchestra evidence');

  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assertIncludesAll(html, [
    'id="handoff-result-outer-details"',
    'id="handoff-inbox-details"',
    'id="handoff-queue-details"',
    'id="work-order-result-details"',
    'id="result-decision-details"',
    'id="operations-board-details"',
    'id="run-history-details"',
    'router decision',
    'assigned lanes',
    'lane statuses',
  ], 'cockpit HTML');
  assert.ok(html.includes('HANDOFF &amp; RESULT'), 'cockpit HTML must keep Handoff & Result collapse');
  assert.ok(html.includes('Result Decision Panel'), 'cockpit HTML must keep Result Decision Panel');
  assert.ok(html.includes('Operations Board'), 'cockpit HTML must keep Operations Board');
  assert.ok(html.includes('Run History'), 'cockpit HTML must keep Run History');
  console.log('  PASS: cockpit HTML exposes evidence sections');

  const chatServerSource = fs.readFileSync(CHAT_SERVER_PATH, 'utf8');
  assertIncludesAll(chatServerSource, [
    'router_decision',
    'routerDecision',
    'assigned_lanes',
    'assignedLanes',
    'lane_statuses',
    'laneStatuses',
    'orchestra_evidence',
    'Orchestra証跡',
    'PM Lane',
    'Release Lane',
  ], 'chat server source');
  const resultStoreSource = fs.readFileSync(RESULT_STORE_PATH, 'utf8');
  assertIncludesAll(resultStoreSource, ['orchestra_evidence', 'router_decision', 'assigned_lanes', 'lane_statuses'], 'result store source');
  const decisionSource = fs.readFileSync(DECISION_PATH, 'utf8');
  assertIncludesAll(decisionSource, ['orchestra_evidence', 'router_decision', 'assigned_lanes', 'lane_statuses'], 'decision source');
  const operationsBoardSource = fs.readFileSync(OPERATIONS_BOARD_PATH, 'utf8');
  assertIncludesAll(operationsBoardSource, ['routerDecision', 'assignedLanes', 'laneStatuses', 'orchestra_evidence'], 'operations board source');
  const contextSource = fs.readFileSync(CONTEXT_PATH, 'utf8');
  assertIncludesAll(contextSource, ['summarizeOrchestraEvidence', 'orchestraEvidence='], 'context source');
  console.log('  PASS: source wiring keeps evidence paths intact');

  console.log('✅ v113.3.1 orchestra evidence gate smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
