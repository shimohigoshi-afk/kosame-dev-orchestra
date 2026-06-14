#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const taskVault = require('../tools/kosame-task-vault');
const feeder = require('../tools/kosame-task-feeder');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');

const ROOT = path.resolve(__dirname, '..');
const SALES_DX_REPO = '/home/lavie/repos/kosame-sales-dx';
const DEFAULT_VAULT = path.join(os.homedir(), '.kosame', 'task-vault');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-task-feeder-'));

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

console.log('=== v110.84 task feeder smoke ===');

assert.ok(pkg.version >= '110.84.0', `package version must be >= 110.84.0 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84'], 'smoke:v110-84 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84'), 'verify must include smoke:v110-84');
console.log('  PASS: package.json version and script wiring');

const policyPath = feeder.POLICY_PATH;
mustExist(policyPath);
const policy = feeder.loadPolicy();
assert.equal(policy.maxCandidates, 3, 'policy maxCandidates must be 3');
console.log('  PASS: feeder policy exists and loads');

const defaultVaultExistedBefore = fs.existsSync(DEFAULT_VAULT);
process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;

taskVault.ensureTaskVaultLayout(TEMP_VAULT);

const currentState = taskVault.saveCurrentState(TEMP_VAULT, {
  currentMission: 'v110.84 KOSAME Task Feeder',
  targetRepo: ROOT,
  assignedAI: 'Codex',
  nextAction: 'next task feed と wishlist を小出しで確認する',
  dangerGates: ['git add / commit / push / tag は禁止'],
  verifyResult: { status: 'passed', summary: 'npm run verify PASS' },
  lastGitStatus: '## main...origin/main',
  lastVerifyResult: 'PASS',
  handoffMemo: `${secretPhrase} / ${customerPhrase}`,
  plannedFiles: ['tools/kosame-task-feeder.js', 'public/kosame-live-cockpit.html'],
  taskLists: {
    pending: ['task-a', 'task-b'],
    inProgress: ['task-c'],
    completed: ['task-f'],
    hold: ['task-h'],
  },
  decisions: ['ローカル保存のみ', '外部送信なし'],
  safetyWarnings: [secretPhrase, customerPhrase],
  wishlistCount: 6,
});
mustExist(currentState.path);

const taskInputs = [
  {
    taskId: 'task-a',
    title: 'Task Feeder の本線を固める',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'ready',
    priority: 'P0',
    risk: 'low',
    costTierEstimate: 'low',
    dependencies: [],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'short patch and smoke updates',
  },
  {
    taskId: 'task-b',
    title: 'Task Feeder の表示を確認する',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'ready',
    priority: 'P1',
    risk: 'low',
    costTierEstimate: 'high',
    dependencies: [],
    allowedFiles: ['public/kosame-live-cockpit.html'],
    expectedOutput: 'UI render note',
  },
  {
    taskId: 'task-c',
    title: '営業DX transcriber 顧客情報 Secret API key を含む観測メモ',
    project: 'kosame-sales-dx',
    repo: SALES_DX_REPO,
    status: 'ready',
    priority: 'P2',
    risk: 'low',
    costTierEstimate: 'low',
    sourceContext: `営業DX / transcriber / ${secretPhrase} / ${customerPhrase}`,
    dependencies: [],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'warning only',
  },
  {
    taskId: 'task-d',
    title: 'P3 で後回しにできる候補',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'ready',
    priority: 'P3',
    risk: 'low',
    costTierEstimate: 'low',
    dependencies: [],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'not selected due to maxCandidates',
  },
  {
    taskId: 'task-e',
    title: 'blocked task',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'blocked',
    priority: 'P0',
    risk: 'low',
    costTierEstimate: 'low',
    dependencies: [],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'excluded',
  },
  {
    taskId: 'task-f',
    title: 'done task',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'done',
    priority: 'P0',
    risk: 'low',
    costTierEstimate: 'low',
    dependencies: [],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'excluded',
  },
  {
    taskId: 'task-g',
    title: 'dependency unresolved task',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'ready',
    priority: 'P1',
    risk: 'low',
    costTierEstimate: 'low',
    dependencies: ['task-missing'],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'excluded',
  },
  {
    taskId: 'task-h',
    title: 'human gate task',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'ready',
    priority: 'P1',
    risk: 'critical',
    costTierEstimate: 'low',
    humanGateRequired: true,
    dependencies: [],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'human gate bucket',
  },
  {
    taskId: 'task-i',
    title: 'approval required task',
    project: 'KOSAME Dev Orchestra',
    repo: ROOT,
    status: 'ready',
    priority: 'P1',
    risk: 'low',
    costTierEstimate: 'approval_required',
    dependencies: [],
    allowedFiles: ['tools/kosame-task-feeder.js'],
    expectedOutput: 'human gate bucket',
  },
];

for (const task of taskInputs) {
  taskVault.appendTaskRecord(TEMP_VAULT, task);
}

const wishlistInputs = [
  {
    wishlistId: 'wishlist-001',
    title: '作業票の要約を自動で出したい',
    summary: '本線が固まったら、次にこさめが提案する短い要約を見たい',
    sourceContext: 'chat note',
    relatedVersion: '110.84.0',
    relatedProject: 'KOSAME Dev Orchestra',
    status: 'pending',
    priority: 'P1',
    timingHint: 'v110.84.0 が落ち着いたらそろそろ提案',
    whyNotNow: '今は Task Feeder を先に固める',
    suggestedAfter: '110.84.0',
    relatedCapabilities: ['summary', 'handoff'],
    risk: 'low',
    costTierEstimate: 'low',
    createdAt: '2026-06-14T11:00:00.000Z',
    updatedAt: '2026-06-14T11:05:00.000Z',
  },
  {
    wishlistId: 'wishlist-002',
    title: '次のバージョンで Smart Suggestion を広げたい',
    summary: 'Wishlist Lite の次に本格版へ進みたい',
    sourceContext: 'chat note',
    relatedVersion: '110.85.0',
    relatedProject: 'KOSAME Dev Orchestra',
    status: 'pending',
    priority: 'P2',
    timingHint: 'after v110.85.0',
    whyNotNow: '今回は seed だけで十分',
    suggestedAfter: '110.85.0',
    relatedCapabilities: ['suggestion', 'nlp'],
    risk: 'medium',
    costTierEstimate: 'medium',
    createdAt: '2026-06-14T11:01:00.000Z',
    updatedAt: '2026-06-14T11:06:00.000Z',
  },
  {
    wishlistId: 'wishlist-003',
    title: 'accepted example',
    summary: 'already accepted item',
    sourceContext: 'chat note',
    relatedVersion: '110.84.0',
    relatedProject: 'KOSAME Dev Orchestra',
    status: 'accepted',
    priority: 'P3',
    timingHint: 'accepted',
    whyNotNow: 'already accepted',
    suggestedAfter: '110.84.0',
    relatedCapabilities: ['summary'],
    risk: 'low',
    costTierEstimate: 'low',
    createdAt: '2026-06-14T11:02:00.000Z',
    updatedAt: '2026-06-14T11:07:00.000Z',
  },
  {
    wishlistId: 'wishlist-004',
    title: 'rejected example',
    summary: 'rejected item',
    sourceContext: 'chat note',
    relatedVersion: '110.84.0',
    relatedProject: 'KOSAME Dev Orchestra',
    status: 'rejected',
    priority: 'P3',
    timingHint: 'rejected',
    whyNotNow: 'not needed',
    suggestedAfter: '110.84.0',
    relatedCapabilities: ['summary'],
    risk: 'low',
    costTierEstimate: 'low',
    createdAt: '2026-06-14T11:03:00.000Z',
    updatedAt: '2026-06-14T11:08:00.000Z',
  },
  {
    wishlistId: 'wishlist-005',
    title: 'archived example',
    summary: 'archived item',
    sourceContext: 'chat note',
    relatedVersion: '110.84.0',
    relatedProject: 'KOSAME Dev Orchestra',
    status: 'archived',
    priority: 'P3',
    timingHint: 'archived',
    whyNotNow: 'archived',
    suggestedAfter: '110.84.0',
    relatedCapabilities: ['summary'],
    risk: 'low',
    costTierEstimate: 'low',
    createdAt: '2026-06-14T11:04:00.000Z',
    updatedAt: '2026-06-14T11:09:00.000Z',
  },
  {
    wishlistId: 'wishlist-006',
    title: 'suggested example',
    summary: 'suggested later idea',
    sourceContext: 'chat note',
    relatedVersion: '110.84.0',
    relatedProject: 'KOSAME Dev Orchestra',
    status: 'suggested',
    priority: 'P2',
    timingHint: 'next suggestion window',
    whyNotNow: '本線が先',
    suggestedAfter: '110.84.0',
    relatedCapabilities: ['suggestion'],
    risk: 'low',
    costTierEstimate: 'low',
    createdAt: '2026-06-14T11:10:00.000Z',
    updatedAt: '2026-06-14T11:11:00.000Z',
  },
];

for (const item of wishlistInputs) {
  feeder.saveWishlistRecord(TEMP_VAULT, item);
}

const taskRecords = taskVault.readTaskRecords(TEMP_VAULT);
const wishlistRecords = taskVault.readWishlistRecords(TEMP_VAULT);
assert.equal(taskRecords.length, taskInputs.length, 'tasks.jsonl must be readable');
assert.equal(wishlistRecords.length, wishlistInputs.length, 'wishlist.jsonl must be readable');
assert.ok(wishlistRecords.some(item => item.status === 'pending'), 'wishlist must include pending items');
assert.ok(wishlistRecords.some(item => item.status === 'suggested'), 'wishlist must include suggested items');
assert.ok(wishlistRecords.some(item => item.status === 'accepted'), 'wishlist must include accepted items');
assert.ok(wishlistRecords.some(item => item.status === 'archived'), 'wishlist must include archived items');
console.log('  PASS: task/wishlist records can be saved and read');

const feederSnapshot = feeder.buildTaskFeederSnapshot({
  taskVaultDir: TEMP_VAULT,
  currentVersion: pkg.version,
  currentMission: 'v110.84 KOSAME Task Feeder',
});

assert.equal(feederSnapshot.selectedTasks.length, 3, 'selectedTasks must be capped at 3');
assert.deepEqual(
  feederSnapshot.selectedTasks.map(task => task.taskId),
  ['task-a', 'task-b', 'task-c'],
  'selected tasks must be sorted by priority and ready state',
);
assert.ok(!feederSnapshot.selectedTasks.some(task => ['task-d', 'task-e', 'task-f', 'task-g', 'task-h', 'task-i'].includes(task.taskId)),
  'blocked/done/unresolved/human gate tasks must not be in selectedTasks');
assert.ok(feederSnapshot.blockedTasks.some(task => task.taskId === 'task-e'), 'blocked task must be excluded');
assert.ok(feederSnapshot.blockedTasks.some(task => task.taskId === 'task-g'), 'dependency unresolved task must be excluded');
assert.ok(feederSnapshot.humanGateTasks.some(task => task.taskId === 'task-h'), 'human gate task must be separated');
assert.ok(feederSnapshot.humanGateTasks.some(task => task.taskId === 'task-i'), 'approval required task must be separated');
assert.ok(feederSnapshot.warnings.some(line => line.includes('costTier=high')), 'high cost tier warning must exist');
assert.ok(feederSnapshot.warnings.some(line => line.includes('営業DX') || line.includes('DeepSeek') || line.includes('redacted')),
  'sales_dx / transcriber / secret warnings must exist');
assert.equal(feederSnapshot.wishlist.pendingCount, 2, 'wishlist pending count must be 2');
assert.equal(feederSnapshot.wishlist.suggestedCount, 1, 'wishlist suggested count must be 1');
assert.equal(feederSnapshot.wishlist.acceptedCount, 1, 'wishlist accepted count must be 1');
assert.equal(feederSnapshot.wishlist.rejectedCount, 1, 'wishlist rejected count must be 1');
assert.equal(feederSnapshot.wishlist.archivedCount, 1, 'wishlist archived count must be 1');
assert.ok(feederSnapshot.wishlist.nextSuggestionCandidates.some(item => item.wishlistId === 'wishlist-001'),
  'timingHint / suggestedAfter matching wishlist must surface');
assert.ok(feederSnapshot.wishlist.nextSuggestionCandidates.every(item => item.status === 'pending' || item.status === 'suggested'),
  'nextSuggestionCandidates must remain in wishlist states');
console.log('  PASS: task feeder selection and wishlist filtering work');

const cockpit = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
  devRepoPath: ROOT,
  salesRepoPath: SALES_DX_REPO,
  activeRepoPath: ROOT,
});

assert.ok(cockpit.taskFeeder, 'cockpit snapshot must include taskFeeder');
assert.ok(cockpit.taskFeeder.selectedTasks.length === 3, 'cockpit taskFeeder must carry selected tasks');
assert.ok(cockpit.taskFeeder.wishlist.pendingCount === 2, 'cockpit taskFeeder must carry wishlist state');
assert.ok(Array.isArray(cockpit.taskFeeder.warnings), 'cockpit taskFeeder warnings must be array');
assert.ok(cockpit.taskFeeder.warnings.some(line => line.includes('営業DX') || line.includes('DeepSeek')),
  'cockpit taskFeeder warnings must include safety warning');
assert.ok(cockpit.wishlist, 'cockpit snapshot must include wishlist alias');
assert.ok(cockpit.nextAction.includes('NEXT TASK FEED') || cockpit.nextAction.includes('候補'),
  'cockpit nextAction must mention task feeder candidates');
console.log('  PASS: cockpit snapshot includes taskFeeder / wishlist');

const htmlPath = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const html = readText(htmlPath);
assert.ok(html.includes('NEXT TASK FEED'), 'HTML must include NEXT TASK FEED');
assert.ok(html.includes('WISHLIST / LATER IDEAS'), 'HTML must include WISHLIST / LATER IDEAS');
assert.ok(!html.includes('Codexへの自動応答送信'), 'HTML must not advertise auto Codex sending');
console.log('  PASS: HTML sections and safety text checks');

const allFiles = walkFiles(TEMP_VAULT).map((file) => readText(file));
assert.ok(!allFiles.join('\n').includes(secretPhrase), 'no raw secret phrase may be persisted');
assert.ok(!allFiles.join('\n').includes(customerPhrase), 'no raw customer phrase may be persisted');

if (!defaultVaultExistedBefore) {
  assert.ok(!fs.existsSync(DEFAULT_VAULT), 'default ~/.kosame/task-vault must not be created by smoke');
}

console.log('✅ v110.84 task feeder smoke PASSED');
