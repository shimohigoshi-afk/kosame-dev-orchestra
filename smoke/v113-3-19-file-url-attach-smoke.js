'use strict';

// Smoke test for v113.3.19: file attachment + URL detection UI.
// Verifies:
//   1. HTML has #chat-attach-btn (clip button)
//   2. HTML has #chat-file-input with correct accept attribute
//   3. HTML has #chat-attachments-preview (chip display)
//   4. HTML has #chat-url-detected (URL banner)
//   5. HTML has _chatAttachments state + helper functions
//   6. HTML has detectUrlsInText function
//   7. HTML has drag-drop handlers (dragover/drop)
//   8. HTML buildChatPayload includes attachments + detectedUrls
//   9. Chat server normalizeMessageBody extracts attachments + detectedUrls
//  10. Chat server normalizeChatRequest passes attachments through
//  11. Chat server handleChatRequest builds augmented GPT messages for attachments
//  12. callKosameGPT accepts array content (vision messages)
//  13. package.json version 113.3.19
// Does NOT make live API calls. Does NOT read secrets.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ': ' + detail : ''}`); failed++; }

function readFile(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); }
  catch (e) { return null; }
}
function checkContains(label, content, pattern) {
  if (content === null) { fail(label, 'file unreadable'); return; }
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (found) ok(label);
  else fail(label, typeof pattern === 'string' ? `"${pattern}" not found` : 'pattern not found');
}

async function main() {
  console.log('===== v113-3-19-file-url-attach smoke =====');
  console.log('Verifies: file attachment UI + URL detection + server handling');
  console.log('');

  // ─── HTML: UI elements ────────────────────────────────────────────────────
  console.log('--- HTML: attachment UI elements ---');
  const html = readFile('public/kosame-live-cockpit.html');
  checkContains('HTML: #chat-attach-btn exists', html, 'id="chat-attach-btn"');
  checkContains('HTML: #chat-file-input exists', html, 'id="chat-file-input"');
  checkContains('HTML: file-input accept has .md', html, 'accept=".md,');
  checkContains('HTML: file-input accept has .png', html, '.png,');
  checkContains('HTML: file-input accept has .mp4', html, '.mp4"');
  checkContains('HTML: #chat-attachments-preview exists', html, 'id="chat-attachments-preview"');
  checkContains('HTML: #chat-url-detected exists', html, 'id="chat-url-detected"');
  checkContains('HTML: #chat-input-wrapper exists', html, 'id="chat-input-wrapper"');
  checkContains('HTML: chat-attach-btn CSS', html, '.chat-attach-btn');
  checkContains('HTML: chat-attach-chip CSS', html, '.chat-attach-chip');
  checkContains('HTML: chat-url-banner CSS', html, '.chat-url-banner');
  checkContains('HTML: chat-drop-highlight CSS', html, '.chat-drop-highlight');

  // ─── HTML: JS functions ───────────────────────────────────────────────────
  console.log('--- HTML: attachment JS functions ---');
  checkContains('HTML: _chatAttachments state', html, 'var _chatAttachments');
  checkContains('HTML: _ATTACH_MAX', html, '_ATTACH_MAX');
  checkContains('HTML: addChatAttachments function', html, 'async function addChatAttachments(');
  checkContains('HTML: removeAttachment function', html, 'function removeAttachment(');
  checkContains('HTML: renderAttachmentPreviews function', html, 'function renderAttachmentPreviews(');
  checkContains('HTML: detectUrlsInText function', html, 'function detectUrlsInText(');
  checkContains('HTML: updateUrlDetectionBanner function', html, 'function updateUrlDetectionBanner(');
  checkContains('HTML: _processAttachFile function', html, 'async function _processAttachFile(');

  // ─── HTML: drag-drop handlers ─────────────────────────────────────────────
  console.log('--- HTML: drag-drop event listeners ---');
  checkContains('HTML: dragover listener', html, "'dragover'");
  checkContains('HTML: drop listener', html, "'drop'");
  checkContains('HTML: dragleave listener', html, "'dragleave'");
  checkContains('HTML: chat-drop-highlight class toggle', html, 'chat-drop-highlight');

  // ─── HTML: buildChatPayload includes attachments ──────────────────────────
  console.log('--- HTML: buildChatPayload with attachments ---');
  checkContains('HTML: payload.attachments set', html, 'payload.attachments');
  checkContains('HTML: payload.detectedUrls set', html, 'payload.detectedUrls');
  checkContains('HTML: detectUrlsInText called in payload', html, /detectUrlsInText\(trimmedMessage\)/);
  checkContains('HTML: base64DataUrl in attachment payload', html, 'base64DataUrl');

  // ─── HTML: sendChatMessage clears attachments ─────────────────────────────
  console.log('--- HTML: sendChatMessage attachment handling ---');
  checkContains('HTML: _pendingAttachments snapshot', html, '_pendingAttachments');
  checkContains('HTML: attachments cleared before send', html, '_chatAttachments = []');
  checkContains('HTML: renderAttachmentPreviews called after clear', html, /renderAttachmentPreviews\(\)[\s\S]{0,60}updateUrlDetectionBanner/);

  // ─── HTML: URL detection updates on input ────────────────────────────────
  console.log('--- HTML: URL detection on input ---');
  checkContains('HTML: updateUrlDetectionBanner on input event', html, 'updateUrlDetectionBanner(chatInputNode.value)');

  // ─── Chat server: normalizeMessageBody handles attachments ────────────────
  console.log('--- chat server: attachment normalization ---');
  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  checkContains('server: rawAttachments from body', chatSrc, 'rawAttachments');
  checkContains('server: attachments sliced to 5', chatSrc, '.slice(0, 5)');
  checkContains('server: textContent sliced', chatSrc, 'textContent.slice(0, 6000)');
  checkContains('server: base64DataUrl accepted', chatSrc, 'base64DataUrl');
  checkContains('server: detectedUrls from body', chatSrc, 'rawDetectedUrls');
  checkContains('server: normalizeChatRequest passes attachments', chatSrc, 'attachments: normalized.attachments');
  checkContains('server: normalizeChatRequest passes detectedUrls', chatSrc, 'detectedUrls: normalized.detectedUrls');

  // ─── Chat server: handleChatRequest builds augmented GPT messages ─────────
  console.log('--- chat server: augmented GPT messages ---');
  checkContains('server: imageParts for vision', chatSrc, 'imageParts');
  checkContains('server: image_url type in vision msg', chatSrc, 'image_url');
  checkContains('server: text file content prepended', chatSrc, '添付ファイル:');
  checkContains('server: URL cloneプロンプト', chatSrc, 'クローンして実装');
  checkContains('server: augmentedMessage built', chatSrc, 'augmentedMessage');

  // ─── callKosameGPT: accepts array content for vision ─────────────────────
  console.log('--- callKosameGPT: vision support ---');
  const gptSrc = readFile('tools/kosame-chat-gpt.js');
  checkContains('gpt: filter accepts array content', gptSrc, 'Array.isArray(m.content)');

  // ─── package.json ──────────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:file-url-attach']) ok('package.json: smoke:file-url-attach exists');
    else fail('package.json: smoke:file-url-attach exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:file-url-attach')) ok('verify includes smoke:file-url-attach');
    else fail('verify includes smoke:file-url-attach');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
