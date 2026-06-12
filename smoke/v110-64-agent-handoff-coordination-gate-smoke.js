#!/usr/bin/env node
'use strict';

const pkg = require('../package.json');
const gate = require('../tools/kosame-agent-handoff-coordination-gate');
const costLedger = require('../tools/kosame-cost-token-ledger');
const explainability = require('../tools/kosame-router-explainability-dashboard');
const router = require('../tools/kosame-smart-task-router');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function includesText(value, fragment) {
  return String(value || '').toLowerCase().includes(String(fragment || '').toLowerCase());
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

function buildPlan(overrides = {}) {
  return {
    assignedAgent: 'gpt',
    targetVersion: 'v110.64',
    targetRepo: 'kosame-dev-orchestra',
    taskTitle: 'Agent handoff coordination',
    taskSummary: 'Dry-run handoff coordination packet',
    workItems: [
      {
        itemId: 'OK-1',
        agent: 'gpt',
        version: 'v110.64',
        repo: 'kosame-dev-orchestra',
        scope: ['coordination', 'handoff'],
        taskTitle: 'Agent handoff coordination',
        taskSummary: 'Dry-run handoff coordination packet',
        requestedModel: 'gpt-5.4-mini',
        sanitizedOnly: false,
      },
    ],
    ...overrides,
  };
}

function buildTask(id, title, description, file_scope) {
  return { id, title, description, file_scope };
}

console.log('=== v110.64 agent handoff coordination gate smoke ===');

check('package version >= 110.64.0', versionAtLeast(pkg.version, 110, 64));
check('coordination gate module exports builder', typeof gate.buildAgentHandoffCoordinationGate === 'function');
check('coordination gate module exports evaluate', typeof gate.evaluateAgentHandoffCoordination === 'function');
check('coordination gate module exports HUMAN_GATE', gate.HUMAN_GATE === 'HUMAN_GATE_REQUIRED');

const safePacket = gate.buildAgentHandoffCoordinationGate(buildPlan(), {
  requestedModel: 'gpt-5.4-mini',
  approvalReceived: false,
  verifyRunCount: 1,
});
check('safe packet status is safe', safePacket.status === 'safe');
check('safe packet assignedAgent is gpt', safePacket.assignedAgent === 'gpt');
check('safe packet targetVersion normalized', safePacket.targetVersion === '110.64.0');
check('safe packet targetRepo is kosame-dev-orchestra', safePacket.targetRepo === 'kosame-dev-orchestra');
check('safe packet has no blockedReasons', Array.isArray(safePacket.blockedReasons) && safePacket.blockedReasons.length === 0);
check('safe packet has no caution reasons', Array.isArray(safePacket.cautions) && safePacket.cautions.length === 0);
check('safe packet next action proceeds', safePacket.nextAllowedAction === 'proceed');
check('safe packet readyForHandoff', safePacket.coordinationSummary?.readyForHandoff === true);
check('safe packet safety notes mention reserved versions', includesText(safePacket.safetyNotes.join(' '), 'v110.63') || includesText(safePacket.safetyNotes.join(' '), 'v110.65'));

const versionCollision = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'CLAUDE-63',
      agent: 'gpt',
      version: 'v110.63',
      repo: 'kosame-dev-orchestra',
      scope: ['coordination'],
      taskTitle: 'GPT tries to touch v110.63',
      taskSummary: 'v110.63 is reserved for Claude',
    },
  ],
}), {});
check('version collision is blocked', versionCollision.status === 'blocked');
check('version collision detected', versionCollision.versionCollisionDetected === true);
check('version collision mentions Claude ownership', includesText(versionCollision.blockedReasons.join(' '), 'belongs to claude'));

const geminiCollision = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'GEMINI-65',
      agent: 'gpt',
      version: 'v110.65',
      repo: 'kosame-dev-orchestra',
      scope: ['coordination'],
      taskTitle: 'GPT tries to touch v110.65',
      taskSummary: 'v110.65 is reserved for Gemini',
    },
  ],
}), {});
check('Gemini version collision is blocked', geminiCollision.status === 'blocked');
check('Gemini version collision detected', geminiCollision.versionCollisionDetected === true);
check('Gemini version collision mentions Gemini ownership', includesText(geminiCollision.blockedReasons.join(' '), 'belongs to gemini'));

const repoCollision = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'REPO-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'other-repo',
      scope: ['coordination'],
      taskTitle: 'Cross repo coordination',
      taskSummary: 'Touching another repo is not allowed',
    },
  ],
}), {});
check('repo collision is blocked', repoCollision.status === 'blocked');
check('repo collision detected', repoCollision.repoCollisionDetected === true);
check('repo collision mentions target repo', includesText(repoCollision.blockedReasons.join(' '), 'repo collision'));

const roleCollision = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'GROK-1',
      agent: 'grok',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['implementation', 'commit'],
      taskTitle: 'Grok implementation attempt',
      taskSummary: 'Grok should only review, not implement',
    },
  ],
}), {});
check('role collision is blocked', roleCollision.status === 'blocked');
check('role collision detected', roleCollision.roleCollisionDetected === true);
check('role collision mentions review/breakthrough only', includesText(roleCollision.blockedReasons.join(' '), 'review/breakthrough only'));

const deepseekCaution = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'DS-1',
      agent: 'deepseek',
      version: 'v110.61',
      repo: 'kosame-dev-orchestra',
      scope: ['docs', 'smoke'],
      taskTitle: 'Sanitized docs work',
      taskSummary: 'One docs section only',
      sanitizedOnly: true,
    },
  ],
}), {});
check('DeepSeek sanitized_only is not blocked', deepseekCaution.status !== 'blocked');
check('DeepSeek sanitized_only returns caution', deepseekCaution.status === 'caution');
check('DeepSeek sanitized_only caution mentions sanitized-only', includesText(deepseekCaution.cautions.join(' '), 'sanitized-only'));

const salesDxDanger = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'SALES-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['営業DX', 'transcriber'],
      taskTitle: 'Sales DX handoff',
      taskSummary: 'Must not leak salesDX/transcriber content',
    },
  ],
}), {});
check('salesDX/transcriber is blocked', salesDxDanger.status === 'blocked');
check('salesDX/transcriber danger gate detected', salesDxDanger.dangerGateDetected === true);
check('salesDX/transcriber reason present', includesText(salesDxDanger.blockedReasons.join(' '), 'salesDX') || includesText(salesDxDanger.blockedReasons.join(' '), 'transcriber'));

const anestyDanger = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'ANESTY-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['ANESTY Board'],
      taskTitle: 'ANESTY Board scope',
      taskSummary: 'Must not reach ANESTY Board',
    },
  ],
}), {});
check('ANESTY Board is blocked', anestyDanger.status === 'blocked');
check('ANESTY Board danger gate detected', anestyDanger.dangerGateDetected === true);
check('ANESTY Board reason present', includesText(anestyDanger.blockedReasons.join(' '), 'anesty'));

const secretDanger = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'SECRET-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['API key', '.env', 'credentials'],
      taskTitle: 'Secret handling',
      taskSummary: 'Secret/API key/.env/credentials must be blocked',
    },
  ],
}), {});
check('Secret/API key/.env/credentials is blocked', secretDanger.status === 'blocked');
check('Secret danger gate detected', secretDanger.dangerGateDetected === true);
check('Secret reason present', includesText(secretDanger.blockedReasons.join(' '), 'secret'));

const customerDanger = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'CUSTOMER-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['customer data'],
      taskTitle: 'Customer data handling',
      taskSummary: 'Customer data must not be exposed',
    },
  ],
}), {});
check('customer data is blocked', customerDanger.status === 'blocked');
check('customer data danger gate detected', customerDanger.dangerGateDetected === true);
check('customer reason present', includesText(customerDanger.blockedReasons.join(' '), 'customer'));

const billingDanger = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'BILLING-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['billing', 'lead management'],
      taskTitle: 'Billing/lead management handling',
      taskSummary: 'Billing and lead management must be gated',
    },
  ],
}), {});
check('billing/lead management is blocked', billingDanger.status === 'blocked');
check('billing danger gate detected', billingDanger.dangerGateDetected === true);
check('billing reason present', includesText(billingDanger.blockedReasons.join(' '), 'billing') || includesText(billingDanger.blockedReasons.join(' '), 'lead management'));

const ipDanger = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'IP-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['IP/core', 'full architecture'],
      taskTitle: 'IP core architecture',
      taskSummary: 'Do not expose core architecture',
    },
  ],
}), {});
check('IP/core/full architecture is blocked', ipDanger.status === 'blocked');
check('IP danger gate detected', ipDanger.dangerGateDetected === true);
check('IP reason present', includesText(ipDanger.blockedReasons.join(' '), 'IP/core') || includesText(ipDanger.blockedReasons.join(' '), 'architecture'));

const humanGate = gate.buildAgentHandoffCoordinationGate(buildPlan({
  workItems: [
    {
      itemId: 'HIGH-1',
      agent: 'gpt',
      version: 'v110.64',
      repo: 'kosame-dev-orchestra',
      scope: ['coordination', 'handoff'],
      taskTitle: 'High cost coordination',
      taskSummary: 'Request GPT-5.5 without approval',
      requestedModel: 'gpt-5.5',
      approvalReceived: false,
    },
  ],
}), {});
check('gpt-5.5 without approval is human_gate', humanGate.status === 'human_gate');
check('gpt-5.5 without approval requires human gate', humanGate.humanGateRequired === true);
check('gpt-5.5 human gate reason mentions approval', includesText(humanGate.humanGateReason, 'approval'));

const routerTask = buildTask(
  'RT-64',
  'Coordinate handoff for docs',
  'Dry-run coordination packet for one docs section.',
  ['docs/coordination.md'],
);
const routed = router.assignWorkerByRules(routerTask, {
  generateCoordinationGate: true,
  handoffPlan: buildPlan(),
  requestedModel: 'gpt-5.4-mini',
  approvalReceived: false,
});
check('router attaches coordination gate', !!routed.coordinationGate);
check('router coordination gate is safe', routed.coordinationGate?.status === 'safe');
check('router explanation includes coordination status', routed.routerExplanation?.coordinationStatus === 'safe');
check('router cost policy includes coordination status', routed.costPolicy?.coordinationGateStatus === 'safe');

const ledger = costLedger.buildLedgerRecord(routerTask, {
  requestedModel: 'gpt-5.4-mini',
  coordinationGate: safePacket,
});
check('ledger records coordination gate status', ledger.coordinationGateStatus === 'safe');
check('ledger records coordination next action', ledger.coordinationNextAllowedAction === 'proceed');

const explanation = explainability.buildRouterExplanation(routerTask, {
  costPolicy: ledger,
  workerScorecard: ledger.workerScorecard,
  availabilityFallback: ledger.availabilityFallback,
  coordinationGate: safePacket,
}, {
  requestedModel: 'gpt-5.4-mini',
  approvalReceived: false,
  coordinationGate: safePacket,
});
check('explanation includes coordination status', explanation.coordinationStatus === 'safe');
check('explanation includes coordination reason', includesText(explanation.coordinationReason, 'proceed') || includesText(explanation.coordinationReason, 'handoff'));
check('explanation includes coordination next action', explanation.coordinationNextAllowedAction === 'proceed');
check('explanation includes safety notes for coordination', includesText(explanation.safetyNotes, 'coordination status'));

if (failures > 0) {
  console.log(`\nFAIL: v110.64 agent handoff coordination gate smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.64 agent handoff coordination gate smoke PASSED');
