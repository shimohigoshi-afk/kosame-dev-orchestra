#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

async function main() {
  console.log('=== v113.3.6 agent-stream-log smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.6'), `version must be >= 113.3.6 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-6'], 'smoke:v113-3-6 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-6'), 'verify must include smoke:v113-3-6');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 1. details element exists with open attribute
  assert.ok(html.includes('id="agent-stream-log-details"'), 'agent-stream-log-details must exist');
  assert.ok(/id="agent-stream-log-details"[^>]*\bopen\b/.test(html), 'agent-stream-log-details must have open attribute');
  console.log('  PASS: agent-stream-log-details open by default');

  // 2. log body element
  assert.ok(html.includes('id="agent-stream-log"'), 'agent-stream-log body must exist');
  console.log('  PASS: agent-stream-log body exists');

  // 3. CSS: height 200px + overflow-y
  assert.ok(html.includes('.agent-stream-log-body'), '.agent-stream-log-body CSS must exist');
  assert.ok(/height:\s*200px/.test(html), 'agent-stream-log-body must have height:200px');
  assert.ok(/overflow-y:\s*auto/.test(html), 'agent-stream-log-body must have overflow-y:auto');
  console.log('  PASS: agent-stream-log-body CSS (200px, scroll)');

  // 4. All 7 agent CSS classes
  const agents = ['KOSAME','GPT','Claude','Gemini','Grok','DeepSeek','Llama'];
  for (const a of agents) {
    assert.ok(html.includes(`.asl-agent-${a}`), `.asl-agent-${a} CSS must exist`);
  }
  console.log('  PASS: all 7 agent CSS classes');

  // 5. Gemini color #EA4335
  assert.ok(html.includes('#EA4335'), 'Gemini must use Google red #EA4335');
  assert.ok(!html.includes('asl-agent-Gemini') || html.match(/asl-agent-Gemini[^}]*#EA4335/), 'Gemini CSS must use #EA4335');
  console.log('  PASS: Gemini color #EA4335');

  // 6. Cursor blink animation
  assert.ok(html.includes('asl-blink'), 'asl-blink keyframe must exist');
  assert.ok(html.includes('asl-cursor'), 'asl-cursor class must exist');
  console.log('  PASS: cursor blink animation');

  // 7. JS addAgentStreamLog function
  assert.ok(html.includes('addAgentStreamLog'), 'addAgentStreamLog must be defined');
  assert.ok(html.includes('window.addAgentStreamLog'), 'addAgentStreamLog must be exposed on window');
  console.log('  PASS: addAgentStreamLog JS function');

  // 8. Demo messages with all 7 agents
  for (const a of agents) {
    assert.ok(html.includes(`'${a}'`), `demo must reference agent '${a}'`);
  }
  console.log('  PASS: demo references all 7 agents');

  // 9. Emoji rules
  assert.ok(html.includes('☂️'), 'KOSAME ☂️ must be in demo');
  assert.ok(html.includes('💙') || html.includes('\u{1F499}') || html.includes('💙') || html.includes('💙'), 'KOSAME 💙 must be in demo');
  assert.ok(html.includes('🔍') || html.includes('🔍'), 'Claude 🔍 must be in demo');
  assert.ok(html.includes('❤️') || html.includes('❤️'), 'Gemini ❤️ must be in demo');
  assert.ok(html.includes('…') || html.includes('…'), 'Grok … must be in demo');
  assert.ok(html.includes('以上。') || html.includes('以上。'), 'Llama 以上。must be in demo');
  console.log('  PASS: emoji rules in demo messages');

  // 10. Placement: log appears before chat-primary-actions
  const aslPos  = html.indexOf('id="agent-stream-log-details"');
  const inputPos = html.indexOf('class="chat-primary-actions chat-command-bar"');
  assert.ok(aslPos > 0 && inputPos > 0, 'both elements must exist');
  assert.ok(aslPos < inputPos, 'agent-stream-log-details must appear before chat-primary-actions');
  console.log('  PASS: ASL placed above chat input');

  // 11. Typing animation (40ms per char)
  assert.ok(html.includes('setTimeout(next, 40)'), 'typing animation 40ms per char must exist');
  console.log('  PASS: 40ms/char typing animation');

  // 12. Regression
  assert.ok(html.includes('id="chat-input"'), 'chat-input must not be regressed');
  assert.ok(html.includes('id="chat-thread"'), 'chat-thread must not be regressed');
  assert.ok(html.includes('id="agent-stream-log-details"'), 'agent-stream-log-details must exist');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.6 agent-stream-log smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
