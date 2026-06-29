'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.97 queue cleanup smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 97),
  `package version must be >= 113.3.97 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-97'], 'smoke:v113-3-97 must exist in package.json');
assert.ok(
  pkg.scripts['verify:dev-os'] && pkg.scripts['verify:dev-os'].includes('smoke:v113-3-97'),
  'verify:dev-os must include smoke:v113-3-97',
);

console.log('  PASS: version >= 113.3.97');

// ── Bridge server: catch must skip not throw ──────────────────────────────────
const bridge = read('tools/kosame-codex-handoff-bridge-server.js');

assert.ok(
  bridge.includes('[readHandoffQueue] skip invalid entry'),
  'readHandoffQueue catch must log and skip (not throw)',
);
assert.ok(
  !bridge.includes("throw new Error('secret っぽい内容が含まれているため表示できません。')"),
  'readHandoffQueue must NOT throw on invalid entries',
);

console.log('  PASS: readHandoffQueue skips invalid entries instead of throwing');

// ── queue.jsonl: all remaining entries must pass sanitization ─────────────────
const { readHandoffQueue, sanitizeHandoffPayload } = require('../tools/kosame-codex-handoff-bridge-server');

const result = readHandoffQueue();
assert.ok(result.ok, 'readHandoffQueue must return ok:true');
assert.ok(result.count > 0, 'queue must have at least one valid entry');

const queuePath = path.join(ROOT, '.kosame-handoff', 'queue.jsonl');
if (fs.existsSync(queuePath)) {
  const raw = fs.readFileSync(queuePath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  let failCount = 0;
  for (const line of lines) {
    let record;
    try { record = JSON.parse(line); } catch { failCount++; continue; }
    try {
      sanitizeHandoffPayload(record);
    } catch (e) {
      failCount++;
      process.stderr.write(`  [WARN] still-invalid entry id=${record && record.id}: ${e.message}\n`);
    }
  }
  assert.strictEqual(failCount, 0, `queue.jsonl must have 0 invalid entries (found ${failCount})`);
  console.log(`  PASS: queue.jsonl all ${lines.length} entries valid`);
}

// ── Runner queue: processes a Hello World ticket with mock executor ───────────
const { processTicket } = require('../tools/kosame-runner-queue.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v113-3-97-smoke-'));
const testTicket = {
  id: `smoke-v113-3-97-${Date.now()}`,
  title: 'test.htmlにHello Worldを作って',
  prompt_text: 'test.htmlにHello Worldを作ってください',
  target_repo: ROOT,
  assigned_agent: 'claude_code',
  source: 'smoke-test',
  created_at: new Date().toISOString(),
};
const mockExecutor = (ticket, runDir) => {
  // Create test.html with Hello World as the "result"
  const testHtml = path.join(runDir, 'test.html');
  fs.writeFileSync(testHtml, '<html><body><h1>Hello World</h1></body></html>');
  fs.writeFileSync(path.join(runDir, 'output.md'), `# Mock executor\ntitle: ${ticket.title}\nresult: ok`);
  fs.writeFileSync(path.join(runDir, 'verify.log'), 'exit_code: 0');
  return { ok: true, exitCode: 0, error: null };
};

const ticketResult = processTicket(testTicket, {
  executor: mockExecutor,
  runsDir: tmpDir,
  state: {},
});

assert.strictEqual(ticketResult.status, 'completed', `ticket must complete (got: ${ticketResult.status})`);
assert.ok(fs.existsSync(path.join(tmpDir, testTicket.id, 'test.html')), 'mock executor must create test.html');

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('  PASS: runner queue processes "test.htmlにHello Worldを作って" ticket end-to-end');
console.log('\n✅ v113.3.97 queue cleanup smoke PASSED');
