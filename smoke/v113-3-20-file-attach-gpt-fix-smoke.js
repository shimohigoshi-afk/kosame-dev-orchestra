'use strict';

// Smoke test for v113.3.20:
//   ① SVG clip icon (#00bcd4)
//   ② File-only send (no text required), GPT called for attachments
//   ③ URL actual content fetch via kosame-url-fetcher.js
//   ④ YouTube transcript detection
//   ⑤ Login-required page detection
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
  else fail(label, typeof pattern === 'string' ? `"${pattern}" still present` : 'pattern still present');
}

async function main() {
  console.log('===== v113-3-20-file-attach-gpt-fix smoke =====');
  console.log('Verifies: SVG icon + file-only send + URL fetch + YouTube + login detection');
  console.log('');

  // ─── ① SVG clip icon ──────────────────────────────────────────────────────
  console.log('--- ① SVG clip icon ---');
  const html = readFile('public/kosame-live-cockpit.html');
  checkContains('HTML: chat-attach-btn has SVG', html, '<svg');
  checkContains('HTML: SVG fill is #00bcd4', html, '#00bcd4');
  checkNotContains('HTML: 📎 emoji removed from button', html, '>📎<');
  checkContains('HTML: SVG inside chat-attach-btn', html, /id="chat-attach-btn"[^>]*>[\s]*<svg/);

  // ─── ② File-only send fix ────────────────────────────────────────────────
  console.log('--- ② File-only send & GPT fix ---');
  checkContains('HTML: submitPrioritizedChatInput allows file-only', html, '!rawText && !_chatAttachments.length');
  checkContains('HTML: sendChatMessage allows empty userText with files', html, '!userText && !confirmationContext && !_chatAttachments.length');
  checkContains('HTML: msgText synthesized for file-only', html, "添付ファイルを解析してください。");
  checkContains('HTML: buildChatPayload called with msgText', html, 'buildChatPayload(msgText,');

  // ─── ② Server: empty message + attachments ───────────────────────────────
  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  checkContains('server: hasAttachments synthesizes message', chatSrc, 'hasAttachments ? \'添付ファイルを解析してください。\'');
  checkNotContains('server: buildGeneralReply no project-specific text', chatSrc, '内容を受け取りました。短く整理して返しますね。');
  checkContains('server: buildGeneralReply returns generic fallback', chatSrc, 'AIが応答を生成しています');

  // ─── ③ URL actual fetch ──────────────────────────────────────────────────
  console.log('--- ③ URL actual content fetch ---');
  const urlFetcherSrc = readFile('tools/kosame-url-fetcher.js');
  if (!urlFetcherSrc) { fail('kosame-url-fetcher.js exists', 'file not found'); }
  else {
    ok('kosame-url-fetcher.js exists');
    checkContains('url-fetcher: analyzeUrl exported', urlFetcherSrc, 'analyzeUrl');
    checkContains('url-fetcher: htmlToText function', urlFetcherSrc, 'function htmlToText(');
    checkContains('url-fetcher: follows redirects', urlFetcherSrc, 'redirectCount');
    checkContains('url-fetcher: uses https module', urlFetcherSrc, "require('node:https')");
    checkContains('url-fetcher: uses http module', urlFetcherSrc, "require('node:http')");
    checkContains('url-fetcher: strips script tags', urlFetcherSrc, '<script');
    checkContains('url-fetcher: strips style tags', urlFetcherSrc, '<style');
    checkContains('url-fetcher: HTML entity decode', urlFetcherSrc, '&amp;');
  }

  // ─── ③ Server uses analyzeUrl ────────────────────────────────────────────
  checkContains('server: require kosame-url-fetcher', chatSrc, 'kosame-url-fetcher');
  checkContains('server: calls analyzeUrl', chatSrc, 'analyzeUrl(detectedUrls[0])');
  checkContains('server: loginRequired handled', chatSrc, 'loginRequired');
  checkContains('server: URL fetch stderr log', chatSrc, '[url-fetch]');
  checkNotContains('server: old URL placeholder removed', chatSrc, "URL検出: ${detectedUrls.join(', ')}");

  // ─── ④ YouTube transcript ────────────────────────────────────────────────
  console.log('--- ④ YouTube transcript ---');
  if (urlFetcherSrc) {
    checkContains('url-fetcher: isYouTubeUrl function', urlFetcherSrc, 'function isYouTubeUrl(');
    checkContains('url-fetcher: extractYouTubeVideoId', urlFetcherSrc, 'function extractYouTubeVideoId(');
    checkContains('url-fetcher: fetchYouTubeTranscript', urlFetcherSrc, 'async function fetchYouTubeTranscript(');
    checkContains('url-fetcher: youtube.com/watch detection', urlFetcherSrc, 'youtube.com');
    checkContains('url-fetcher: youtu.be detection', urlFetcherSrc, 'youtu\\.be');
    checkContains('url-fetcher: captionTracks extraction', urlFetcherSrc, 'captionTracks');
    checkContains('url-fetcher: Japanese caption preferred', urlFetcherSrc, "languageCode === 'ja'");
  }
  checkContains('server: YouTube transcript in prompt', chatSrc, 'YouTube動画:');
  checkContains('server: YouTube fallback when no transcript', chatSrc, '字幕を取得できませんでした');

  // ─── ⑤ Login-required detection ──────────────────────────────────────────
  console.log('--- ⑤ Login-required detection ---');
  if (urlFetcherSrc) {
    checkContains('url-fetcher: _looksLoginRequired function', urlFetcherSrc, '_looksLoginRequired');
    checkContains('url-fetcher: 401/403 status check', urlFetcherSrc, '=== 401');
    checkContains('url-fetcher: login keyword check', urlFetcherSrc, 'login');
    checkContains('url-fetcher: loginRequired in result', urlFetcherSrc, 'loginRequired: true');
  }
  checkContains('server: ログインが必要なページ message', chatSrc, 'ログインが必要なページは取得できません');

  // ─── Unit test: htmlToText ────────────────────────────────────────────────
  console.log('--- unit: htmlToText ---');
  try {
    const { htmlToText } = require(path.join(ROOT, 'tools/kosame-url-fetcher.js'));
    const result = htmlToText('<p>Hello &amp; <b>World</b><script>evil()</script></p>');
    if (result.includes('Hello') && result.includes('World') && !result.includes('evil()')) {
      ok('htmlToText: strips scripts and decodes entities');
    } else {
      fail('htmlToText: strips scripts and decodes entities', `got: "${result}"`);
    }
  } catch (e) { fail('htmlToText: module loads', e.message); }

  // ─── Unit test: isYouTubeUrl ──────────────────────────────────────────────
  try {
    const { isYouTubeUrl, extractYouTubeVideoId } = require(path.join(ROOT, 'tools/kosame-url-fetcher.js'));
    if (isYouTubeUrl('https://www.youtube.com/watch?v=abc123defgh')) ok('isYouTubeUrl: youtube.com/watch');
    else fail('isYouTubeUrl: youtube.com/watch');
    if (isYouTubeUrl('https://youtu.be/abc123defgh')) ok('isYouTubeUrl: youtu.be');
    else fail('isYouTubeUrl: youtu.be');
    if (!isYouTubeUrl('https://example.com')) ok('isYouTubeUrl: non-youtube returns false');
    else fail('isYouTubeUrl: non-youtube returns false');
    const vid = extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    if (vid === 'dQw4w9WgXcQ') ok('extractYouTubeVideoId: extracts correct ID');
    else fail('extractYouTubeVideoId: extracts correct ID', `got: ${vid}`);
  } catch (e) { fail('isYouTubeUrl unit test', e.message); }

  // ─── package.json ──────────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:file-attach-gpt-fix']) ok('package.json: smoke:file-attach-gpt-fix exists');
    else fail('package.json: smoke:file-attach-gpt-fix exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:file-attach-gpt-fix')) ok('verify includes smoke:file-attach-gpt-fix');
    else fail('verify includes smoke:file-attach-gpt-fix');
    if (String(pkg.version || '').includes('113.3.20')) ok('package.json version: 113.3.20');
    else fail('package.json version: 113.3.20', `got ${pkg.version}`);
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
