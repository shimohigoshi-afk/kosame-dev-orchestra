#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const {
  createTaskVault,
  ensureTaskVaultLayout,
  getTaskVaultPaths,
  saveCurrentState,
  appendTaskRecord,
  appendDecisionRecord,
  writeHandoffMarkdown,
  readTaskVaultOverview,
} = require('../tools/kosame-task-vault');
const {
  AUTOSAVE_INTERVAL_MINUTES,
  CHECKPOINT_INTERVAL_MINUTES,
  buildAutoSaveSnapshot,
  saveAutoSaveState,
  saveCheckpointState,
} = require('../tools/kosame-autosave-state');
const {
  appendCostLedgerRecord,
  aggregateCostLedger,
  saveCostSummary,
} = require('../tools/kosame-cost-meter');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');

const ROOT = path.resolve(__dirname, '..');
const SALES_DX_REPO = '/home/lavie/repos/kosame-sales-dx';
const DEFAULT_VAULT = path.join(os.homedir(), '.kosame', 'task-vault');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-task-vault-'));

const secretPhrase = 'OPENAI_API_KEY=sk-test-1234567890';
const customerPhrase = '顧客情報: 山田太郎 / customer@example.com';

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(dirPath) {
  const files = [];
  if (!fs.existsSync(dirPath)) return files;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function includesAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

console.log('=== v110.83 task vault / autosave / cost meter smoke ===');

assert.equal(pkg.version, '110.83.0', `package version must be 110.83.0 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-83'], 'smoke:v110-83 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-83'), 'verify must include smoke:v110-83');
console.log('  PASS: package.json version and script wiring');

const configPath = path.join(ROOT, 'config', 'provider-pricing-estimates.json');
mustExist(configPath);
const configText = readText(configPath);
assert.ok(configText.includes('sessionBudgetUsd'), 'pricing config must include sessionBudgetUsd');
assert.ok(configText.includes('highCostModelHumanGate'), 'pricing config must include highCostModelHumanGate');
console.log('  PASS: pricing config exists and has budget settings');

const defaultVaultExistedBefore = fs.existsSync(DEFAULT_VAULT);

process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;

const vault = createTaskVault(TEMP_VAULT);
assert.equal(vault.paths.root, TEMP_VAULT, 'createTaskVault must use KOSAME_TASK_VAULT_DIR');
assert.equal(getTaskVaultPaths(TEMP_VAULT).root, TEMP_VAULT, 'getTaskVaultPaths must resolve temp vault');
ensureTaskVaultLayout(TEMP_VAULT);
console.log('  PASS: task vault layout uses temp directory');

const currentStateInput = {
  currentMission: 'v110.83 KOSAME Task Vault & Auto Save',
  targetRepo: ROOT,
  assignedAI: 'Codex',
  nextAction: '次のタスクを選んで、ローカル保存を続ける',
  dangerGates: ['git add / commit / push / tag は禁止'],
  verifyResult: { status: 'passed', summary: 'npm run verify PASS' },
  lastGitStatus: '## main...origin/main',
  lastVerifyResult: 'PASS',
  handoffMemo: `${secretPhrase} / ${customerPhrase}`,
  plannedFiles: ['tools/kosame-task-vault.js', 'tools/kosame-autosave-state.js'],
  taskLists: {
    pending: ['API COST METER の確認'],
    inProgress: ['Task Vault 保存'],
    completed: ['初期ロジック実装'],
    hold: ['人間承認待ち'],
  },
  decisions: ['ローカル保存のみ', '外部送信なし'],
  safetyWarnings: [secretPhrase, customerPhrase],
  latestCheckpointAt: '2026-06-14T09:20:00.000Z',
};

const currentState = saveCurrentState(TEMP_VAULT, currentStateInput);
mustExist(currentState.path);
const currentStateText = readText(currentState.path);
assert.ok(!currentStateText.includes(secretPhrase), 'current-state.json must not contain raw secret phrase');
assert.ok(!currentStateText.includes(customerPhrase), 'current-state.json must not contain raw customer phrase');
assert.ok(currentStateText.includes('[REDACTED'), 'current-state.json must redact sensitive values');

const taskRecord = appendTaskRecord(TEMP_VAULT, {
  title: `API usage audit ${secretPhrase}`,
  status: 'in_progress',
  notes: customerPhrase,
});
const decisionRecord = appendDecisionRecord(TEMP_VAULT, {
  decision: `keep local only ${secretPhrase}`,
  reason: customerPhrase,
});
mustExist(taskRecord.path);
mustExist(decisionRecord.path);

const taskJsonlText = readText(taskRecord.path);
const decisionJsonlText = readText(decisionRecord.path);
assert.ok(!taskJsonlText.includes(secretPhrase), 'tasks.jsonl must not contain raw secret phrase');
assert.ok(!decisionJsonlText.includes(customerPhrase), 'decisions.jsonl must not contain raw customer phrase');
assert.ok(taskJsonlText.includes('[REDACTED'), 'tasks.jsonl must redact sensitive values');
assert.ok(decisionJsonlText.includes('[REDACTED'), 'decisions.jsonl must redact sensitive values');

const costRecords = [
  { model: 'gpt-4o-mini', provider: 'openai', inputTokens: 1200, outputTokens: 400, recordedAt: '2026-06-14T09:21:00.000Z' },
  { model: 'claude-sonnet-4.5', provider: 'anthropic', inputTokens: 2200, outputTokens: 700, recordedAt: '2026-06-14T09:22:00.000Z' },
  { model: 'gemini-2.5-flash', provider: 'gemini', inputTokens: 1800, outputTokens: 600, recordedAt: '2026-06-14T09:23:00.000Z' },
  { model: 'grok-3', provider: 'grok', inputTokens: 1500, outputTokens: 500, recordedAt: '2026-06-14T09:24:00.000Z' },
  { model: 'deepseek-chat', provider: 'deepseek', inputTokens: 1100, outputTokens: 300, recordedAt: '2026-06-14T09:25:00.000Z' },
  { model: 'meta-llama/llama-3.1-70b-instruct', provider: 'llama', inputTokens: 900, outputTokens: 250, recordedAt: '2026-06-14T09:26:00.000Z' },
  { model: 'gpt-5.5', provider: 'openai', inputTokens: 2500, outputTokens: 900, recordedAt: '2026-06-14T09:27:00.000Z', meta: { gate: 'approval_required' } },
  { model: 'unknown', provider: 'unknown', meta: { secret: secretPhrase, customer: customerPhrase }, recordedAt: '2026-06-14T09:28:00.000Z' },
];

for (const record of costRecords) {
  appendCostLedgerRecord(TEMP_VAULT, record);
}

const costSnapshot = aggregateCostLedger(TEMP_VAULT, { now: '2026-06-14T09:30:00.000Z' });
saveCostSummary(TEMP_VAULT, costSnapshot);
mustExist(costSnapshot.ledgerPath);
mustExist(costSnapshot.summaryPath);

const ledgerText = readText(costSnapshot.ledgerPath);
const summaryText = readText(costSnapshot.summaryPath);
assert.ok(!ledgerText.includes(secretPhrase), 'cost-ledger.jsonl must not contain raw secret phrase');
assert.ok(!ledgerText.includes(customerPhrase), 'cost-ledger.jsonl must not contain raw customer phrase');
assert.ok(!summaryText.includes(secretPhrase), 'cost-summary.json must not contain raw secret phrase');
assert.ok(!summaryText.includes(customerPhrase), 'cost-summary.json must not contain raw customer phrase');
assert.ok(summaryText.includes('概算'), 'cost summary must keep approximate wording');

const autoSnapshot = buildAutoSaveSnapshot({ taskVaultDir: TEMP_VAULT, savedAt: '2026-06-14T09:30:00.000Z' });
assert.equal(autoSnapshot.taskVault.root, TEMP_VAULT, 'autosave snapshot must point at temp vault');
assert.equal(autoSnapshot.autoSave.autoSaveIntervalMinutes, AUTOSAVE_INTERVAL_MINUTES, 'autosave interval must be 10 min');
assert.equal(autoSnapshot.autoSave.checkpointIntervalMinutes, CHECKPOINT_INTERVAL_MINUTES, 'checkpoint interval must be 50 min');
assert.ok(autoSnapshot.autoSave.nextAutosaveAt, 'nextAutosaveAt must exist');
assert.ok(autoSnapshot.autoSave.nextCheckpointAt, 'nextCheckpointAt must exist');

const autoSave = saveAutoSaveState(TEMP_VAULT, { taskVault: autoSnapshot.taskVault, savedAt: '2026-06-14T09:31:00.000Z' });
const checkpoint = saveCheckpointState(TEMP_VAULT, { taskVault: autoSnapshot.taskVault, savedAt: '2026-06-14T09:32:00.000Z' });
mustExist(autoSave.saved.path);
mustExist(checkpoint.saved.path);

const handoff = writeHandoffMarkdown(TEMP_VAULT, `handoff memo\n- keep local only\n- ${secretPhrase}\n- ${customerPhrase}`);
mustExist(handoff.path);
const handoffText = readText(handoff.path);
assert.ok(!handoffText.includes(secretPhrase), 'handoff must not contain raw secret phrase');
assert.ok(!handoffText.includes(customerPhrase), 'handoff must not contain raw customer phrase');

const overview = readTaskVaultOverview(TEMP_VAULT);
assert.equal(overview.root, TEMP_VAULT, 'overview must use temp vault');
assert.equal(overview.currentTaskCount, 3, 'current task count must reflect pending/inProgress/hold');
assert.equal(overview.handoffExists, true, 'handoff must exist');
assert.ok(overview.warningCount >= 1, 'overview should detect safety warnings');

const cockpit = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
  devRepoPath: ROOT,
  salesRepoPath: SALES_DX_REPO,
  activeRepoPath: ROOT,
});

assert.ok(cockpit.taskVault, 'cockpit snapshot must include taskVault');
assert.ok(cockpit.autoSave, 'cockpit snapshot must include autoSave');
assert.ok(cockpit.apiCost, 'cockpit snapshot must include apiCost');
assert.ok(cockpit.apiCost.total, 'apiCost.total must exist');
assert.ok(cockpit.apiCost.byProvider, 'apiCost.byProvider must exist');
assert.ok(Array.isArray(cockpit.apiCost.byModel), 'apiCost.byModel must be an array');
assert.ok(cockpit.apiCost.total.sessionUsd > 0, 'session total must be greater than zero');
assert.ok(cockpit.apiCost.byProvider.OpenAI, 'OpenAI provider aggregate must exist');
assert.ok(cockpit.apiCost.byProvider.Anthropic, 'Anthropic provider aggregate must exist');
assert.ok(cockpit.apiCost.byProvider.Gemini, 'Gemini provider aggregate must exist');
assert.ok(cockpit.apiCost.byProvider.Grok, 'Grok provider aggregate must exist');
assert.ok(cockpit.apiCost.byProvider.DeepSeek, 'DeepSeek provider aggregate must exist');
assert.ok(cockpit.apiCost.byProvider['Llama/Meta'], 'Llama/Meta provider aggregate must exist');
assert.ok(cockpit.apiCost.byProvider.unknown, 'unknown provider aggregate must exist');
assert.ok(cockpit.apiCost.unknownUsageCount >= 1, 'unknown usage must be counted');
assert.ok(cockpit.apiCost.highCostModelWarning, 'high cost model warning must be true');
assert.ok(cockpit.apiCost.warnings.some((line) => line.includes('明示承認')), 'warnings must mention human approval');
assert.ok(cockpit.apiCost.note.includes('概算'), 'api cost note must say approximate');
assert.ok(cockpit.apiCost.total.note.includes('実請求額ではありません'), 'total note must say not actual billing');
assert.ok(cockpit.apiCost.byModel.some((item) => item.model === 'gpt-5.5' && item.budgetTier === 'approval_required'), 'gpt-5.5 must be approval_required');
assert.ok(cockpit.apiCost.byModel.some((item) => item.model === 'unknown' && item.warning), 'unknown model must be flagged');

const htmlPath = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const html = readText(htmlPath);
assert.ok(html.includes('AUTO SAVE / TASK VAULT'), 'HTML must include AUTO SAVE / TASK VAULT');
assert.ok(html.includes('API COST METER'), 'HTML must include API COST METER');
assert.ok(html.includes('このセッション概算'), 'HTML must include session estimate label');
assert.ok(html.includes('概算であり実請求額ではありません'), 'HTML must include non-billing note');
assert.ok(!html.includes('実請求額です'), 'HTML must not assert actual billing as a fact');

const allFiles = walkFiles(TEMP_VAULT).map((file) => readText(file));
assert.ok(!includesAny(allFiles.join('\n'), [secretPhrase, customerPhrase]), 'no raw secret/customer strings may be persisted');

if (!defaultVaultExistedBefore) {
  assert.ok(!fs.existsSync(DEFAULT_VAULT), 'default ~/.kosame/task-vault must not be created by smoke');
}

console.log('✅ v110.83 task vault / autosave / cost meter smoke PASSED');
