'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require('../package.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.99 ASL persona smoke =====');

// ── version ──────────────────────────────────────────────────────────────────
const [maj, min, patch] = pkg.version.split('.').map(Number);
assert.ok(
  maj > 113 || (maj === 113 && min > 3) || (maj === 113 && min === 3 && patch >= 99),
  `package version must be >= 113.3.99 (got ${pkg.version})`,
);
assert.ok(pkg.scripts['smoke:v113-3-99'], 'smoke:v113-3-99 must exist');
assert.ok(pkg.scripts['verify:dev-os'].includes('smoke:v113-3-99'), 'verify:dev-os must include smoke:v113-3-99');
console.log('  PASS: version >= 113.3.99');

const html = read('public/kosame-live-cockpit.html');

// ── CSS colors ────────────────────────────────────────────────────────────────
assert.ok(html.includes('.asl-agent-KOSAME       { color: #00bcd4;'), 'KOSAME color #00bcd4');
assert.ok(html.includes('.asl-agent-DIRECTOR     { color: #00bcd4;'), 'DIRECTOR(Claude) color #00bcd4');
assert.ok(html.includes('.asl-agent-DIRECTOR-GPT { color: #10a37f;'), 'DIRECTOR(GPT) color #10a37f');
assert.ok(html.includes('.asl-agent-GPT          { color: #10a37f;'), 'GPT color #10a37f');
assert.ok(html.includes('.asl-agent-Claude   { color: #D97757;'), 'Claude color #D97757');
assert.ok(html.includes('.asl-agent-Gemini   { color: #EA4335;'), 'Gemini color #EA4335');
assert.ok(html.includes('.asl-agent-Grok     { color: #8899aa;'), 'Grok color #8899aa');
assert.ok(html.includes('.asl-agent-DeepSeek { color: #4D6BFE;'), 'DeepSeek color #4D6BFE');
assert.ok(html.includes('.asl-agent-Llama    { color: #6e57d2;'), 'Llama color #6e57d2');
console.log('  PASS: ASL agent colors all correct');

// ── display name map ──────────────────────────────────────────────────────────
assert.ok(html.includes("'DIRECTOR':      'DIRECTOR(Claude)'"), 'DIRECTOR display name = DIRECTOR(Claude)');
assert.ok(html.includes("'Claude':        'Claude(品質)'"), 'Claude display name = Claude(品質)');
assert.ok(html.includes("ASL_DISPLAY_NAMES[agent] || agent"), 'addAgentStreamLog uses ASL_DISPLAY_NAMES');
console.log('  PASS: display name mapping (DIRECTOR→DIRECTOR(Claude), Claude→Claude(品質))');

// ── ASL_DEMO persona messages ─────────────────────────────────────────────────
// KOSAME: ☂️💙 こさめ口調
assert.ok(html.includes("agent: 'KOSAME'") && html.includes('☂️💙'), 'KOSAME demo has ☂️💙');
// DIRECTOR: ☂️
assert.ok(html.includes("agent: 'DIRECTOR'") && html.includes("agent: 'DIRECTOR', msg: '☂️"), 'DIRECTOR demo starts with ☂️');
// GPT: 絵文字なし、短文
assert.ok(html.includes("agent: 'GPT'"), 'GPT entry exists in demo');
// Claude: 「…」で始まることも、完了時🔍
assert.ok(html.includes('…実装とテスト'), 'Claude demo starts with …');
assert.ok(html.includes('🔍'), 'Claude completion demo has 🔍');
// Gemini: 「あれー！」あり、完了時❤️
assert.ok(html.includes('あれー！'), 'Gemini demo has あれー！');
assert.ok(html.includes('❤️'), 'Gemini completion has ❤️');
// Grok: 語尾に…
assert.ok(html.includes("agent: 'Grok'") && html.includes('…'), 'Grok demo ends with …');
// DeepSeek: 短文
assert.ok(html.includes("agent: 'DeepSeek'"), 'DeepSeek entry exists');
// Llama: 必ず「以上。」で締める
assert.ok(html.includes('以上。'), 'Llama demo ends with 以上。');
console.log('  PASS: ASL_DEMO persona messages — KOSAME/DIRECTOR/GPT/Claude/Gemini/Grok/DeepSeek/Llama');

// ── キャラ設定コメントが存在する ──────────────────────────────────────────────
assert.ok(html.includes('キャラ設定 v113.3.99'), 'persona spec comment present');
console.log('  PASS: persona spec comment present');

console.log('\n✅ v113.3.99 ASL persona smoke PASSED');
