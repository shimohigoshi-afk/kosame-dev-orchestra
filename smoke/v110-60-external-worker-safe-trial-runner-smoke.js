#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const pkg = require('../package.json');
const generator = require('../tools/kosame-sanitized-task-pack-generator');
const runner = require('../tools/kosame-external-worker-safe-trial-runner');
const patchGate = require('../tools/kosame-patch-intake-gate');
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

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

function buildTask(id, title, description, file_scope) {
  return { id, title, description, file_scope };
}

function buildMock(taskPack, title, fileOverride, patchTextOverride) {
  const file = fileOverride || taskPack.allowedFiles[0];
  return {
    workerType: taskPack.workerType,
    changedFiles: [file],
    patchSummary: title,
    patchText: patchTextOverride || [
      '*** Begin Patch',
      `*** Update File: ${file}`,
      '@@',
      '- old line',
      `+ ${title}`,
      '*** End Patch',
    ].join('\n'),
    declaredScope: taskPack.allowedScope,
    verifyCommands: taskPack.verifyCommands,
    riskNotes: 'dryRun fixture',
  };
}

console.log('=== v110.60 external worker safe trial runner smoke ===');

check('package version >= 110.60.0', versionAtLeast(pkg.version, 110, 60));
check('runner module is available', typeof runner.buildExternalWorkerSafeTrialRun === 'function');

const docsTask = buildTask(
  'T-DOCS',
  'Update router explainability docs',
  'Refresh one docs section for the router explanation text.',
  ['docs/router-explainability.md'],
);

const smokeTask = buildTask(
  'T-SMOKE',
  'Add safe trial runner smoke',
  'Add one smoke file for the new safe trial runner.',
  ['smoke/v110-60-external-worker-safe-trial-runner-smoke.js'],
);

const utilTask = buildTask(
  'T-UTIL',
  'Refactor one utility function',
  'Keep this to one small utility function.',
  ['tools/kosame-external-worker-safe-trial-runner.js'],
);

const secretTask = buildTask(
  'T-SECRET',
  'Handle KOSAME_API_KEY and .env',
  'Update API key and secret handling for .env / credentials.',
  ['docs/router-explainability.md'],
);

const customerTask = buildTask(
  'T-CUSTOMER',
  'Customer data cleanup',
  'Touch customer data and customer_name handling.',
  ['docs/router-explainability.md'],
);

const ipTask = buildTask(
  'T-IP',
  'Smart Router core full architecture update',
  'Revise the full architecture, billing flow, and orchestration core.',
  ['docs/router-explainability.md'],
);

const billingTask = buildTask(
  'T-BILLING',
  'Update billing and lead management flow',
  'Adjust pricing, subscription, and lead management logic.',
  ['docs/router-explainability.md'],
);

const docsPack = generator.buildSanitizedTaskPack(docsTask, { workerType: 'deepseek-chat' });
check('v110.58 sanitized pack stays sanitized_only', docsPack.allowedWorkerClass === 'sanitized_only');

const docsTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, { workerType: 'deepseek-chat' });
check('safe docs trial is accepted', docsTrial.accepted === true && docsTrial.status === 'accepted');
check('safe docs trial has patch gate acceptance', docsTrial.patchIntakeGate && docsTrial.patchIntakeGate.accepted === true);
check('safe docs trial includes verify candidates', Array.isArray(docsTrial.verifyCandidates) && docsTrial.verifyCandidates.includes('npm run verify') && docsTrial.verifyCandidates.includes('npm run smoke:v110-60'));
check('safe docs trial includes JSON result fields', docsTrial.sourceTaskPack && docsTrial.mockWorkerOutput && docsTrial.patchIntakeGate);

const routerTrial = router.assignWorkerByRules(docsTask, {
  generateSanitizedTaskPack: true,
  generatePatchIntakeGate: true,
  generateSafeTrialRunner: true,
});
check('router can attach safe trial runner', !!routerTrial.safeTrialRunner);
check('router-attached safe trial runner accepts sanitized docs', routerTrial.safeTrialRunner && routerTrial.safeTrialRunner.accepted === true);

const smokeTrial = runner.buildExternalWorkerSafeTrialRun(smokeTask, { workerType: 'opencode' });
check('safe smoke trial is accepted', smokeTrial.accepted === true && smokeTrial.status === 'accepted');
check('safe smoke trial returnDiffOnly respected', smokeTrial.patchIntakeGate.returnDiffOnlyRespected === true);

const utilTrial = runner.buildExternalWorkerSafeTrialRun(utilTask, { workerType: 'grok' });
check('safe utility trial is accepted', utilTrial.accepted === true && utilTrial.status === 'accepted');

const wrongWorkerPack = generator.buildSanitizedTaskPack(docsTask, { workerType: 'gpt-5.4-mini' });
const wrongWorkerTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, {
  workerType: 'gpt-5.4-mini',
  sourceTaskPack: wrongWorkerPack,
});
check('non sanitized_only task pack is rejected', wrongWorkerTrial.rejected === true && wrongWorkerTrial.humanGateRequired === true);

const outOfScopeTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, {
  workerType: 'deepseek-chat',
  mockWorkerOutput: buildMock(docsPack, 'Out of scope patch', 'tools/forbidden.js'),
});
check('out-of-scope patch is rejected', outOfScopeTrial.rejected === true);
check('out-of-scope patch touches forbidden file', outOfScopeTrial.patchIntakeGate.forbiddenFilesTouched.includes('tools/forbidden.js'));

const secretTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, {
  workerType: 'deepseek-chat',
  mockWorkerOutput: buildMock(docsPack, 'Secret patch sk-abc123secret', docsPack.allowedFiles[0], [
    '*** Begin Patch',
    `*** Update File: ${docsPack.allowedFiles[0]}`,
    '@@',
    '- old line',
    '+ secret sk-abc123secret',
    '*** End Patch',
  ].join('\n')),
});
check('secret/API key patch is human_gate', secretTrial.humanGateRequired === true && secretTrial.accepted === false);
check('secret/API key detected', secretTrial.patchIntakeGate.secretLeakDetected === true);

const customerTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, {
  workerType: 'deepseek-chat',
  mockWorkerOutput: buildMock(docsPack, 'Customer data patch', docsPack.allowedFiles[0], [
    '*** Begin Patch',
    `*** Update File: ${docsPack.allowedFiles[0]}`,
    '@@',
    '- old line',
    '+ 顧客情報 customer_name',
    '*** End Patch',
  ].join('\n')),
});
check('customer data patch is human_gate', customerTrial.humanGateRequired === true && customerTrial.accepted === false);
check('customer data detected', customerTrial.patchIntakeGate.customerDataDetected === true);

const transcriberTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, {
  workerType: 'opencode',
  mockWorkerOutput: buildMock(docsPack, 'Transcriber customer data patch', docsPack.allowedFiles[0], [
    '*** Begin Patch',
    `*** Update File: ${docsPack.allowedFiles[0]}`,
    '@@',
    '- old line',
    '+ transcriber customer data',
    '*** End Patch',
  ].join('\n')),
});
check('transcriber/customer-data patch blocks DeepSeek/opencode', transcriberTrial.humanGateRequired === true || transcriberTrial.rejected === true);

const ipTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, {
  workerType: 'deepseek-chat',
  mockWorkerOutput: buildMock(docsPack, 'IP core patch', docsPack.allowedFiles[0], [
    '*** Begin Patch',
    `*** Update File: ${docsPack.allowedFiles[0]}`,
    '@@',
    '- old line',
    '+ Smart Router core full architecture billing flow',
    '*** End Patch',
  ].join('\n')),
});
check('IP/core/full architecture patch is human_gate', ipTrial.humanGateRequired === true && ipTrial.accepted === false);
check('IP/core detected', ipTrial.patchIntakeGate.ipCoreDetected === true);
check('billing/lead management detected via IP patch', ipTrial.patchIntakeGate.billingOrLeadManagementDetected === true);

const billingTrial = runner.buildExternalWorkerSafeTrialRun(docsTask, {
  workerType: 'deepseek-chat',
  mockWorkerOutput: buildMock(docsPack, 'Billing patch', docsPack.allowedFiles[0], [
    '*** Begin Patch',
    `*** Update File: ${docsPack.allowedFiles[0]}`,
    '@@',
    '- old line',
    '+ billing flow lead management pricing subscription',
    '*** End Patch',
  ].join('\n')),
});
check('billing/lead-management patch is human_gate', billingTrial.humanGateRequired === true && billingTrial.accepted === false);
check('billing/lead-management detected', billingTrial.patchIntakeGate.billingOrLeadManagementDetected === true);

check('v110.59 patch intake gate behavior remains intact', patchGate.buildPatchIntakeGate({
  sourceTaskPack: docsPack,
  workerType: 'deepseek-chat',
  changedFiles: ['docs/router-explainability.md'],
  patchSummary: 'Update router explainability docs',
  diffText: docsTrial.mockWorkerOutput.patchText,
  declaredScope: docsPack.allowedScope,
  verifyCommands: docsPack.verifyCommands,
}).accepted === true);

if (failures > 0) {
  console.log(`\nFAIL: v110.60 external worker safe trial runner smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.60 external worker safe trial runner smoke PASSED');
