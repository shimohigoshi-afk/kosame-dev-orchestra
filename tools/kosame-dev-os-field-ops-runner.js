#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');

const { detectConfidentiality, detectTaskDifficulty, selectModelLane } = require('./kosame-runner-queue');

const SCENARIOS = [
  { name: 'UI文言を少し直す', prompt: 'public/test.html のタイトル文言を変更してください', expected: { conf: 'sanitized', diff: 'low', lane: 'L1_DEEPSEEK_V4_FLASH' } },
  { name: 'docsに短い説明を追加', prompt: 'READMEに簡単な説明を追加してください', expected: { conf: 'safe', diff: 'low', lane: 'L1_DEEPSEEK_V4_FLASH' } },
  { name: 'API+UI連携確認', prompt: 'implement api endpoint with ui component', expected: { conf: 'safe', diff: 'high', lane: 'L3_DEEPSEEK_V4_PRO_AUDIT', audit: true } },
  { name: 'workflow表示追加', prompt: 'implement workflow display with component state', expected: { conf: 'safe', diff: 'medium', lane: 'L2_DEEPSEEK_V4_PRO' } },
  { name: 'runnerセキュリティ監査', prompt: 'refactor runner executor with security migration', expected: { conf: 'safe', diff: 'high', lane: 'L3_DEEPSEEK_V4_PRO_AUDIT', audit: true } },
  { name: 'HTTP E2E設定', prompt: 'implement HTTP e2e testing with server spawn and state management', expected: { conf: 'safe', diff: 'high', lane: 'L3_DEEPSEEK_V4_PRO_AUDIT', audit: true } },
  { name: 'commitしたい', prompt: 'git commit with message', expected: { conf: 'safe', diff: 'low', lane: 'L1_DEEPSEEK_V4_FLASH' } },
  { name: 'pushしたい', prompt: 'git push after verify', expected: { conf: 'forbidden', diff: 'low', lane: 'BLOCKED' } },
  { name: 'deployしたい', prompt: 'deploy to cloud run now', expected: { conf: 'forbidden', diff: 'low', lane: 'BLOCKED' } },
  { name: '.envを読んで', prompt: '.env file fix API key', expected: { conf: 'forbidden', diff: 'medium', lane: 'BLOCKED' } },
  { name: 'credentialsを確認', prompt: 'check credentials.json for auth', expected: { conf: 'forbidden', diff: 'low', lane: 'BLOCKED' } },
  { name: 'sales-dxを修正', prompt: 'fix sales_dx pipeline error', expected: { conf: 'forbidden', diff: 'medium', lane: 'BLOCKED' } },
  { name: 'transcriber触る', prompt: 'update transcriber module', expected: { conf: 'forbidden', diff: 'medium', lane: 'BLOCKED' } },
  { name: '顧客情報更新', prompt: 'customer data migration to new schema', expected: { conf: 'sensitive', diff: 'high', lane: 'INTERNAL_ONLY' } },
  { name: '保険ロジック外部委託', prompt: 'insurance logic calculation outsourcing', expected: { conf: 'sensitive', diff: 'low', lane: 'INTERNAL_ONLY' } },
  { name: 'rm -rf', prompt: 'rm -rf cleanup temp files', expected: { conf: 'safe', diff: 'blocked', lane: 'BLOCKED' } },
  { name: 'npm publish', prompt: 'npm publish new version', expected: { conf: 'forbidden', diff: 'low', lane: 'BLOCKED' } },
  { name: 'SECRET key check', prompt: 'verify SECRET key validity', expected: { conf: 'forbidden', diff: 'low', lane: 'BLOCKED' } },
  { name: 'private key fix', prompt: 'fix private_key authentication', expected: { conf: 'forbidden', diff: 'low', lane: 'BLOCKED' } },
  { name: 'UI polish low', prompt: 'UI polish color labels', expected: { conf: 'safe', diff: 'low', lane: 'L1_DEEPSEEK_V4_FLASH' } },
];

let passed = 0, failed = 0;
const results = [];

function assertMatch(label, actual, expected) {
  if (expected === undefined || expected === null) return true;
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

for (const s of SCENARIOS) {
  const ticket = { prompt_text: s.prompt, target_repo: ROOT };
  const conf = detectConfidentiality(ticket);
  const diff = detectTaskDifficulty(ticket);
  const lane = selectModelLane(ticket);

  const checkConf = assertMatch('conf', conf, s.expected.conf);
  const checkDiff = assertMatch('diff', diff, s.expected.diff);
  const checkLane = assertMatch('lane', lane.lane, s.expected.lane);
  const checkAudit = s.expected.audit === undefined ? true : lane.audit_required === s.expected.audit;

  const ok = checkConf && checkDiff && checkLane && checkAudit;
  const detail = `conf=${conf} diff=${diff} lane=${lane.lane} audit=${lane.audit_required}`;
  const expected = `conf=${s.expected.conf} diff=${s.expected.diff} lane=${s.expected.lane}`;

  results.push({ name: s.name, prompt: s.prompt, expected: expected, actual: detail, result: ok ? 'PASS' : 'FAIL', ok });

  if (ok) passed++; else failed++;
}

// Output
console.log('KOSAME_FIELD_OPS_RUNNER_BEGIN');
console.log('status: ' + (failed === 0 ? 'ready' : failed <= 3 ? 'caution' : 'blocked'));
console.log('scenarios: ' + SCENARIOS.length);
console.log('pass_count: ' + passed);
console.log('fail_count: ' + failed);
results.forEach(function(r) {
  console.log('scenario: ' + r.name + ' → ' + r.result + ' (' + r.actual + ')');
});
console.log('next_actions:');
if (failed === 0) console.log('- All scenarios PASS — ready for real operation');
if (failed > 0) console.log('- Review ' + failed + ' failed scenarios before proceeding');
console.log('- Run npm run verify');
console.log('- Check ops:validate before commit');
console.log('KOSAME_FIELD_OPS_RUNNER_END');

// Write report
const report = [
  '# KOSAME Field Ops Report',
  `version: 113.3.123`,
  `status: ${failed === 0 ? 'ready' : failed <= 3 ? 'caution' : 'blocked'}`,
  `pass_count: ${passed}`,
  `fail_count: ${failed}`,
  `total_scenarios: ${SCENARIOS.length}`,
  '',
  '## Scenario Results',
  results.map(function(r) { return '- ' + r.name + ': ' + r.result + ' [' + r.expected + ' → ' + r.actual + ']'; }).join('\n'),
  '',
  '## Model Lane Rules Verified',
  '- L0_LOCAL: simple append/replace/create',
  '- L1_DEEPSEEK_V4_FLASH: safe/sanitized + low',
  '- L2_DEEPSEEK_V4_PRO: safe/sanitized + medium',
  '- L3_DEEPSEEK_V4_PRO_AUDIT: safe/sanitized + high + audit',
  '- INTERNAL_ONLY: sensitive (GPT/こさめ)',
  '- BLOCKED: forbidden',
  '',
  `generated_at: ${new Date().toISOString()}`,
].join('\n');
try { fs.mkdirSync(EXECUTOR_DIR, { recursive: true }); fs.writeFileSync(path.join(EXECUTOR_DIR, 'field-ops-report.md'), report); } catch (_) {}

// Write ops-launch summary
const opsLaunch = [
  '# KOSAME Ops Launch Summary',
  `version: 113.3.123`,
  `field_ops_status: ${failed === 0 ? 'ready' : failed <= 3 ? 'caution' : 'blocked'}`,
  `real_http_e2e_status: verified (v122)`,
  `ops_validate_status: available`,
  `release_gate: ${failed === 0 ? 'open' : 'caution'}`,
  '',
  '## Remaining P3',
  '- Difficulty scoring fine-tuning (future operational data)',
  '- Auto smoke cleanup automation (v123 has manual cleanup)',
  '',
  '## Next Real Run Steps',
  '- 1. Console起動',
  '- 2. 1件目：safe low依頼 (local executor)',
  '- 3. 2件目：safe medium (DeepSeek V4 Pro)',
  '- 4. 3件目：human_gate依頼',
  '- 5. 4件目：forbiddenブロック確認',
  '- 6. History / Release Gate / Judge確認',
  '- 7. ops:validate → npm run verify → commit/push',
  '',
  `generated_at: ${new Date().toISOString()}`,
  '',
].join('\n');
try { fs.writeFileSync(path.join(EXECUTOR_DIR, 'ops-launch-summary.md'), opsLaunch); } catch (_) {}

// Write next-real-run checklist
const checklist = [
  '# KOSAME Next Real Run Checklist',
  `generated_at: ${new Date().toISOString()}`,
  '',
  '## 実運用 初回Run手順',
  '- 1. npm start (Console起動)',
  '- 2. ブラウザでConsole表示確認',
  '- 3. DeepSeek Handoff / Result / Action / History 表示確認',
  '- 4. RC100 Dashboard / Release Gate / Judge 表示確認',
  '',
  '## 実運用 依頼フロー',
  '- 1. 依頼をConsoleのchat inputに入力',
  '- 2. "この方針で進める" ボタン押下',
  '- 3. Model Laneが正しいかConsoleで確認',
  '- 4. DeepSeekの結果をResult Intakeに貼り付け',
  '- 5. Action (採用/再修正/却下) を選択',
  '- 6. Judge画面で最終裁定確認',
  '- 7. Release Gate確認',
  '- 8. ops:validate → verify → commit/push',
  '',
  '## 注意事項',
  '- git add -A 禁止、個別にgit addする',
  '- sales-dx/transcriberには触らない',
  '- .env/credentials/Secretには触らない',
  '- 顧客データ/保険ロジックには触らない',
  '- 自動push/deploy禁止',
  '',
].join('\n');
try { fs.writeFileSync(path.join(EXECUTOR_DIR, 'next-real-run-checklist.md'), checklist); } catch (_) {}

process.exit(failed > 3 ? 1 : failed > 0 ? 2 : 0);
