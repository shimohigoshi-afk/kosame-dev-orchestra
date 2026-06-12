#!/usr/bin/env node
'use strict';

const pkg = require('../package.json');
const health = require('../tools/kosame-provider-availability-health-snapshot');
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

function task(title, description) {
  return { title, description };
}

console.log('=== v110.66 provider availability health snapshot smoke ===');

check('package version >= 110.66.0', versionAtLeast(pkg.version, 110, 66));
check('smoke:v110-67 is advertised', Object.prototype.hasOwnProperty.call(pkg.scripts || {}, 'smoke:v110-67'));
check('TOOL_META exported', health.TOOL_META?.version === '110.66.0');
check('buildProviderAvailabilityHealthSnapshot exported', typeof health.buildProviderAvailabilityHealthSnapshot === 'function');
check('provider health summary shape exported', typeof health.buildProviderAvailabilityHealthSnapshot(task('Docs fix', 'Update one docs section'), {}).providerHealth?.hasBlocked === 'boolean');

const docsSnapshot = health.buildProviderAvailabilityHealthSnapshot(
  task('Docs fix', 'Update one docs section only'),
  { providerStates: { gemini: 'healthy', claude: 'healthy', grok: 'healthy', deepseek_opencode: 'healthy' } },
);
check('docs snapshot returns items', Array.isArray(docsSnapshot.items) && docsSnapshot.items.length >= 5);
check('docs snapshot includes providerHealth', !!docsSnapshot.providerHealth);
check('docs snapshot has blocked or limited providers', docsSnapshot.providerHealth.hasBlocked === true || docsSnapshot.providerHealth.hasLimited === true);
check('docs snapshot has fallback', typeof docsSnapshot.providerHealth.recommendedFallback === 'string' && docsSnapshot.providerHealth.recommendedFallback.length > 0);
check('docs snapshot has humanGateRequired field', typeof docsSnapshot.providerHealth.humanGateRequired === 'boolean');

const googleSnapshot = health.buildProviderAvailabilityHealthSnapshot(
  task('Google IAM note', 'Review Google IAM / Cloud Run caution'),
  { providerStates: { gemini: 'unavailable', claude: 'healthy', grok: 'healthy' } },
);
check('Gemini unavailable yields limited or human_gate', ['limited', 'human_gate', 'blocked'].includes(googleSnapshot.items.find(item => item.provider === 'Gemini')?.status));
check('Gemini unavailable fallback is cautious', includesText(googleSnapshot.providerHealth.recommendedFallback, 'gpt') || includesText(googleSnapshot.providerHealth.recommendedFallback, 'human_gate'));

const highCostSnapshot = health.buildProviderAvailabilityHealthSnapshot(
  task('Security review', 'Request gpt-5.5 without approval'),
  { requestedModel: 'gpt-5.5', approvalReceived: false },
);
const gptItem = highCostSnapshot.items.find(item => item.provider === 'GPT / Codex');
check('gpt-5.5 request is human_gate or blocked', gptItem?.status === 'human_gate' || gptItem?.status === 'blocked');
check('gpt-5.5 request requires approval', gptItem?.humanApprovalRequired === true);
check('gpt-5.5 block reason present', includesText(gptItem?.blockedReasons, 'approval'));
check('providerHealth reports human gate for high cost', highCostSnapshot.providerHealth.humanGateRequired === true);

const deepseekSnapshot = health.buildProviderAvailabilityHealthSnapshot(
  task('Sanitized docs', 'External sanitized_only docs section'),
  { externalSanitized: true, workerClass: 'sanitized_only' },
);
const deepseekItem = deepseekSnapshot.items.find(item => item.provider === 'DeepSeek / opencode');
check('DeepSeek sanitized_only item exists', !!deepseekItem);
check('DeepSeek sanitized_only not blocked', deepseekItem?.status !== 'blocked');

const dangerSnapshot = health.buildProviderAvailabilityHealthSnapshot(
  task('SalesDX handoff', 'salesDX / transcriber / customer data / ANESTY Board'),
  { providerStates: { gpt_codex: 'healthy' } },
);
check('danger snapshot has blocked or human gate', dangerSnapshot.providerHealth.hasBlocked === true || dangerSnapshot.providerHealth.humanGateRequired === true);
check('danger snapshot reports fallback', typeof dangerSnapshot.recommendedFallback === 'string');

const ledger = costLedger.buildLedgerRecord(
  task('Provider availability docs', 'Update provider availability snapshot docs'),
  {
    generateProviderAvailabilityHealthSnapshot: true,
    providerStates: { gemini: 'healthy', claude: 'healthy', grok: 'healthy' },
    verifyRunCount: 2,
  },
);
check('ledger includes provider availability snapshot', !!ledger.providerAvailabilityHealthSnapshot);
check('ledger includes providerHealth', !!ledger.providerHealth);
check('ledger providerHealth has fallback', typeof ledger.providerHealth?.recommendedFallback === 'string');

const explanation = explainability.buildRouterExplanation(
  task('Provider availability docs', 'Update provider availability snapshot docs'),
  {
    costPolicy: ledger,
    providerHealth: ledger.providerHealth,
    providerAvailabilityHealthSnapshot: ledger.providerAvailabilityHealthSnapshot,
  },
  {},
);
check('router explanation includes providerHealth', !!explanation.providerHealth);
check('router explanation says providerHealth fallback', typeof explanation.safetyNotes === 'string' && includesText(explanation.safetyNotes, 'provider health fallback'));

const routed = router.assignWorkerByRules(
  { title: 'Update one docs section', description: 'routine docs work' },
  { generateProviderAvailabilityHealthSnapshot: true },
);
check('router result includes providerHealth', !!routed.providerHealth);
check('router result includes providerAvailabilityHealthSnapshot', !!routed.providerAvailabilityHealthSnapshot);

if (failures > 0) {
  console.log(`FAILED: ${failures} checks`);
  process.exitCode = 1;
} else {
  console.log('PASS: all checks');
}
