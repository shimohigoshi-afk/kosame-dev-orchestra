'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.104 Project Strip タブ切替実装 smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 104),
  `package version must be >= 113.3.104 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-104'], 'smoke:v113-3-104 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-104'), 'verify:dev-os must include smoke:v113-3-104');
console.log('  PASS: version >= 113.3.104');

const html = read('public/kosame-live-cockpit.html');

// ── ① project-focus-collapse はデフォルト open ────────────────────────────────
assert.ok(
  html.includes('id="project-focus-collapse" open'),
  'project-focus-collapse must have open attribute by default',
);
console.log('  PASS: project-focus-collapse デフォルトopen');

// ── ② タブクリック時に focus panel を open + scroll ─────────────────────────────
// click handler must open project-focus-collapse
assert.ok(
  html.includes("getElementById('project-focus-collapse')") && html.includes("_fc.open = true"),
  'tab click handler must open project-focus-collapse (_fc.open = true)',
);
// click handler must scroll to dev-orchestra-focus-section
assert.ok(
  html.includes("getElementById('dev-orchestra-focus-section')") && html.includes("_focusSec.scrollIntoView"),
  'tab click handler must scrollIntoView dev-orchestra-focus-section',
);
console.log('  PASS: タブクリック — focus-collapse open + focusSec scroll');

// ── ③ Focus Panel に RUNNING TASK と WARNINGS を追加 ─────────────────────────────
assert.ok(
  html.includes("'RUNNING TASK'"),
  'focus panel must include RUNNING TASK section',
);
assert.ok(
  html.includes("'WARNINGS'"),
  'focus panel must include WARNINGS section',
);
// RUNNING TASK must use runningCount and eventSummary
assert.ok(
  html.includes('selectedProject.runningCount > 0') && html.includes('selectedProject.eventSummary'),
  'RUNNING TASK must check runningCount and show eventSummary',
);
// WARNINGS must use selectedProject.warnings array
assert.ok(
  html.includes('selectedProject.warnings'),
  'WARNINGS must use selectedProject.warnings',
);
console.log('  PASS: Focus Panel — RUNNING TASK + WARNINGS セクション追加');

// ── ④ project-strip-item click handler が renderProjectRegistry を呼ぶ ──────────
assert.ok(
  html.includes('selectedProjectId = project.id || selectedProjectId') &&
  html.includes('renderProjectRegistry(latestSnapshot || snapshot)'),
  'tab click must update selectedProjectId and call renderProjectRegistry',
);
console.log('  PASS: タブクリック — selectedProjectId更新 + renderProjectRegistry呼び出し');

console.log('\n✅ v113.3.104 Project Strip タブ切替実装 smoke PASSED');
