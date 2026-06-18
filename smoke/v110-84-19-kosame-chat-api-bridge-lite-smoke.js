#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const chatServer = require('../tools/kosame-cockpit-chat-server');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const CHAT_LOG_PATH = path.join(os.homedir(), '.kosame', 'kosame-chat-events.jsonl');

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requestJson(port, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, body: JSON.parse(raw || '{}') });
          } catch (error) {
            reject(new Error(`invalid json response: ${error.message}\nraw=${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== v110.84.19 kosame chat api bridge lite smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.19'), `package version must be >= 110.84.19 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-19'], 'smoke:v110-84-19 must exist in scripts');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-19'), 'verify must include smoke:v110-84-19');
  console.log('  PASS: package wiring');

  mustExist(HTML_PATH);
  const html = read(HTML_PATH);
  assert.ok(html.includes('/api/chat'), 'HTML must submit to /api/chat');
  assert.ok(html.includes('sendChatMessage'), 'HTML must include sendChatMessage');
  assert.ok(html.includes("e.key === 'Enter' && !e.shiftKey"), 'HTML must keep Enter-to-send handling');
  assert.ok(html.includes('Shift+Enterで改行'), 'HTML must keep Shift+Enter hint');
  assert.ok(html.includes('message: trimmedMessage'), 'HTML payload must send trimmed textarea message');
  assert.ok(!html.includes('messages: chatHistory'), 'HTML payload must not send full chat history');
  assert.ok(html.includes('AGENT SHORT CONVERSATION FEED'), 'HTML must include agent short conversation feed heading');
  assert.ok(html.includes('agent-event-feed-toggle'), 'HTML must include agent feed expand/collapse control');
  assert.ok(html.includes('const visibleItems = agentEventFeedExpanded ? items : items.slice(-3);'), 'HTML must keep compact feed expansion state');
  assert.ok(html.includes('slice(-3)'), 'HTML must only show the latest three agent feed items by default');
  assert.ok(html.includes('max-height: 208px'), 'HTML must cap the feed height for compact layout');
  assert.ok(!html.includes('>送信<'), 'HTML must not include a visible send button');
  console.log('  PASS: HTML chat wiring');

  const chatSource = read(path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js'));
  assert.ok(chatSource.includes('buildLocalReply'), 'chat server must include local responder');
  assert.ok(chatSource.includes('appendChatEvent'), 'chat server must include chat persistence helper');
  assert.ok(!chatSource.includes('api.openai.com'), 'chat server must not call OpenAI');
  assert.ok(!chatSource.includes('OPENAI_API_KEY'), 'chat server must not read OpenAI API keys');
  assert.ok(!chatSource.includes('GEMINI_API_KEY'), 'chat server must not read Gemini API keys');
  assert.ok(!chatSource.includes('ANTHROPIC_API_KEY'), 'chat server must not read Claude API keys');
  console.log('  PASS: chat server source is local-only');

  const { server } = createLiveCockpitServer({});
  const started = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

  try {
    const okRes = await requestJson(started, {
      message: '今の状況を教えて',
      project: 'KOSAME Console',
      context: 'currentVersion=110.84.19; shellActivity=ok; taskFeeder=ok; confirmationBridge=none',
    });
    assert.equal(okRes.statusCode, 200, 'successful chat request must return 200');
    assert.equal(okRes.body.ok, true, 'successful chat request must return ok=true');
    assert.equal(typeof okRes.body.reply, 'string', 'successful chat request must return reply');
    assert.equal(typeof okRes.body.suggested_action, 'string', 'successful chat request must return suggested_action');
    assert.equal(okRes.body.human_gate_required, false, 'successful chat request must not require human gate');
    assert.ok(okRes.body.reply.length > 0, 'reply must be non-empty');
    assert.ok(okRes.body.suggested_action.length > 0, 'suggested_action must be non-empty');
    assert.ok(/\d{4}-\d{2}-\d{2}T/.test(okRes.body.created_at), 'created_at must be ISO-like');
    assert.ok(!okRes.body.reply.includes('currentVersion='), 'reply must not expose raw currentVersion key/value');
    assert.ok(!okRes.body.reply.includes('changed='), 'reply must not expose raw changed count');
    assert.ok(/確認中|未コミット|正本化/.test(okRes.body.reply), 'reply must read naturally in Japanese');
    console.log('  PASS: /api/chat normal response');

    const longContextRes = await requestJson(started, {
      message: '今の状況を教えて',
      project: 'KOSAME Console',
      context: 'x'.repeat(5000),
    });
    assert.equal(longContextRes.statusCode, 200, 'long context with short message must still succeed');
    assert.equal(longContextRes.body.ok, true, 'long context with short message must keep ok=true');
    assert.ok(!longContextRes.body.reply.includes('currentVersion='), 'long context reply must stay natural');
    console.log('  PASS: long context does not block short message');

    const emptyRes = await requestJson(started, { message: '   ' });
    assert.ok(emptyRes.statusCode >= 400, 'empty message must be rejected');
    assert.equal(emptyRes.body.ok, false, 'empty message must set ok=false');
    assert.ok(/message/.test(emptyRes.body.error || ''), 'empty message error must mention message');
    console.log('  PASS: empty message rejected');

    const longRes = await requestJson(started, { message: 'x'.repeat(2001) });
    assert.ok(longRes.statusCode >= 400, 'long message must be rejected');
    assert.equal(longRes.body.ok, false, 'long message must set ok=false');
    assert.ok(/長すぎ/.test(longRes.body.error || ''), 'long message error must mention length');
    console.log('  PASS: long message rejected');

    const secretRes = await requestJson(started, { message: 'sk-test-1234567890abcdef' });
    assert.ok(secretRes.statusCode >= 400, 'secret-like message must be rejected');
    assert.equal(secretRes.body.ok, false, 'secret-like message must set ok=false');
    assert.ok(/secret/.test(secretRes.body.error || ''), 'secret-like rejection must be explicit');
    console.log('  PASS: secret-like input rejected');

    if (fs.existsSync(CHAT_LOG_PATH)) {
      const tail = fs
        .readFileSync(CHAT_LOG_PATH, 'utf8')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-5);
      for (const line of tail) {
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          continue;
        }
        assert.ok(typeof row.timestamp === 'string', 'chat event must include timestamp');
        assert.equal(row.type, 'chat', 'chat event must keep type=chat');
        assert.ok(!JSON.stringify(row).includes('sk-test-1234567890abcdef'), 'chat event must not store secret-like text');
      }
      console.log('  PASS: optional chat persistence remains minimal');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('✅ v110.84.19 kosame chat api bridge lite smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
