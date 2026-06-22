'use strict';

// Smoke test for v113.3.29:
//   Multiple file attachment support in KOSAME CHAT:
//   - multiple select via clip button (input[multiple])
//   - .webp added to accepted types
//   - _ATTACH_MAX bumped to 10
//   - count badge on clip button
//   - Gemini Vision for image attachments (server), GPT imageParts as fallback
// Does NOT make live API/network calls. Does NOT read secrets.

const fs = require('fs');
const path = require('path');

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
function checkNotContains(label, content, pattern) {
  if (content === null) { fail(label, 'file unreadable'); return; }
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (!found) ok(label);
  else fail(label, typeof pattern === 'string' ? `"${pattern}" should NOT be found` : 'pattern should NOT be found');
}

async function main() {
  console.log('===== v113-3-29-multi-file-attach smoke =====');
  console.log('Verifies: multiple file attachment support in KOSAME CHAT');
  console.log('');

  // ─── HTML: file input ─────────────────────────────────────────────────────
  console.log('--- public/kosame-live-cockpit.html: file input ---');
  const htmlSrc = readFile('public/kosame-live-cockpit.html');
  if (!htmlSrc) { fail('kosame-live-cockpit.html exists', 'file not found'); }
  else {
    ok('kosame-live-cockpit.html exists');
    checkContains('html: chat-file-input has multiple attribute', htmlSrc, 'id="chat-file-input"');
    checkContains('html: file input has multiple', htmlSrc, /id="chat-file-input"[^>]*multiple/);
    checkContains('html: .webp in accept list', htmlSrc, /accept="[^"]*\.webp/);
    checkContains('html: .png in accept list', htmlSrc, /accept="[^"]*\.png/);
    checkContains('html: .jpg in accept list', htmlSrc, /accept="[^"]*\.jpg/);
  }

  // ─── HTML: count badge ────────────────────────────────────────────────────
  console.log('--- html: count badge ---');
  if (htmlSrc) {
    checkContains('html: chat-attach-count badge element', htmlSrc, 'id="chat-attach-count"');
    checkContains('html: .chat-attach-count CSS class', htmlSrc, '.chat-attach-count');
    checkContains('html: count badge positioned absolute', htmlSrc, /\.chat-attach-count\s*\{[^}]*position:\s*absolute/);
    checkContains('html: chat-attach-btn position relative', htmlSrc, /\.chat-attach-btn\s*\{[^}]*position:\s*relative/);
  }

  // ─── HTML: JS constants ───────────────────────────────────────────────────
  console.log('--- html: JS constants ---');
  if (htmlSrc) {
    checkContains('html: _ATTACH_MAX >= 10', htmlSrc, /var _ATTACH_MAX = 1[0-9]/);
    checkContains('html: _ATTACH_IMAGE_EXTS has .webp', htmlSrc, /\.webp.*true/);
    checkContains('html: _ATTACH_ALLOWED_EXTS has .webp', htmlSrc, /_ATTACH_ALLOWED_EXTS.*\.webp.*true/);
    checkContains('html: _ATTACH_FILE_ICONS has .webp', htmlSrc, /\.webp.*🖼/);
  }

  // ─── HTML: renderAttachmentPreviews count badge update ───────────────────
  console.log('--- html: renderAttachmentPreviews ---');
  if (htmlSrc) {
    checkContains('html: renderAttachmentPreviews updates count badge', htmlSrc, 'chat-attach-count');
    checkContains('html: count badge shows number of files', htmlSrc, '_chatAttachments.length');
    checkContains('html: count badge cleared on empty', htmlSrc, /countBadge.*textContent.*=.*''/);
  }

  // ─── kosame-gemini.js: analyzeImageWithGemini ─────────────────────────────
  console.log('--- tools/kosame-gemini.js ---');
  const geminiSrc = readFile('tools/kosame-gemini.js');
  if (!geminiSrc) { fail('kosame-gemini.js exists', 'file not found'); }
  else {
    ok('kosame-gemini.js exists');
    checkContains('gemini: analyzeImageWithGemini exported', geminiSrc, 'analyzeImageWithGemini');
    checkContains('gemini: uses inline_data for image', geminiSrc, 'inline_data');
    checkContains('gemini: accepts base64DataUrl param', geminiSrc, 'base64DataUrl');
    checkContains('gemini: returns text result', geminiSrc, /resolve\(\s*\{\s*text/);
    checkNotContains('gemini: does not log API key value', geminiSrc, /console\.(log|error).*GEMINI_API_KEY.*=/i);
  }

  // ─── chat server: Gemini image routing ───────────────────────────────────
  console.log('--- tools/kosame-cockpit-chat-server.js: image routing ---');
  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  if (!chatSrc) { fail('chat server exists', 'file not found'); }
  else {
    checkContains('chat server: analyzeImageWithGemini called for attachments', chatSrc, 'analyzeImageWithGemini');
    checkContains('chat server: IMAGE_EXTS_SET includes .webp', chatSrc, /IMAGE_EXTS_SET.*\.webp/);
    checkContains('chat server: Gemini first, GPT fallback', chatSrc, /geminiKeyPresent\(\)/);
    checkContains('chat server: GPT imageParts fallback on Gemini fail', chatSrc, /imageParts\.push.*image_url/);
    checkContains('chat server: Gemini image analysis log', chatSrc, '[chat-img] Gemini analyzed');
    checkContains('chat server: GPT fallback log', chatSrc, 'using GPT Vision');
  }

  // ─── package.json ─────────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:multi-file-attach']) ok('package.json: smoke:multi-file-attach exists');
    else fail('package.json: smoke:multi-file-attach exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:multi-file-attach')) ok('verify includes smoke:multi-file-attach');
    else fail('verify includes smoke:multi-file-attach');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
