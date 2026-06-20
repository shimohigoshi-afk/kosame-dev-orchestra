#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pkg = require('../package.json');
const { saveHandoffInbox, readLatestHandoffInbox } = require('../tools/kosame-codex-handoff-bridge-server');

console.log('=== v113.3.0 handoff queue stress smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:queue'], 'package wiring');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-handoff-queue-'));
const queuePath = path.join(temp, 'queue.jsonl');
const latestPath = path.join(temp, 'latest.md');
fs.writeFileSync(queuePath, '{"oops":}\n\n{"id":"a","title":"x","target_repo":"/home/lavie/kosame-dev-orchestra","assigned_agent":"Codex","prompt_text":"ok"}\n', 'utf8');
fs.writeFileSync(latestPath, '# latest\n', 'utf8');

const saved = saveHandoffInbox({
  id: 'stress-1',
  title: 'stress',
  target_repo: '/home/lavie/kosame-dev-orchestra',
  assigned_agent: 'Codex',
  prompt_text: 'zero-confirm',
  body: 'zero-confirm',
  source: 'kosame-console',
}, { handoffDir: temp });
assert.equal(saved.ok, true);

const latest = readLatestHandoffInbox({ handoffDir: temp });
assert.equal(latest.ok, true);
assert.ok(latest.latest);
assert.equal(latest.latest.id, 'stress-1');

fs.rmSync(temp, { recursive: true, force: true });
console.log('✅ v113.3.0 handoff queue stress smoke PASSED');
