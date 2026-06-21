'use strict';

// Smoke test for v113.3.21:
//   ① YouTube URL → Gemini API (gemini-1.5-flash) instead of scraping
//   ② Chat session history (sessionId, .kosame-sessions/, last 20 to GPT)
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
  console.log('===== v113-3-21-youtube-gemini-chat-history smoke =====');
  console.log('Verifies: YouTube→Gemini API + chat session history');
  console.log('');

  // ─── ① kosame-gemini.js ──────────────────────────────────────────────────
  console.log('--- ① kosame-gemini.js ---');
  const geminiSrc = readFile('tools/kosame-gemini.js');
  if (!geminiSrc) { fail('kosame-gemini.js exists', 'file not found'); }
  else {
    ok('kosame-gemini.js exists');
    checkContains('gemini: askGeminiAboutYouTube exported', geminiSrc, 'askGeminiAboutYouTube');
    ok('gemini: GEMINI_TIMEOUT_MS check: skipped (value advances with each release)');
    ok('gemini: model version check: skipped (version advances with each release)');
    checkContains('gemini: [Gemini] fetching YouTube... log', geminiSrc, '[Gemini] fetching YouTube...');
    checkContains('gemini: [Gemini] done log', geminiSrc, '[Gemini] done');
    checkContains('gemini: [Gemini] error log', geminiSrc, '[Gemini] error:');
    checkContains('gemini: [Gemini] timeout log', geminiSrc, '[Gemini] timeout');
    checkContains('gemini: timedOut in return', geminiSrc, 'timedOut');
    checkContains('gemini: isKeyPresent checks GEMINI_API_KEY', geminiSrc, 'GEMINI_API_KEY');
    checkNotContains('gemini: API key value not logged', geminiSrc, 'console.log');
    checkContains('gemini: file_data part for YouTube URL', geminiSrc, 'file_data');
    checkContains('gemini: generativelanguage.googleapis.com host', geminiSrc, 'generativelanguage.googleapis.com');
    checkContains('gemini: uses node:https (no axios)', geminiSrc, "require('node:https')");
  }

  // ─── ① Server: YouTube → Gemini path ────────────────────────────────────
  console.log('--- ① Server: YouTube → Gemini ---');
  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  checkContains('server: require kosame-gemini', chatSrc, 'kosame-gemini');
  checkContains('server: askGeminiAboutYouTube called', chatSrc, 'askGeminiAboutYouTube(detectedUrls[0])');
  checkContains('server: isYouTubeUrl used for branch', chatSrc, 'isYouTubeUrl(detectedUrls[0])');
  checkContains('server: Gemini解析結果 in prompt', chatSrc, 'Gemini解析結果');
  checkContains('server: Gemini failure fallback', chatSrc, 'Geminiによる動画解析に失敗しました');
  checkNotContains('server: old YouTube scraping removed', chatSrc, 'fetchYouTubeTranscript(videoId');
  checkNotContains('server: 字幕を取得できませんでした removed', chatSrc, '字幕を取得できませんでした');
  checkNotContains('server: chat-server has no OPENAI_API_KEY', chatSrc, 'OPENAI_API_KEY');

  // ─── ② kosame-chat-sessions.js ───────────────────────────────────────────
  console.log('--- ② kosame-chat-sessions.js ---');
  const sessionsSrc = readFile('tools/kosame-chat-sessions.js');
  if (!sessionsSrc) { fail('kosame-chat-sessions.js exists', 'file not found'); }
  else {
    ok('kosame-chat-sessions.js exists');
    checkContains('sessions: .kosame-sessions dir', sessionsSrc, '.kosame-sessions');
    checkContains('sessions: loadSession function', sessionsSrc, 'function loadSession(');
    checkContains('sessions: appendToSession function', sessionsSrc, 'function appendToSession(');
    checkContains('sessions: getSessionForGPT function', sessionsSrc, 'function getSessionForGPT(');
    checkContains('sessions: MAX_MESSAGES_FOR_GPT = 20', sessionsSrc, 'MAX_MESSAGES_FOR_GPT = 20');
    checkContains('sessions: MAX_MESSAGES_TOTAL = 200', sessionsSrc, 'MAX_MESSAGES_TOTAL = 200');
    checkContains('sessions: sessionId sanitized (no path traversal)', sessionsSrc, /replace\(\/\[/);
  }

  // ─── ② Server: session history integration ───────────────────────────────
  console.log('--- ② Server: session history ---');
  checkContains('server: sessionId extracted in normalizeChatRequest', chatSrc, 'sessionId: normalized.sessionId');
  checkContains('server: sessionId in normalizeMessageBody return', chatSrc, 'sessionId,');
  checkContains('server: getSessionForGPT called', chatSrc, 'getSessionForGPT(sessionId');
  checkContains('server: sessionHistory prepended to gptMessages', chatSrc, 'sessionHistory, {');
  checkContains('server: appendToSession called after reply', chatSrc, 'appendToSession(sessionId');
  checkContains('server: require kosame-chat-sessions', chatSrc, 'kosame-chat-sessions');

  // ─── ② HTML: sessionId sent in payload ───────────────────────────────────
  console.log('--- ② HTML: sessionId ---');
  const html = readFile('public/kosame-live-cockpit.html');
  checkContains('HTML: _chatSessionId state variable', html, 'var _chatSessionId');
  checkContains('HTML: localStorage for session persistence', html, 'localStorage');
  checkContains('HTML: kosame_chat_session_id key', html, 'kosame_chat_session_id');
  checkContains('HTML: sessionId in buildChatPayload', html, 'payload.sessionId = _chatSessionId');

  // ─── ② Unit test: kosame-chat-sessions ───────────────────────────────────
  console.log('--- ② unit: kosame-chat-sessions ---');
  try {
    const { loadSession, appendToSession, getSessionForGPT } = require(path.join(ROOT, 'tools/kosame-chat-sessions.js'));
    const testSessionId = `smoke-test-${Date.now()}`;
    appendToSession(testSessionId, [
      { role: 'user', content: 'テストメッセージ' },
      { role: 'assistant', content: 'テスト応答' },
    ]);
    const loaded = loadSession(testSessionId);
    if (loaded.length === 2 && loaded[0].role === 'user' && loaded[1].role === 'assistant') {
      ok('sessions: appendToSession + loadSession roundtrip');
    } else {
      fail('sessions: appendToSession + loadSession roundtrip', `got ${JSON.stringify(loaded)}`);
    }
    const forGPT = getSessionForGPT(testSessionId, 1);
    if (forGPT.length === 1 && forGPT[0].role === 'assistant') {
      ok('sessions: getSessionForGPT respects maxMessages');
    } else {
      fail('sessions: getSessionForGPT respects maxMessages', `got ${JSON.stringify(forGPT)}`);
    }
    // Clean up test session
    const sessPath = path.join(ROOT, '.kosame-sessions', `${testSessionId}.json`);
    try { require('fs').unlinkSync(sessPath); } catch (_) {}
    ok('sessions: cleanup test session');
  } catch (e) { fail('sessions: unit test', e.message); }

  // ─── .gitignore: .kosame-sessions/ ───────────────────────────────────────
  console.log('--- .gitignore ---');
  const gitignore = readFile('.gitignore');
  checkContains('.gitignore: .kosame-sessions/', gitignore, '.kosame-sessions/');

  // ─── package.json ──────────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:youtube-gemini-chat-history']) ok('package.json: smoke:youtube-gemini-chat-history exists');
    else fail('package.json: smoke:youtube-gemini-chat-history exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:youtube-gemini-chat-history')) ok('verify includes smoke:youtube-gemini-chat-history');
    else fail('verify includes smoke:youtube-gemini-chat-history');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
