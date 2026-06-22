'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ': ' + detail : ''}`); failed++; }

function readFile(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); }
  catch { return null; }
}

function checkContains(label, content, pattern) {
  if (content === null) { fail(label, 'file unreadable'); return; }
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (found) ok(label);
  else fail(label, typeof pattern === 'string' ? `"${pattern}" not found` : 'pattern not found');
}

function makeDataUrl(mimeType, text) {
  return `data:${mimeType};base64,${Buffer.from(text, 'utf8').toString('base64')}`;
}

async function main() {
  console.log('===== v113-3-28-multi-file-attachment smoke =====');
  console.log('Verifies: multi-file attachment UI + attachment manifest plumbing');
  console.log('');

  const html = readFile('public/kosame-live-cockpit.html');
  console.log('--- HTML: multi attachment UI ---');
  checkContains('HTML: file input has multiple', html, /id="chat-file-input"[^>]*multiple/);
  checkContains('HTML: file input allows webp', html, '.webp');
  checkContains('HTML: file input allows pdf', html, '.pdf');
  checkContains('HTML: attachment preview container', html, 'id="chat-attachments-preview"');
  checkContains('HTML: attachment chip CSS', html, '.chat-attach-chip');
  checkContains('HTML: individual remove button', html, '.chat-attach-remove');
  checkContains('HTML: drag-drop handler exists', html, "'drop'");
  checkContains('HTML: dragover handler exists', html, "'dragover'");
  checkContains('HTML: dragleave handler exists', html, "'dragleave'");
  checkContains('HTML: attachment render uses displayName', html, 'displayName || att.name');
  checkContains('HTML: buildChatPayload includes attachment metadata', html, 'displayName: att.name');
  checkContains('HTML: send snapshot includes attachment metadata', html, 'displayName: att.name');
  checkContains('HTML: attachments clear after send', html, '_chatAttachments = []');

  console.log('--- attachment store: manifest + summary ---');
  const store = require(path.join(ROOT, 'tools/kosame-attachment-store.js'));
  const { saveHandoffInbox } = require(path.join(ROOT, 'tools/kosame-codex-handoff-bridge-server.js'));
  checkContains('store: buildAttachmentManifest exported', fs.readFileSync(path.join(ROOT, 'tools/kosame-attachment-store.js'), 'utf8'), 'function buildAttachmentManifest(');
  checkContains('store: buildSafeHandoffAttachmentSummary exported', fs.readFileSync(path.join(ROOT, 'tools/kosame-attachment-store.js'), 'utf8'), 'function buildSafeHandoffAttachmentSummary(');
  checkContains('store: sanitizeAttachmentForHandoff exported', fs.readFileSync(path.join(ROOT, 'tools/kosame-attachment-store.js'), 'utf8'), 'function sanitizeAttachmentForHandoff(');
  checkContains('store: stripBase64Payloads exported', fs.readFileSync(path.join(ROOT, 'tools/kosame-attachment-store.js'), 'utf8'), 'function stripBase64Payloads(');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-attach-smoke-'));
  const workOrderId = 'wo-multi-attach';
  const attachments = [
    {
      attachmentId: 'att-image-1',
      originalName: 'diagram 1.png',
      name: 'diagram 1.png',
      displayName: 'diagram 1.png',
      mimeType: 'image/png',
      size: 128,
      kind: 'image',
      base64DataUrl: makeDataUrl('image/png', 'image-one'),
    },
    {
      attachmentId: 'att-image-2',
      originalName: 'diagram 1.png',
      name: 'diagram 1.png',
      displayName: 'diagram 1.png',
      mimeType: 'image/webp',
      size: 256,
      kind: 'image',
      base64DataUrl: makeDataUrl('image/webp', 'image-two'),
    },
    {
      attachmentId: 'att-text-1',
      originalName: 'notes.md',
      name: 'notes.md',
      displayName: 'notes.md',
      mimeType: 'text/markdown',
      size: 42,
      kind: 'text',
      textContent: '# notes\n- one\n- two',
    },
  ];
  const manifest = store.buildAttachmentManifest(workOrderId, attachments, {
    workOrderId,
    attachmentDir: path.join(tmpRoot, 'attachments'),
    createdAt: '2026-06-22T00:00:00.000Z',
  });
  assert.strictEqual(manifest.attachments.length, 3);
  assert.ok(fs.existsSync(manifest.manifestPath), 'manifest exists');
  assert.ok(fs.existsSync(path.join(manifest.attachmentDir, 'att-image-1.json')), 'payload 1 exists');
  assert.ok(fs.existsSync(path.join(manifest.attachmentDir, 'att-image-2.json')), 'payload 2 exists');
  assert.ok(fs.existsSync(path.join(manifest.attachmentDir, 'att-text-1.json')), 'payload 3 exists');
  const summary = store.buildSafeHandoffAttachmentSummary(manifest);
  assert.ok(summary.some((line) => /attachment_count: 3/.test(line)), 'summary includes count');
  assert.ok(summary.some((line) => /画像添付あり: 2件/.test(line)), 'summary includes image count');
  assert.ok(summary.some((line) => /displayName/.test(line) || /diagram/.test(line)), 'summary includes display name');
  ok('attachment store: manifest + summary generated for 3 files');

  const sanitized = store.sanitizeAttachmentForHandoff(attachments[0], { workOrderId });
  assert.strictEqual(sanitized.displayName, 'diagram 1.png');
  assert.strictEqual(sanitized.kind, 'image');
  ok('attachment store: sanitizeAttachmentForHandoff keeps image metadata');

  const safeText = store.lintHandoffTextOnly(`画像添付あり ${makeDataUrl('image/png', 'A'.repeat(140))}`, [{ attachmentId: 'att-image-1' }]);
  assert.ok(safeText.strippedBase64Count >= 1, 'base64 stripped');
  assert.ok(safeText.text.includes('[attachment:att-image-1]'), 'base64 replaced with attachment ref');
  ok('attachment store: lintHandoffTextOnly strips payload');

  console.log('--- Handoff plumbing: bridge + spec-to-tasks ---');
  const bridgeSrc = readFile('tools/kosame-codex-handoff-bridge-server.js');
  checkContains('bridge: saveHandoffInbox exists', bridgeSrc, 'function saveHandoffInbox(');
  checkContains('bridge: buildLatestMarkdown includes attachments', bridgeSrc, 'displayName: ${att.displayName || att.originalName}');
  checkContains('bridge: attachment manifest is written', bridgeSrc, 'buildAttachmentManifest(');
  checkContains('bridge: queue.jsonl path used', bridgeSrc, 'queue.jsonl');

  const specSrc = readFile('tools/kosame-spec-to-tasks.js');
  checkContains('spec: summarizeAttachments exists', specSrc, 'function summarizeAttachments(');
  checkContains('spec: attachment stream log for image', specSrc, '画像添付を受信しました');
  checkContains('spec: handoffDir passed through', specSrc, 'handoffDir');
  checkContains('spec: saveTasksToHandoff passes attachments', specSrc, 'saveTasksToHandoff(tasks, {');
  checkContains('spec: saveTasksToHandoff passes attachments', specSrc, 'attachments,');
  checkContains('spec: saveTasksToHandoff passes attachments', specSrc, 'handoffDir,');

  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  checkContains('chat: attachments normalized with displayName', chatSrc, 'displayName: String(a.displayName || a.name ||');

  const result = saveHandoffInbox({
    id: 'wo-multi-attach',
    title: '複数添付確認',
    target_repo: '/home/lavie/kosame-dev-orchestra',
    assigned_agent: 'Codex',
    agent: 'Codex',
    risk_level: 'low',
    human_gate_required: false,
    prompt_text: '複数ファイルの添付を保存します。',
    body: '複数ファイルの添付を保存します。',
    originalRequest: '複数ファイルの添付を保存します。',
    safetyConditions: ['安全条件は維持'],
    reportItems: ['report 1', 'report 2'],
    attachments,
    target: {
      id: 'dev-orchestra',
      label: 'KOSAME Dev Orchestra',
      path: '/home/lavie/kosame-dev-orchestra',
    },
  }, { handoffDir: tmpRoot });

  assert.ok(result.ok, 'saveHandoffInbox should succeed');
  assert.ok(fs.existsSync(result.latestPath), 'latest.md exists');
  assert.ok(fs.existsSync(result.queuePath), 'queue.jsonl exists');
  const latest = fs.readFileSync(result.latestPath, 'utf8');
  const queue = fs.readFileSync(result.queuePath, 'utf8');
  assert.ok(/attachment_count: 3/.test(latest), 'latest.md includes attachment count');
  assert.ok(/attachmentId: att-image-1/.test(latest), 'latest.md includes attachment refs');
  assert.ok(!/data:image\/png;base64/i.test(latest), 'latest.md does not include raw data URL');
  assert.ok(!/A{10,}|B{10,}|C{10,}/.test(latest), 'latest.md does not include raw base64 blobs');
  assert.ok(/attachment_manifest_path/.test(queue), 'queue record includes manifest path');
  ok('handoff bridge: multi-file attachments saved and summarized safely');

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
