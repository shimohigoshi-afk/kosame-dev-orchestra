#!/usr/bin/env node
'use strict';

const pkg  = require('../package.json');
const gate = require('../tools/kosame-google-cloud-runtime-readiness-gate');

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
  if (Array.isArray(value)) return value.some(v => includesText(v, fragment));
  return String(value || '').toLowerCase().includes(String(fragment || '').toLowerCase());
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

console.log('=== v110.65 google cloud runtime readiness gate smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.65.0', versionAtLeast(pkg.version, 110, 65));
check('TOOL_META exported', gate.TOOL_META?.version === '110.65.0');
check('STATUS constants exported', gate.STATUS?.ready === 'ready' && gate.STATUS?.blocked === 'blocked');
check('KNOWN_GCP_REGIONS exported', gate.KNOWN_GCP_REGIONS instanceof Set && gate.KNOWN_GCP_REGIONS.has('us-central1'));
check('DANGER_PATTERNS exported', Array.isArray(gate.DANGER_PATTERNS) && gate.DANGER_PATTERNS.length >= 8);
check('buildRuntimeReadinessGate exported', typeof gate.buildRuntimeReadinessGate === 'function');
check('evaluateDangerGates exported', typeof gate.evaluateDangerGates === 'function');
check('validateProjectId exported', typeof gate.validateProjectId === 'function');
check('validateRegion exported', typeof gate.validateRegion === 'function');
check('validateCloudRunService exported', typeof gate.validateCloudRunService === 'function');
check('validateSchedulerJobName exported', typeof gate.validateSchedulerJobName === 'function');
check('validateSchedule exported', typeof gate.validateSchedule === 'function');
check('validateEnvKeyNames exported', typeof gate.validateEnvKeyNames === 'function');
check('validateSecretRefNames exported', typeof gate.validateSecretRefNames === 'function');
check('checkGitHubActionsWorkflows exported', typeof gate.checkGitHubActionsWorkflows === 'function');
check('checkLocalCli exported', typeof gate.checkLocalCli === 'function');
check('checkDangerGates exported', typeof gate.checkDangerGates === 'function');
check('printReadinessDashboard exported', typeof gate.printReadinessDashboard === 'function');

// ── validateProjectId ─────────────────────────────────────────────────────────

check('valid projectId passes', gate.validateProjectId('kosame-dev-project').ok === true);
check('missing projectId fails', gate.validateProjectId('').ok === false);
check('uppercase projectId fails', gate.validateProjectId('MyProject').ok === false);
check('too-short projectId fails', gate.validateProjectId('abc').ok === false);
check('projectId with spaces fails', gate.validateProjectId('my project').ok === false);

// ── validateRegion ────────────────────────────────────────────────────────────

check('known region passes', gate.validateRegion('us-central1').ok === true);
check('known Asia region passes', gate.validateRegion('asia-northeast1').ok === true);
check('missing region fails', gate.validateRegion('').ok === false);
check('unknown region is caution (not hard fail)', (() => {
  const r = gate.validateRegion('mars-north1');
  return r.ok === false && r.caution === true;
})());

// ── validateCloudRunService ───────────────────────────────────────────────────

check('valid service name passes', gate.validateCloudRunService('kosame-api').ok === true);
check('missing service name skipped', gate.validateCloudRunService('').skipped === true);
check('uppercase service name fails', gate.validateCloudRunService('KosameAPI').ok === false);
check('service name with underscore fails', gate.validateCloudRunService('kosame_api').ok === false);

// ── validateSchedulerJobName ──────────────────────────────────────────────────

check('valid job name passes', gate.validateSchedulerJobName('kosame-daily-job').ok === true);
check('missing job name skipped', gate.validateSchedulerJobName('').skipped === true);
check('job name starting with number fails', gate.validateSchedulerJobName('1bad-name').ok === false);

// ── validateSchedule ──────────────────────────────────────────────────────────

check('cron 5-field schedule passes', gate.validateSchedule('0 9 * * 1-5').ok === true);
check('"every N minutes" schedule passes', gate.validateSchedule('every 5 minutes').ok === true);
check('"every 1 hour" schedule passes', gate.validateSchedule('every 1 hour').ok === true);
check('missing schedule skipped', gate.validateSchedule('').skipped === true);
check('invalid schedule is caution', (() => {
  const r = gate.validateSchedule('daily at 9am');
  return r.ok === false && r.caution === true;
})());

// ── validateEnvKeyNames ───────────────────────────────────────────────────────

check('valid env key names pass', gate.validateEnvKeyNames(['OPENAI_API_KEY', 'GEMINI_KEY']).ok === true);
check('empty env keys skipped', gate.validateEnvKeyNames([]).skipped === true);
check('lowercase env key fails', gate.validateEnvKeyNames(['openai_key']).ok === false);
check('env key with spaces fails', gate.validateEnvKeyNames(['MY KEY']).ok === false);
check('valid env keys list is preserved', gate.validateEnvKeyNames(['KEY_A', 'KEY_B']).keys?.length === 2);

// ── validateSecretRefNames ────────────────────────────────────────────────────

check('valid secret ref names pass', gate.validateSecretRefNames(['kosame-openai-key', 'my_secret_123']).ok === true);
check('empty secret refs skipped', gate.validateSecretRefNames([]).skipped === true);
check('secret name with spaces fails', gate.validateSecretRefNames(['my secret']).ok === false);
check('secret ref names are preserved in result', gate.validateSecretRefNames(['sec-a', 'sec-b']).names?.length === 2);

// ── checkDangerGates ──────────────────────────────────────────────────────────

// No danger — clean context
const cleanCtx = { dryRun: true };
const noDanger = gate.checkDangerGates(cleanCtx);
check('clean context triggers no danger gates', noDanger.length === 0);

// Real deploy
const deployCtx = { deploy: true };
const deployDanger = gate.checkDangerGates(deployCtx);
check('deploy=true triggers danger gate', deployDanger.some(d => d.id === 'real_deploy_attempt'));

// Real IAM mutation
const iamCtx = { addIamPolicy: true };
const iamDanger = gate.checkDangerGates(iamCtx);
check('addIamPolicy=true triggers danger gate', iamDanger.some(d => d.id === 'real_iam_mutation'));

// Real Scheduler mutation
const schedulerCtx = { createSchedulerJob: true };
const schedulerDanger = gate.checkDangerGates(schedulerCtx);
check('createSchedulerJob=true triggers danger gate', schedulerDanger.some(d => d.id === 'real_scheduler_mutation'));

// Secret access
const secretCtx = { readSecret: true };
const secretDanger = gate.checkDangerGates(secretCtx);
check('readSecret=true triggers danger gate', secretDanger.some(d => d.id === 'real_secret_access'));

// Secret value in context
const secretValCtx = { secretValue: 'my-secret-value' };
const secretValDanger = gate.checkDangerGates(secretValCtx);
check('secretValue present triggers danger gate', secretValDanger.some(d => d.id === 'real_secret_access'));

// .env file in targetFiles
const envFileCtx = { targetFiles: ['.env', 'tools/foo.js'] };
const envFileDanger = gate.checkDangerGates(envFileCtx);
check('.env in targetFiles triggers danger gate', envFileDanger.some(d => d.id === 'env_credentials_access'));

// credentials.json in targetFiles
const credFileCtx = { targetFiles: ['credentials.json'] };
const credFileDanger = gate.checkDangerGates(credFileCtx);
check('credentials.json in targetFiles triggers danger gate', credFileDanger.some(d => d.id === 'env_credentials_access'));

// Sales DX
const salesCtx = { isSalesDx: true };
const salesDanger = gate.checkDangerGates(salesCtx);
check('isSalesDx=true triggers danger gate', salesDanger.some(d => d.id === 'sales_dx_access'));

// ANESTY Board
const anestyCtx = { anestyBoard: true };
const anestyDanger = gate.checkDangerGates(anestyCtx);
check('anestyBoard=true triggers danger gate', anestyDanger.some(d => d.id === 'anesty_board_access'));

// Customer data
const customerCtx = { pii: true };
const customerDanger = gate.checkDangerGates(customerCtx);
check('pii=true triggers danger gate', customerDanger.some(d => d.id === 'customer_data_access'));

// High cost without approval
const highCostCtx = { requestedModel: 'gpt-5.5', approvalReceived: false };
const highCostDanger = gate.checkDangerGates(highCostCtx);
check('gpt-5.5 without approval triggers danger gate', highCostDanger.some(d => d.id === 'high_cost_without_approval'));

// High cost WITH approval — no danger
const highCostApprovedCtx = { requestedModel: 'gpt-5.5', approvalReceived: true };
const highCostApprovedDanger = gate.checkDangerGates(highCostApprovedCtx);
check('gpt-5.5 WITH approval does not trigger danger gate', !highCostApprovedDanger.some(d => d.id === 'high_cost_without_approval'));

// ── evaluateDangerGates ───────────────────────────────────────────────────────

const evalClean = gate.evaluateDangerGates({});
check('evaluateDangerGates: clean = not triggered', evalClean.triggered === false);
check('evaluateDangerGates: clean humanGateRequired = false', evalClean.humanGateRequired === false);

const evalDeploy = gate.evaluateDangerGates({ deploy: true });
check('evaluateDangerGates: deploy = triggered', evalDeploy.triggered === true);
check('evaluateDangerGates: deploy humanGateRequired = true', evalDeploy.humanGateRequired === true);
check('evaluateDangerGates: deploy humanGateReason is string', typeof evalDeploy.humanGateReason === 'string' && evalDeploy.humanGateReason.length > 0);

// ── buildRuntimeReadinessGate — ready ────────────────────────────────────────

const readyResult = gate.buildRuntimeReadinessGate(
  {
    projectId: 'kosame-prod-project',
    region: 'us-central1',
    cloudRunService: 'kosame-api',
    schedulerJobName: 'kosame-cron',
    schedule: '0 9 * * *',
    requiredEnvKeys: ['OPENAI_API_KEY'],
    secretRefNames: ['my-secret'],
    workflowFiles: [],
    requiredCli: [],
  },
  {},
);
check('ready result status is ready or caution', readyResult.status === 'ready' || readyResult.status === 'caution');
check('ready result dryRun=true', readyResult.dryRun === true);
check('ready result dangerGateTriggered=false', readyResult.dangerGateTriggered === false);
check('ready result humanApprovalRequired=false', readyResult.humanApprovalRequired === false);
check('ready result has timestamp', typeof readyResult.timestamp === 'string');
check('ready result has version', readyResult.version === '110.65.0');
check('ready result has checkedItems', Array.isArray(readyResult.checkedItems) && readyResult.checkedItems.length > 0);
check('ready result has blockedReasons array', Array.isArray(readyResult.blockedReasons));
check('ready result has cautions array', Array.isArray(readyResult.cautions));
check('ready result has nextAllowedAction', typeof readyResult.nextAllowedAction === 'string');

// ── buildRuntimeReadinessGate — blocked ──────────────────────────────────────

const blockedResult = gate.buildRuntimeReadinessGate(
  { projectId: 'INVALID PROJECT ID!', region: 'us-central1' },
  {},
);
check('blocked result status is blocked', blockedResult.status === 'blocked');
check('blocked result has blockedReasons', blockedResult.blockedReasons.length > 0);
check('blocked result nextAllowedAction mentions fix', includesText(blockedResult.nextAllowedAction, 'fix'));

// ── buildRuntimeReadinessGate — caution ──────────────────────────────────────

const cautionResult = gate.buildRuntimeReadinessGate(
  { projectId: 'kosame-project', region: 'mars-west1' },
  {},
);
check('unknown region yields caution or blocked', cautionResult.status === 'caution' || cautionResult.status === 'blocked');
check('caution result has cautions or blockedReasons', cautionResult.cautions.length > 0 || cautionResult.blockedReasons.length > 0);

// ── buildRuntimeReadinessGate — danger gate (human_gate) ─────────────────────

const dangerResult = gate.buildRuntimeReadinessGate(
  { projectId: 'kosame-project', region: 'us-central1' },
  { deploy: true, isSalesDx: true },
);
check('danger context yields human_gate status', dangerResult.status === 'human_gate');
check('danger result humanApprovalRequired=true', dangerResult.humanApprovalRequired === true);
check('danger result dangerGateTriggered=true', dangerResult.dangerGateTriggered === true);
check('danger result dangerGates list not empty', dangerResult.dangerGates.length > 0);
check('danger result nextAllowedAction mentions human', includesText(dangerResult.nextAllowedAction, 'human'));
check('danger result blockedReasons contain DANGER tag', dangerResult.blockedReasons.some(r => includesText(r, '[DANGER]')));

// ── buildRuntimeReadinessGate — secret value must NOT leak into result ────────

const secretLeakResult = gate.buildRuntimeReadinessGate(
  { projectId: 'kosame-project', region: 'us-central1', secretRefNames: ['my-secret'] },
  { readSecret: true },
);
check('readSecret=true triggers human_gate (not passes secret)', secretLeakResult.status === 'human_gate');
check('secret values do not appear in checkedItems', !JSON.stringify(secretLeakResult.checkedItems).includes('secret-value'));

// ── buildRuntimeReadinessGate — missing projectId ─────────────────────────────

const noProjectResult = gate.buildRuntimeReadinessGate({ region: 'us-central1' }, {});
check('missing projectId results in blocked', noProjectResult.status === 'blocked');
check('missing projectId blockedReasons mentions projectId', includesText(noProjectResult.blockedReasons, 'projectid'));

// ── buildRuntimeReadinessGate — env key validation ───────────────────────────

const badEnvResult = gate.buildRuntimeReadinessGate(
  { projectId: 'kosame-project', region: 'us-central1', requiredEnvKeys: ['bad-key-name'] },
  {},
);
check('invalid env key name results in blocked', badEnvResult.status === 'blocked');

// ── buildRuntimeReadinessGate — GitHub Actions workflow check ─────────────────

const wfResult = gate.buildRuntimeReadinessGate(
  {
    projectId: 'kosame-project',
    region: 'us-central1',
    workflowFiles: ['verify.yml'],
    repoRoot: process.cwd(),
  },
  {},
);
// verify.yml exists in this repo
check('existing workflow file is found', wfResult.checkedItems.some(i => i.item === 'workflowFiles' && i.result !== 'fail'));

const missingWfResult = gate.buildRuntimeReadinessGate(
  {
    projectId: 'kosame-project',
    region: 'us-central1',
    workflowFiles: ['nonexistent-workflow-xyz.yml'],
    repoRoot: process.cwd(),
  },
  {},
);
check('missing workflow file triggers caution', missingWfResult.cautions.some(ca => includesText(ca, 'nonexistent-workflow-xyz')));
check('missing workflow file in missingItems', missingWfResult.missingItems.some(m => includesText(m, 'workflow')));

// ── printReadinessDashboard does not throw ────────────────────────────────────

let dashboardOk = true;
try {
  const origLog = console.log;
  console.log = () => {};
  gate.printReadinessDashboard(readyResult);
  gate.printReadinessDashboard(dangerResult);
  gate.printReadinessDashboard(blockedResult);
  console.log = origLog;
} catch (e) {
  dashboardOk = false;
}
check('printReadinessDashboard does not throw', dashboardOk);

// ── dryRun flag is always true ────────────────────────────────────────────────

const dryRunCheck = gate.buildRuntimeReadinessGate({ projectId: 'test-project1', region: 'us-central1' }, { liveMode: false });
check('dryRun is always true in result', dryRunCheck.dryRun === true);

// ── Result ────────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.log(`\nFAIL: v110.65 google cloud runtime readiness gate smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.65 google cloud runtime readiness gate smoke PASSED');
