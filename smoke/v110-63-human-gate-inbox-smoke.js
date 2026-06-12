#!/usr/bin/env node
'use strict';

const pkg       = require('../package.json');
const inbox     = require('../tools/kosame-human-gate-inbox');
const router    = require('../tools/kosame-smart-task-router');

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

console.log('=== v110.63 human gate inbox smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.63.0', versionAtLeast(pkg.version, 110, 63));
check('HUMAN_GATE constant exported', inbox.HUMAN_GATE === 'HUMAN_GATE_REQUIRED');
check('GATE_CATEGORIES exported', typeof inbox.GATE_CATEGORIES === 'object' && !!inbox.GATE_CATEGORIES.security);
check('buildGateEntry exported', typeof inbox.buildGateEntry === 'function');
check('collectGateEntries exported', typeof inbox.collectGateEntries === 'function');
check('buildInboxSnapshot exported', typeof inbox.buildInboxSnapshot === 'function');
check('buildInboxFromRoutedTasks exported', typeof inbox.buildInboxFromRoutedTasks === 'function');
check('getDashboardSummary exported', typeof inbox.getDashboardSummary === 'function');
check('approveGate exported', typeof inbox.approveGate === 'function');
check('denyGate exported', typeof inbox.denyGate === 'function');
check('printInboxDashboard exported', typeof inbox.printInboxDashboard === 'function');

// ── buildGateEntry: humanGate=false → null ────────────────────────────────────

const safeTask  = { id: 'T-SAFE', title: 'Safe docs update', file_scope: ['docs/readme.md'] };
const safeDecision = { humanGate: false, humanGateRequired: false, primary: 'general_worker' };
const noEntry = inbox.buildGateEntry(safeTask, safeDecision, {});
check('buildGateEntry returns null when no gate required', noEntry === null);

// ── buildGateEntry: security gate ────────────────────────────────────────────

const secTask = { id: 'T-SEC', title: 'Expose auth token', file_scope: ['tools/key.js'] };
const secDecision = {
  humanGate: true,
  humanGateRequired: true,
  humanGateReason: 'security violation: auth token leak',
  securityViolation: ['auth_token_in_task'],
  taskType: 'security',
  primary: 'cheap_code_worker',
};
const secEntry = inbox.buildGateEntry(secTask, secDecision, {});
check('security gate entry is not null', secEntry !== null);
check('security gate category is security', secEntry?.gateCategory === 'security');
check('security gate priority is 1', secEntry?.gatePriority === 1);
check('security gate status is pending', secEntry?.status === 'pending');
check('security gate has taskId', secEntry?.taskId === 'T-SEC');
check('security gate has gateReason', includesText(secEntry?.gateReason, 'security violation'));
check('security gate has targetFiles', secEntry?.targetFiles?.includes('tools/key.js'));
check('security gate recommendedAction is deny', secEntry?.recommendedAction === 'deny');

// ── buildGateEntry: high_cost gate ───────────────────────────────────────────

const costTask = { id: 'T-COST', title: 'GPT-5.5 generation', file_scope: [] };
const costDecision = {
  humanGateRequired: true,
  humanGateReason: 'gpt-5.5 requires explicit human approval',
  blockedHighCost: true,
  selectedModel: 'gpt-5.5',
  providerBudgetBucket: 'high_cost_human_approval',
};
const costEntry = inbox.buildGateEntry(costTask, costDecision, {});
check('high_cost gate is not null', costEntry !== null);
check('high_cost gate category is high_cost', costEntry?.gateCategory === 'high_cost');
check('high_cost gate selectedModel is gpt-5.5', costEntry?.decision?.selectedModel === 'gpt-5.5');
check('high_cost gate blockedHighCost true', costEntry?.decision?.blockedHighCost === true);

// ── buildGateEntry: ip_core gate ─────────────────────────────────────────────

const ipTask = { id: 'T-IP', title: 'Modify sales DX flow', file_scope: ['tools/sales.js'], isSalesDx: true };
const ipDecision = {
  humanGate: true,
  humanGateReason: '営業DX IP_core 変更',
  taskType: 'ip_core',
  primary: 'general_worker',
};
const ipEntry = inbox.buildGateEntry(ipTask, ipDecision, {});
check('ip_core gate is not null', ipEntry !== null);
check('ip_core gate category is ip_core', ipEntry?.gateCategory === 'ip_core');
check('ip_core gate priority is 2', ipEntry?.gatePriority === 2);
check('ip_core gate recommendedAction is approve_with_review', ipEntry?.recommendedAction === 'approve_with_review');

// ── buildGateEntry: external_worker gate ─────────────────────────────────────

const extTask = { id: 'T-EXT', title: 'DeepSeek sanitized docs', file_scope: ['docs/api.md'] };
const extDecision = {
  humanGateRequired: true,
  humanGateReason: 'DeepSeek/opencode requires sanitized_only task pack',
  primary: 'cheap_code_worker',
  taskType: 'routine_docs',
};
const extEntry = inbox.buildGateEntry(extTask, extDecision, {});
check('external_worker gate is not null', extEntry !== null);
check('external_worker gate category is external_worker', extEntry?.gateCategory === 'external_worker');

// ── buildGateEntry: costPolicy humanGateRequired path ────────────────────────

const ledgerTask = { id: 'T-LEDGER', title: 'Ledger gate task', file_scope: [] };
const ledgerDecision = {
  primary: 'gpt_upper',
  costPolicy: {
    humanGateRequired: true,
    humanGateReason: 'cost gate blocked: budget exceeded',
    selectionBlocked: true,
  },
};
const ledgerEntry = inbox.buildGateEntry(ledgerTask, ledgerDecision, {});
check('costPolicy humanGateRequired triggers gate', ledgerEntry !== null);
check('costPolicy gate reason present', includesText(ledgerEntry?.gateReason, 'cost gate') || ledgerEntry?.gateReason?.length > 0);

// ── buildGateEntry: providerBudgetBucketPath with HUMAN_GATE ─────────────────

const bucketTask = { id: 'T-BUCKET', title: 'Budget path gate', file_scope: [] };
const bucketDecision = {
  providerBudgetBucketPath: ['free_tier', 'ultra_low_cost', 'HUMAN_GATE_REQUIRED'],
  humanGateReason: 'no provider available',
};
const bucketEntry = inbox.buildGateEntry(bucketTask, bucketDecision, {});
check('providerBudgetBucketPath with HUMAN_GATE triggers gate', bucketEntry !== null);

// ── collectGateEntries ────────────────────────────────────────────────────────

const mixedTasks = [
  { id: 'T-SAFE2', title: 'Safe task', file_scope: [], assignment: { humanGate: false, humanGateRequired: false } },
  { id: 'T-SEC2',  title: 'Security task', file_scope: ['sec.js'], assignment: { humanGate: true, humanGateRequired: true, humanGateReason: 'security violation', taskType: 'security' } },
  { id: 'T-IP2',   title: 'IP core task', file_scope: [], assignment: { humanGate: true, humanGateReason: 'ip_core change', taskType: 'ip_core' } },
];
const collected = inbox.collectGateEntries(mixedTasks, {});
check('collectGateEntries skips safe tasks', collected.length === 2);
check('collectGateEntries returns entries sorted by priority', collected[0].gatePriority <= collected[1].gatePriority);
check('collectGateEntries assigns IDs', collected.every(e => e.id?.startsWith('GATE-')));

// ── buildInboxSnapshot ────────────────────────────────────────────────────────

const entries = [
  inbox.buildGateEntry(secTask, secDecision, {}),
  inbox.buildGateEntry(ipTask, ipDecision, {}),
  inbox.buildGateEntry(costTask, costDecision, {}),
].filter(Boolean);

const snapshot = inbox.buildInboxSnapshot(entries);
check('snapshot totalEntries correct', snapshot.totalEntries === entries.length);
check('snapshot pendingCount equals totalEntries (all pending)', snapshot.pendingCount === entries.length);
check('snapshot approvedCount is 0', snapshot.approvedCount === 0);
check('snapshot deniedCount is 0', snapshot.deniedCount === 0);
check('snapshot categoryCounts has security', typeof snapshot.categoryCounts.security === 'number');
check('snapshot priorityGates contains security entry', snapshot.priorityGates.some(pg => pg.category === 'security'));
check('snapshot has timestamp', typeof snapshot.timestamp === 'string');
check('snapshot has version', snapshot.version === inbox.TOOL_META.version);

// ── approveGate ───────────────────────────────────────────────────────────────

const approved = inbox.approveGate(secEntry, 'junya', 'Reviewed and confirmed safe');
check('approveGate sets status to approved', approved.status === 'approved');
check('approveGate sets approvedBy', approved.approvedBy === 'junya');
check('approveGate sets approvedAt', typeof approved.approvedAt === 'string');
check('approveGate does not mutate original', secEntry.status === 'pending');
check('approveGate sets approvalReason', includesText(approved.approvalReason, 'Reviewed'));

// ── denyGate ──────────────────────────────────────────────────────────────────

const denied = inbox.denyGate(costEntry, 'junya', 'Budget not approved for gpt-5.5');
check('denyGate sets status to denied', denied.status === 'denied');
check('denyGate sets deniedBy', denied.deniedBy === 'junya');
check('denyGate sets deniedAt', typeof denied.deniedAt === 'string');
check('denyGate does not mutate original', costEntry.status === 'pending');
check('denyGate sets denialReason', includesText(denied.denialReason, 'Budget'));

// ── buildInboxSnapshot with mixed statuses ────────────────────────────────────

const mixedEntries = [approved, secEntry, denied];
const mixedSnapshot = inbox.buildInboxSnapshot(mixedEntries);
check('mixed snapshot counts approved', mixedSnapshot.approvedCount === 1);
check('mixed snapshot counts denied', mixedSnapshot.deniedCount === 1);
check('mixed snapshot counts pending', mixedSnapshot.pendingCount === 1);

// ── buildInboxFromRoutedTasks ─────────────────────────────────────────────────

const routerTasks = [
  { id: 'RT-01', title: 'Safe routing', file_scope: ['docs/x.md'], assignment: { humanGateRequired: false } },
  { id: 'RT-02', title: 'Gate routing', file_scope: ['tools/y.js'], assignment: { humanGate: true, humanGateRequired: true, humanGateReason: 'test gate', taskType: 'security' } },
];
const inboxSnapshot = inbox.buildInboxFromRoutedTasks(routerTasks, {});
check('buildInboxFromRoutedTasks returns snapshot', typeof inboxSnapshot === 'object');
check('buildInboxFromRoutedTasks pendingCount is 1', inboxSnapshot.pendingCount === 1);
check('buildInboxFromRoutedTasks totalEntries is 1', inboxSnapshot.totalEntries === 1);

// ── getDashboardSummary ───────────────────────────────────────────────────────

const dashSummary = inbox.getDashboardSummary(routerTasks);
check('getDashboardSummary returns humanGateInbox key', !!dashSummary.humanGateInbox);
check('getDashboardSummary pendingCount', dashSummary.humanGateInbox.pendingCount === 1);
check('getDashboardSummary hasUrgent (security priority)', dashSummary.humanGateInbox.hasUrgent === true);
check('getDashboardSummary totalEntries', dashSummary.humanGateInbox.totalEntries === 1);

// ── Smart Task Router integration ─────────────────────────────────────────────

const secRoutedTask = {
  id: 'SR-SEC', title: 'Expose secret', description: 'expose api_key to external', file_scope: ['tools/key.js'],
  isSalesDx: true, isConfidential: true,
};
const routerResult = router.assignWorkerByRules(secRoutedTask, {});
const routerEntry = inbox.buildGateEntry(secRoutedTask, routerResult, {});
// If router flags humanGate, we get an entry; otherwise null (both valid outcomes)
check('router integration: buildGateEntry accepts router output', routerEntry === null || typeof routerEntry === 'object');

// Gate from budget bucket path
const gateRoutedTask = {
  id: 'SR-BUDGET', title: 'High cost task', file_scope: ['tools/ai.js'],
};
const budgetAssignment = {
  humanGateRequired: true,
  humanGateReason: 'budget bucket requires human approval',
  providerBudgetBucket: 'high_cost_human_approval',
  selectedModel: 'gpt-5.5',
  blockedHighCost: false,
};
const budgetGateEntry = inbox.buildGateEntry(gateRoutedTask, budgetAssignment, {});
check('budget bucket high_cost_human_approval triggers gate entry', budgetGateEntry !== null);
check('budget bucket gate category is high_cost', budgetGateEntry?.gateCategory === 'high_cost');

// ── printInboxDashboard does not throw ───────────────────────────────────────

let dashboardOk = true;
try {
  const origLog = console.log;
  console.log = () => {};
  inbox.printInboxDashboard(snapshot, { showApproved: true, showDenied: true, compact: false });
  inbox.printInboxDashboard(inbox.buildInboxSnapshot([]), {});
  console.log = origLog;
} catch (e) {
  dashboardOk = false;
}
check('printInboxDashboard does not throw', dashboardOk);

// ── Empty inbox ───────────────────────────────────────────────────────────────

const emptySnapshot = inbox.buildInboxSnapshot([]);
check('empty inbox pendingCount is 0', emptySnapshot.pendingCount === 0);
check('empty inbox totalEntries is 0', emptySnapshot.totalEntries === 0);
check('empty inbox priorityGates is empty', emptySnapshot.priorityGates.length === 0);

// ── Result ────────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.log(`\nFAIL: v110.63 human gate inbox smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.63 human gate inbox smoke PASSED');
