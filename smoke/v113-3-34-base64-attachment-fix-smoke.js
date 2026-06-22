#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildAttachmentManifest,
  lintHandoffTextOnly,
  stripBase64Payloads,
} = require('../tools/kosame-attachment-store');
const {
  saveHandoffInbox,
  readLatestHandoffInbox,
} = require('../tools/kosame-codex-handoff-bridge-server');

function makeDataUrl(mimeType, label) {
  const payload = Buffer.from(String(label).repeat(80), 'utf8').toString('base64');
  return `data:${mimeType};base64,${payload}`;
}

console.log('===== v113.3.34 base64 attachment fix smoke =====');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v113-3-34-base64-'));
const handoffDir = path.join(tmpRoot, 'handoff');
const base64 = makeDataUrl('image/png', 'base64-safe');
const attachments = [
  {
    attachmentId: 'att-341',
    originalName: 'screen-1.png',
    displayName: 'screen-1.png',
    name: 'screen-1.png',
    mimeType: 'image/png',
    size: 101,
    kind: 'image',
    ext: '.png',
    base64DataUrl: makeDataUrl('image/png', 'one'),
  },
  {
    attachmentId: 'att-342',
    originalName: 'screen-2.png',
    displayName: 'screen-2.png',
    name: 'screen-2.png',
    mimeType: 'image/png',
    size: 102,
    kind: 'image',
    ext: '.png',
    base64DataUrl: makeDataUrl('image/png', 'two'),
  },
  {
    attachmentId: 'att-343',
    originalName: 'screen-3.png',
    displayName: 'screen-3.png',
    name: 'screen-3.png',
    mimeType: 'image/png',
    size: 103,
    kind: 'image',
    ext: '.png',
    base64DataUrl: makeDataUrl('image/png', 'three'),
  },
  {
    attachmentId: 'att-344',
    originalName: 'screen-4.png',
    displayName: 'screen-4.png',
    name: 'screen-4.png',
    mimeType: 'image/png',
    size: 104,
    kind: 'image',
    ext: '.png',
    base64DataUrl: makeDataUrl('image/png', 'four'),
  },
];

const payload = {
  id: 'wo-v113-3-34-base64',
  title: 'Base64 safe attachment handoff',
  target_repo: '/home/lavie/kosame-dev-orchestra',
  assigned_agent: 'Codex',
  risk_level: 'low',
  human_gate_required: false,
  prompt_text: `このコンソールのページって作れる？機能も考慮して\n${base64}`,
  body: `このコンソールのページって作れる？機能も考慮して\n${base64}`,
  originalRequest: `このコンソールのページって作れる？機能も考慮して\n${base64}`,
  safetyConditions: ['Secret/.env/credentials/API keyを読まない', 'yes要求を出さない'],
  reportItems: ['attachment manifest を保存する', 'base64本文は保存しない'],
  attachments,
  selectedProjectId: 'dev-orchestra',
  selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
  selectedProjectLabel: 'KOSAME Dev Orchestra',
};

const saved = saveHandoffInbox(payload, { handoffDir });
assert.ok(saved.ok, 'handoff save should succeed');
assert.ok(saved.attachmentManifestPath, 'attachment manifest path should be returned');

const latestResult = readLatestHandoffInbox({ handoffDir });
assert.ok(latestResult.latest, 'latest handoff should exist');
assert.equal(latestResult.count, 1, 'queue count should be 1');

const latestMd = fs.readFileSync(path.join(handoffDir, 'latest.md'), 'utf8');
const queueJsonl = fs.readFileSync(path.join(handoffDir, 'queue.jsonl'), 'utf8');
assert.ok(!/data:image\/png;base64/i.test(latestMd), 'latest.md should not contain raw base64');
assert.ok(!/data:image\/png;base64/i.test(queueJsonl), 'queue.jsonl should not contain raw base64');
assert.ok(latestMd.includes('attachment_manifest_path'), 'latest.md should include attachment manifest path');
assert.ok(queueJsonl.includes('attachment_manifest_path'), 'queue.jsonl should include attachment manifest path');
assert.ok(queueJsonl.includes('attachment_ids'), 'queue.jsonl should include attachment ids');
assert.ok(!queueJsonl.includes(base64), 'queue.jsonl should not contain the pasted base64 data url');
assert.ok(!latestMd.includes(base64), 'latest.md should not contain the pasted base64 data url');

const manifestDir = path.join(handoffDir, 'attachments');
const manifestFiles = [];
for (const entry of fs.readdirSync(manifestDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifestPath = path.join(manifestDir, entry.name, 'manifest.json');
  if (fs.existsSync(manifestPath)) manifestFiles.push(manifestPath);
}
assert.equal(manifestFiles.length, 1, 'one attachment manifest should be created');
const manifest = JSON.parse(fs.readFileSync(manifestFiles[0], 'utf8'));
assert.equal(manifest.attachments.length, 4, 'manifest should keep all 4 attachments');
assert.ok(manifest.attachments.every((att) => fs.existsSync(att.storedPath)), 'storedPath should exist for every attachment');
assert.ok(manifest.attachments.every((att) => typeof att.sha256 === 'string' && att.sha256.length === 64), 'manifest should keep sha256');

const stripped = stripBase64Payloads(`before ${base64} after`);
assert.ok(!stripped.text.includes('data:image/png;base64'), 'stripBase64Payloads should remove data URLs');
assert.ok(stripped.strippedCount >= 1, 'stripBase64Payloads should count removals');

const linted = lintHandoffTextOnly(`attach ${base64} please`, attachments);
assert.ok(!linted.text.includes('data:image/png;base64'), 'lintHandoffTextOnly should strip data URLs');
assert.ok(linted.strippedBase64Count >= 1, 'lintHandoffTextOnly should report stripping');

assert.throws(
  () => saveHandoffInbox({
    id: 'wo-v113-3-34-forbidden',
    title: 'forbidden check',
    target_repo: '/home/lavie/kosame-dev-orchestra',
    assigned_agent: 'Codex',
    risk_level: 'low',
    prompt_text: 'Secret .env should still be blocked',
    body: 'Secret .env should still be blocked',
    originalRequest: 'Secret .env should still be blocked',
    attachments: [],
  }, { handoffDir }),
  /secret っぽい内容|保存できません|prompt_text が必要です/,
  'user text forbidden should still be blocked',
);

const manifestSummary = buildAttachmentManifest('wo-v113-3-34-summary', attachments, { attachmentDir: path.join(tmpRoot, 'summary') });
assert.ok(fs.existsSync(manifestSummary.manifestPath), 'manifest helper should save manifest');
assert.equal(manifestSummary.attachments.length, 4, 'manifest helper should preserve all attachments');

console.log('  PASS: base64 payloads are separated from handoff text');
console.log('  PASS: forbidden user text is still blocked');
