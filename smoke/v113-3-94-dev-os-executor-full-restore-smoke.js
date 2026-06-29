'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

const html = read('public/kosame-live-cockpit.html');
const server = read('tools/kosame-dev-os-local-cockpit-server.js');
const router = read('tools/kosame-dev-os-router.js');
const runner = read('tools/kosame-dev-os-auto-approval-judge-runner.js');

console.log('=== v113.3.94 Dev OS Executor Full Restore smoke ===');

const [_maj, _min, _patch] = pkg.version.split('.').map(Number);
assert.ok(
  _maj > 113 || (_maj === 113 && _min > 3) || (_maj === 113 && _min === 3 && _patch >= 94),
  `package version must be >= 113.3.94 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['dev-os:executor'], 'dev-os:executor must exist');
assert.ok(pkg.scripts['dev-os:runner'], 'dev-os:runner must exist');
assert.ok(pkg.scripts['dev-os:autopilot'], 'dev-os:autopilot must exist');
assert.ok(pkg.scripts['smoke:v113-3-94'], 'smoke:v113-3-94 must exist');

[
  'KOSAME CHAT',
  'AGENT STREAM LOG',
  'Enterで送信',
  'Shift+Enterで改行',
  'この方針で進める',
].forEach((text) => assert.ok(html.includes(text), 'missing UI marker: ' + text));

assert.ok(/ACTIVE TASK STRIP|Active Task|active-task|task-strip/i.test(html), 'active task strip missing');
assert.ok(/通知音|通知|notificationSoundEnabled|sound-state|sound-summary-mode|chat-sound-badge|audio|Audio|sound|Sound/i.test(html), 'notification sound UI marker missing');
assert.ok(/sound-state|sound-summary-mode|chat-sound-badge|notificationSoundEnabled/i.test(html), 'native sound state route missing');

[
  '全体の流れを見ています',
  '担当・優先度・停止条件',
  'テストを丁寧に照合',
  'あれー！',
  '突破口を探しています',
  '土木作業を完了',
  '危険操作0件',
  'GO/NO-GO',
].forEach((text) => assert.ok(html.includes(text), 'missing agent copy: ' + text));

assert.ok(!html.includes('kosame-console-submit-bridge-v113-3-72'), 'broken v113.3.72 bridge remains');
assert.ok(!html.includes('kosame-safe-chat-bridge-v113-3-81'), 'broken v113.3.81 bridge remains');
assert.ok(!html.includes('/api/dev-os-local/client.js'), 'HTML injected client remains');
assert.ok(!html.includes('kosame-sound-ui-repair'), 'manual sound repair block remains');

// ── 通知音UI基本チェック (詳細はv113.3.101 smoke参照) ─────────────────────────
// v113.3.101以降: OFF/Soft/Clear 3モード設計に移行
assert.ok(
  html.includes('setNotificationMode') && html.includes('unlockNotificationAudio'),
  'notification mode setter and audio unlock must exist',
);
assert.ok(
  html.includes("{ label: 'ERROR音', type: 'error' }") || html.includes("type: 'error'"),
  'ERROR sound type test must exist',
);
assert.ok(
  !html.includes('powerRow.appendChild(testBtn)'),
  'test button must NOT be in powerRow',
);
console.log('  PASS: 通知音UI基本チェック — setNotificationMode/unlock/ERROR存在, powerRow混入なし');

assert.ok(server.includes("113.3.94"), 'local server version not aligned');
assert.ok(router.includes("113.3.94"), 'router version not aligned');
assert.ok(runner.includes('smoke:v113-3-94') || runner.includes('smoke-v113-3-94'), 'runner smoke target not aligned');

console.log('\n✅ v113.3.94 Dev OS Executor Full Restore smoke PASSED');
