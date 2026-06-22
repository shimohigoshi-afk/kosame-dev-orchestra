'use strict';

// Smoke test for v113.3.28:
//   spec-to-tasks base64 stripping — prevent forbidden pattern false-positives
//   in saveHandoffInbox when a markdown spec file has embedded base64 images.
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
  console.log('===== v113-3-28-spec-handoff-base64 smoke =====');
  console.log('Verifies: base64 data URL stripping in spec-to-tasks before handoff save');
  console.log('');

  // ─── Source checks ────────────────────────────────────────────────────────
  console.log('--- tools/kosame-spec-to-tasks.js source ---');
  const specSrc = readFile('tools/kosame-spec-to-tasks.js');
  if (!specSrc) { fail('kosame-spec-to-tasks.js exists', 'file not found'); }
  else {
    ok('kosame-spec-to-tasks.js exists');
    checkContains('source: _stripBase64DataUrls function defined', specSrc, '_stripBase64DataUrls');
    checkContains('source: strips data URL pattern', specSrc, ';base64,');
    checkContains('source: strip called on att.textContent path', specSrc, '_stripBase64DataUrls(parsed.text)');
    checkContains('source: final guard strip before decomposeSpecToTasks', specSrc, '_stripBase64DataUrls(specText)');
    checkContains('source: _stripBase64DataUrls exported', specSrc, /module\.exports\s*=[\s\S]{0,500}_stripBase64DataUrls/);
    checkContains('source:除去済み placeholder in strip result', specSrc, 'base64データ・除去済み');
  }

  // ─── Unit tests ───────────────────────────────────────────────────────────
  console.log('--- unit: _stripBase64DataUrls ---');
  try {
    const mod = require(path.join(ROOT, 'tools/kosame-spec-to-tasks.js'));

    // Basic strip
    const simple = 'データ: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA 終わり';
    const stripped = mod._stripBase64DataUrls(simple);
    if (!stripped.includes('data:image/png;base64,iVBORw0KGgo') && stripped.includes('[base64データ・除去済み]')) {
      ok('_stripBase64DataUrls: strips PNG data URL');
    } else {
      fail('_stripBase64DataUrls: strips PNG data URL', stripped.slice(0, 80));
    }

    // Markdown embedded image
    const mdWithImage = '# 設計書\n\n![図1](data:image/jpeg;base64,/9j/4AAQSkZJRgAB+deploy+SECRET==)\n\n## 実装方針\nAPIを実装する。';
    const strippedMd = mod._stripBase64DataUrls(mdWithImage);
    if (strippedMd.includes('deploy') || strippedMd.includes('SECRET')) {
      fail('_stripBase64DataUrls: embedded markdown image: forbidden words removed', strippedMd.slice(0, 120));
    } else if (strippedMd.includes('## 実装方針') && strippedMd.includes('[base64データ・除去済み]')) {
      ok('_stripBase64DataUrls: embedded markdown image stripped, surrounding text preserved');
    } else {
      fail('_stripBase64DataUrls: embedded markdown image stripped', strippedMd.slice(0, 120));
    }

    // Plain text without base64 is unchanged
    const plain = '## API設計\n1. ログイン\n2. ユーザー一覧';
    const unchanged = mod._stripBase64DataUrls(plain);
    if (unchanged === plain) ok('_stripBase64DataUrls: plain text unchanged');
    else fail('_stripBase64DataUrls: plain text unchanged', unchanged.slice(0, 80));

    // webp type
    const webp = 'image: data:image/webp;base64,UklGRlYAAABXRUJQVlA4IEoAAAAwAQCd';
    const strippedWebp = mod._stripBase64DataUrls(webp);
    if (!strippedWebp.includes(';base64,') && strippedWebp.includes('[base64データ・除去済み]')) {
      ok('_stripBase64DataUrls: strips webp data URL');
    } else {
      fail('_stripBase64DataUrls: strips webp data URL', strippedWebp.slice(0, 80));
    }

    ok('unit tests: _stripBase64DataUrls all passed');
  } catch (e) { fail('unit tests: _stripBase64DataUrls', e.message); }

  // ─── decomposeSpecToTasks with base64 input ───────────────────────────────
  console.log('--- unit: decomposeSpecToTasks base64 safety ---');
  try {
    const mod = require(path.join(ROOT, 'tools/kosame-spec-to-tasks.js'));

    // Simulate a markdown file that has embedded base64 images
    // The base64 section intentionally contains forbidden-pattern substrings
    const specWithBase64 = [
      '# 機能設計書',
      '',
      '## ログイン画面',
      'ユーザーはメールアドレスとパスワードでログインします。',
      '',
      '![ワイヤーフレーム](data:image/png;base64,iVBOR/deploy/SECRET/TOKEN/w0KGgoAAAANSUhEUgAAABAA==)',
      '',
      '## ダッシュボード',
      'KPIを表示します。',
    ].join('\n');

    // First strip base64 (as processSpec does), then decompose
    const cleanSpec = mod._stripBase64DataUrls(specWithBase64);
    const tasks = mod.decomposeSpecToTasks(cleanSpec, '/home/lavie/kosame-dev-orchestra');

    if (tasks.length >= 2) ok(`decomposeSpecToTasks with base64 stripped: ${tasks.length} tasks`);
    else fail('decomposeSpecToTasks with base64 stripped: at least 2 tasks', `got ${tasks.length}`);

    const allPrompts = tasks.map((t) => t.prompt_text).join('\n');
    const hasForbidden = /data:[a-z]+\/[a-z]+;base64,[A-Za-z0-9+/=]{5,}/i.test(allPrompts);
    if (!hasForbidden) ok('prompt_text: no base64 data URL in any task prompt');
    else fail('prompt_text: no base64 data URL in any task prompt', 'found base64 in prompt_text');

    // Confirm the deploy/SECRET/TOKEN from the base64 are gone from prompts
    const hasDeployFromBase64 = allPrompts.includes('/deploy/');
    const hasSecretFromBase64 = allPrompts.includes('/SECRET/');
    const hasTokenFromBase64 = allPrompts.includes('/TOKEN/');
    if (!hasDeployFromBase64 && !hasSecretFromBase64 && !hasTokenFromBase64) {
      ok('prompt_text: forbidden words from base64 payload are stripped');
    } else {
      fail('prompt_text: forbidden words from base64 payload are stripped',
        `deploy=${hasDeployFromBase64} secret=${hasSecretFromBase64} token=${hasTokenFromBase64}`);
    }

    ok('unit tests: decomposeSpecToTasks base64 safety all passed');
  } catch (e) { fail('unit tests: decomposeSpecToTasks base64 safety', e.message); }

  // ─── Package checks ───────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:spec-handoff-base64']) ok('package.json: smoke:spec-handoff-base64 exists');
    else fail('package.json: smoke:spec-handoff-base64 exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:spec-handoff-base64')) ok('verify includes smoke:spec-handoff-base64');
    else fail('verify includes smoke:spec-handoff-base64');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
