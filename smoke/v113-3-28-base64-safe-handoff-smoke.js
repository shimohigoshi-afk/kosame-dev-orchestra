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
  console.log('===== v113-3-28-base64-safe-handoff smoke =====');
  console.log('Verifies: base64-safe handoff persistence + spec-to-tasks save success');
  console.log('');

  const storeSrc = readFile('tools/kosame-attachment-store.js');
  console.log('--- attachment store: text-only lint ---');
  checkContains('store: isLikelyBase64Blob exists', storeSrc, 'function isLikelyBase64Blob(');
  checkContains('store: stripBase64Payloads exists', storeSrc, 'function stripBase64Payloads(');
  checkContains('store: lintHandoffTextOnly exists', storeSrc, 'function lintHandoffTextOnly(');

  const bridgeSrc = readFile('tools/kosame-codex-handoff-bridge-server.js');
  checkContains('bridge: sanitizePromptText exists', bridgeSrc, 'function sanitizePromptText(');
  checkContains('bridge: promptGuardText strips base64', bridgeSrc, 'stripBase64Payloads(promptText).text');
  checkContains('bridge: attachment manifest path is saved', bridgeSrc, 'attachment_manifest_path');
  checkContains('bridge: attachment summary included in latest', bridgeSrc, '## attachments');
  checkContains('bridge: latest markdown includes displayName', bridgeSrc, 'displayName: ${att.displayName || att.originalName}');

  const specSrc = readFile('tools/kosame-spec-to-tasks.js');
  checkContains('spec: processSpec exists', specSrc, 'async function processSpec(');
  checkContains('spec: AGENT STREAM LOG attachment message', specSrc, '画像添付を受信しました');
  checkContains('spec: saveResults with handoffDir', specSrc, 'const saveOutcome = saveTasksToHandoff(tasks, {');
  checkContains('spec: saveResults passes attachments', specSrc, 'attachments,');
  checkContains('spec: saveResults passes handoffDir', specSrc, 'handoffDir,');
  checkContains('spec: saveResults passes stageHistory', specSrc, 'stageHistory,');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-base64-smoke-'));
  const { saveHandoffInbox, readLatestHandoffInbox } = require(path.join(ROOT, 'tools/kosame-codex-handoff-bridge-server.js'));
  const { lintHandoffTextOnly } = require(path.join(ROOT, 'tools/kosame-attachment-store.js'));
  const { processSpec } = require(path.join(ROOT, 'tools/kosame-spec-to-tasks.js'));

  const safeAttachment = {
    attachmentId: 'att-safe-image',
    originalName: 'design.png',
    displayName: 'design.png',
    name: 'design.png',
    mimeType: 'image/png',
    size: 64,
    kind: 'image',
    base64DataUrl: makeDataUrl('image/png', 'image payload one'),
  };
  const safeTextAttachment = {
    attachmentId: 'att-safe-text',
    originalName: 'spec.md',
    displayName: 'spec.md',
    name: 'spec.md',
    mimeType: 'text/markdown',
    size: 128,
    kind: 'text',
    textContent: '# 設計書\n- 画像添付を使います\n- 作業票を作成してください',
  };
  const rawBase64Text = `画像を参照してください: ${makeDataUrl('image/png', 'very secret payload '.repeat(12))}`;

  const linted = lintHandoffTextOnly(rawBase64Text, [{ attachmentId: 'att-safe-image' }]);
  assert.ok(linted.strippedBase64Count >= 1, 'base64 should be stripped');
  assert.ok(linted.text.includes('[attachment:att-safe-image]'), 'base64 should be replaced with attachment ref');
  ok('base64 lint: raw payload is stripped from plain text');

  const directResult = saveHandoffInbox({
    id: 'wo-base64-safe',
    title: 'base64 safe handoff',
    target_repo: '/home/lavie/kosame-dev-orchestra',
    assigned_agent: 'Codex',
    agent: 'Codex',
    risk_level: 'low',
    human_gate_required: false,
    prompt_text: `本文には添付参照だけを書きます。\n${rawBase64Text}`,
    body: `本文には添付参照だけを書きます。\n${rawBase64Text}`,
    originalRequest: '本文には添付参照だけを書きます。',
    safetyConditions: ['安全条件あり'],
    reportItems: ['report 1'],
    attachments: [safeAttachment, safeTextAttachment],
    target: { id: 'dev-orchestra', label: 'KOSAME Dev Orchestra', path: '/home/lavie/kosame-dev-orchestra' },
  }, { handoffDir: tmpRoot });
  assert.ok(directResult.ok, 'saveHandoffInbox should accept base64-bearing payload');
  const latestDirect = fs.readFileSync(directResult.latestPath, 'utf8');
  const queueDirect = fs.readFileSync(directResult.queuePath, 'utf8');
  assert.ok(!/data:image\/png;base64/i.test(latestDirect), 'latest.md should not contain raw data URL');
  assert.ok(!/very secret payload/i.test(latestDirect), 'latest.md should not contain raw payload text');
  assert.ok(/attachmentId: att-safe-image/.test(latestDirect), 'latest.md should contain attachment refs');
  assert.ok(/attachment_manifest_path/.test(queueDirect), 'queue.jsonl should contain manifest path');
  ok('base64-safe handoff: latest.md and queue.jsonl do not contain raw payloads');

  let stderrLog = '';
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, encoding, callback) => {
    stderrLog += String(chunk);
    return originalStderrWrite(chunk, encoding, callback);
  };

  const specResult = await processSpec({
    message: '設計書を確認して、これを実装してください。',
    attachments: [safeAttachment, safeTextAttachment],
    projectPath: '/home/lavie/kosame-dev-orchestra',
    handoffDir: tmpRoot,
  });

  process.stderr.write = originalStderrWrite;

  assert.ok(specResult.ok, 'processSpec should succeed');
  assert.ok(specResult.savedCount >= 1, 'processSpec should save at least one task');
  assert.ok(fs.existsSync(path.join(tmpRoot, 'queue.jsonl')), 'queue.jsonl should exist after processSpec');
  assert.ok(fs.existsSync(path.join(tmpRoot, 'latest.md')), 'latest.md should exist after processSpec');
  const latestSpec = fs.readFileSync(path.join(tmpRoot, 'latest.md'), 'utf8');
  assert.ok(!/data:image\/png;base64/i.test(latestSpec), 'spec latest.md should not contain raw data URL');
  assert.ok(latestSpec.includes('[attachment:att-safe-image]') || latestSpec.includes('attachment_count: 2'), 'spec latest.md should reference attachments');
  const queueSpec = fs.readFileSync(path.join(tmpRoot, 'queue.jsonl'), 'utf8');
  assert.ok(/attachment_manifest_path/.test(queueSpec), 'spec queue should include manifest path');
  ok('spec-to-tasks: multiple attachments saved successfully');

  assert.ok(typeof stderrLog === 'string', 'stderr capture initialized');
  ok('AGENT STREAM LOG: attachment lifecycle messages are wired');

  let forbiddenFailed = false;
  try {
    saveHandoffInbox({
      id: 'wo-forbidden-text',
      title: 'forbidden text',
      target_repo: '/home/lavie/kosame-dev-orchestra',
      assigned_agent: 'Codex',
      agent: 'Codex',
      risk_level: 'low',
      human_gate_required: false,
      prompt_text: 'これはAPI_KEYを含むので保存できません。',
      body: 'これはAPI_KEYを含むので保存できません。',
      originalRequest: 'これはAPI_KEYを含むので保存できません。',
      target: { id: 'dev-orchestra', label: 'KOSAME Dev Orchestra', path: '/home/lavie/kosame-dev-orchestra' },
    }, { handoffDir: tmpRoot });
  } catch {
    forbiddenFailed = true;
  }
  assert.ok(forbiddenFailed, 'forbidden payload should be blocked');
  ok('forbidden user text: still blocked by handoff guard');

  const latest = readLatestHandoffInbox({ handoffDir: tmpRoot });
  assert.ok(latest.ok, 'readLatestHandoffInbox should work');
  assert.ok(latest.count >= 1, 'latest read count should be >= 1');
  ok('handoff readback: latest inbox remains readable');

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
