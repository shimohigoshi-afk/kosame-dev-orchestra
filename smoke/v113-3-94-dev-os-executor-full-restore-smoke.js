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
  '全体方針と危険ゲート',
  '担当AI・優先度・停止条件',
  '壊さず仕上げる担当',
  '広く速く確認',
  '突破口を探す担当',
  '低機密の土木作業',
  '抜け・過剰・危険操作',
  'GO/NO-GOだけ判断',
].forEach((text) => assert.ok(html.includes(text), 'missing agent copy: ' + text));

assert.ok(!html.includes('kosame-console-submit-bridge-v113-3-72'), 'broken v113.3.72 bridge remains');
assert.ok(!html.includes('kosame-safe-chat-bridge-v113-3-81'), 'broken v113.3.81 bridge remains');
assert.ok(!html.includes('/api/dev-os-local/client.js'), 'HTML injected client remains');
assert.ok(!html.includes('kosame-sound-ui-repair'), 'manual sound repair block remains');

// ── 通知音UI修復チェック (v113.3.94 notification sound UI fix) ────────────────
// 1. ONボタンクリックでAudioContextをunlock (音が鳴る前提条件)
assert.ok(
  html.includes('if (spec.enabled) await unlockNotificationAudio()'),
  'ON button must call unlockNotificationAudio() on click',
);
// 2. テストボタンはmodeRow（Soft/Clearの隣）に配置
assert.ok(
  html.includes('modeRow.appendChild(testBtn)'),
  'test button must be appended to modeRow (next to Soft/Clear)',
);
// 3. サマリーラベルは音色を表示
assert.ok(
  html.includes("summaryText.textContent = '音色:'"),
  "summary label must show '音色:' (tone label)",
);
// 4. updateNotificationUI は modeLabel（音色）をサマリーに反映
assert.ok(
  html.includes('summaryNode.textContent = modeLabel'),
  'updateNotificationUI must write modeLabel to summaryNode',
);
// 5. テストボタンはpowerRow（ON/OFF行）に混入していない
assert.ok(
  !html.includes('powerRow.appendChild(testBtn)'),
  'test button must NOT be in powerRow',
);
console.log('  PASS: 通知音UI — ON→unlock, テスト位置, サマリー音色表示, powerRow混入なし');

assert.ok(server.includes("113.3.94"), 'local server version not aligned');
assert.ok(router.includes("113.3.94"), 'router version not aligned');
assert.ok(runner.includes('smoke:v113-3-94') || runner.includes('smoke-v113-3-94'), 'runner smoke target not aligned');

console.log('\n✅ v113.3.94 Dev OS Executor Full Restore smoke PASSED');
