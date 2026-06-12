#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.74 Business Experiment Gate & Ledger
 *
 * Verifies:
 *   - Module exports / TOOL_META / STATUS / DECISION
 *   - YouTube experiment → SMALL_TEST or GO
 *   - maxLoss exceeded → STOP
 *   - Scale conditions met → SCALE
 *   - Financial/insurance/loan → HUMAN_GATE (status + decision)
 *   - Secret/API key → BLOCKED (status + blockedReasons)
 *   - spreadsheetRowDraft / documentLogDraft present, no secrets
 *   - summaryForDashboard present
 *   - DryRun only
 *   - No salesDX/ANESTY/Secret leakage
 */

const pkg = require('../package.json');
const gate = require('../tools/kosame-business-experiment-gate-ledger');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

console.log('=== v110.74 business experiment gate ledger smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.74.0', versionAtLeast(pkg.version, 110, 74));
check('TOOL_META exported',            gate.TOOL_META?.version === '110.74.0');
check('TOOL_META.dryRunOnly',          gate.TOOL_META.dryRunOnly === true);
check('STATUS exported',               gate.STATUS?.safe === 'safe' && gate.STATUS?.human_gate === 'human_gate');
check('DECISION exported',             gate.DECISION?.GO === 'GO' && gate.DECISION?.STOP === 'STOP');
check('buildExperimentGate exported',  typeof gate.buildExperimentGate === 'function');
check('FIXTURES exported',             typeof gate.FIXTURES === 'object');

// ── YouTube experiment → SMALL_TEST or GO ───────────────────────────────────

const yt = gate.FIXTURES.youtube();
check('youtube: status is valid',      ['safe','caution','blocked','human_gate'].includes(yt.status));
check('youtube: decision is valid',    ['SMALL_TEST','GO'].includes(yt.decision));
check('youtube: experiment name set',  yt.experiment.name.includes('YouTube'));
check('youtube: category is youtube',  yt.experiment.category === 'youtube');
check('youtube: spreadsheetRowDraft',  yt.spreadsheetRowDraft && yt.spreadsheetRowDraft.name);
check('youtube: documentLogDraft',     yt.documentLogDraft && yt.documentLogDraft.length > 50);
check('youtube: summaryForDashboard',  yt.summaryForDashboard && yt.summaryForDashboard.experimentName);

// ── maxLoss exceeded → STOP ─────────────────────────────────────────────────

const stop = gate.FIXTURES.maxLossStop();
check('maxLossStop: decision is STOP',          stop.decision === 'STOP');
check('maxLossStop: stopReasons > 0',           stop.stopReasons.length > 0);
check('maxLossStop: budget overBudget',         stop.budgetSummary.overBudget === true);

// ── Scale conditions met → SCALE ────────────────────────────────────────────

const scale = gate.FIXTURES.scaleCondition();
check('scale: decision is SCALE',               scale.decision === 'SCALE');
check('scale: scaleReasons > 0',                scale.scaleReasons.length > 0);
check('scale: conversions >= 60',               scale.resultSummary.conversions >= 60);

// ── Financial/insurance/loan → HUMAN_GATE ───────────────────────────────────

const hg = gate.FIXTURES.humanGate();
check('humanGate: status is human_gate',        hg.status === 'human_gate');
check('humanGate: decision is HUMAN_GATE',      hg.decision === 'HUMAN_GATE');
check('humanGate: cautions include risk',        hg.cautions.some(c => c.includes('insurance')));

// ── Secret/API key → BLOCKED ────────────────────────────────────────────────

const blocked = gate.FIXTURES.blocked();
check('blocked: status is blocked',             blocked.status === 'blocked');
check('blocked: decision is STOP',              blocked.decision === 'STOP');
check('blocked: blockedReasons > 0',            blocked.blockedReasons.length > 0);
check('blocked: blockedReasons mentions secret', blocked.blockedReasons.some(r => r.includes('secret')));

// ── KPI summary structure ───────────────────────────────────────────────────

check('kpiSummary.roi is number',               typeof gate.FIXTURES.scaleCondition().kpiSummary.roi === 'number');
check('kpiSummary.cpa is number',               typeof gate.FIXTURES.scaleCondition().kpiSummary.cpa === 'number');

// ── No secret / customer / salesDX / ANESTY leakage ─────────────────────────

const resultJson = JSON.stringify(yt);
check('no API key in result',                   !resultJson.includes('sk-') && !resultJson.includes('AIza'));
check('no secret value in result',              !resultJson.includes('api_key='));
check('no salesDX in result',                   !resultJson.includes('salesDX') && !resultJson.includes('transcriber'));
check('no ANESTY Board in result',              !resultJson.includes('ANESTY'));
check('no customer data in result',             !resultJson.includes('customer_data') && !resultJson.includes('pii'));

// ── spreadsheetRowDraft / documentLogDraft have no secrets ──────────────────

const allDraftsJson = JSON.stringify(yt.spreadsheetRowDraft) + JSON.stringify(yt.documentLogDraft);
check('drafts: no API key',                     !allDraftsJson.includes('sk-'));
check('drafts: no secret value',                !allDraftsJson.includes('api_key='));
check('drafts: no customer data',               !allDraftsJson.includes('customer_data') && !allDraftsJson.includes('pii'));

// ── Non-blocked fixtures: drafts have no secrets ────────────────────────────
// (blocked fixture intentionally contains secret patterns to test blocking)

for (const [label, fixture] of Object.entries(gate.FIXTURES)) {
  if (label === 'blocked') continue;
  const res = fixture();
  const drafts = JSON.stringify(res.spreadsheetRowDraft) + JSON.stringify(res.documentLogDraft || '');
  check(`drafts ${label}: no API key`,         !drafts.includes('sk-'));
  check(`drafts ${label}: no secret value`,    !drafts.includes('api_key='));
}

// ── DryRun guarantee ─────────────────────────────────────────────────────────

check('dryRun is always true',                  yt.dryRun === true);
check('no realProductActionsExecuted',          yt.realProductActionsExecuted === undefined);

// ── smoke:v110-74 script exists ─────────────────────────────────────────────

check('smoke:v110-74 script in package.json',   'smoke:v110-74' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.74 business experiment gate ledger smoke PASSED`);
} else {
  console.error(`\n❌ v110.74 business experiment gate ledger smoke FAILED (${failures} failures)`);
  process.exit(1);
}
