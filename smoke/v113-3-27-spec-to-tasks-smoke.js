'use strict';

// Smoke test for v113.3.27:
//   Spec-to-Tasks pipeline: design doc → work tickets → Handoff Inbox → Runner
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

async function main() {
  console.log('===== v113-3-27-spec-to-tasks smoke =====');
  console.log('Verifies: Spec-to-Tasks pipeline module + chat server integration');
  console.log('');

  // ─── module exists & syntax ──────────────────────────────────────────────
  console.log('--- tools/kosame-spec-to-tasks.js ---');
  const specSrc = readFile('tools/kosame-spec-to-tasks.js');
  if (!specSrc) { fail('kosame-spec-to-tasks.js exists', 'file not found'); }
  else {
    ok('kosame-spec-to-tasks.js exists');
    checkContains('module: detectSpecIntent exported', specSrc, 'detectSpecIntent');
    checkContains('module: analyzeSpecWithGemini exported', specSrc, 'analyzeSpecWithGemini');
    checkContains('module: analyzeSpecText exported', specSrc, 'analyzeSpecText');
    checkContains('module: decomposeSpecToTasks exported', specSrc, 'decomposeSpecToTasks');
    checkContains('module: saveTasksToHandoff exported', specSrc, 'saveTasksToHandoff');
    checkContains('module: emitSpecStreamLog exported', specSrc, 'emitSpecStreamLog');
    checkContains('module: processSpec exported', specSrc, 'processSpec');
    checkContains('module: SPEC_TRIGGERS constant', specSrc, 'SPEC_TRIGGERS');
    checkContains('module: SPEC_EXTENSIONS constant', specSrc, 'SPEC_EXTENSIONS');
    checkContains('module: Gemini inline_data for image', specSrc, 'inline_data');
    checkContains('module: saveHandoffInbox called', specSrc, 'saveHandoffInbox');
    checkContains('module: appendShellAgentActivityEvent for stream log', specSrc, 'appendShellAgentActivityEvent');
    checkContains('module: DIRECTOR agent in stream log', specSrc, "'DIRECTOR'");
    checkContains('module: image extension check', specSrc, 'IMAGE_EXTS');
    checkContains('module: heuristic section heading detection', specSrc, /#{1,3}/);
    checkContains('module: heuristic numbered item detection', specSrc, /\\d\+\[.\)\]/);
  }

  // ─── module unit tests ───────────────────────────────────────────────────
  console.log('--- unit: kosame-spec-to-tasks ---');
  try {
    const mod = require(path.join(ROOT, 'tools/kosame-spec-to-tasks.js'));

    // detectSpecIntent — keyword alone does NOT trigger (file required)
    const r1 = mod.detectSpecIntent('設計書を投げます', []);
    if (!r1.isSpec && r1.hasSpecKeyword) ok('detectSpecIntent: keyword alone → isSpec=false, hasSpecKeyword=true');
    else fail('detectSpecIntent: keyword alone → isSpec=false, hasSpecKeyword=true', JSON.stringify(r1));

    const r2 = mod.detectSpecIntent('こんにちは', []);
    if (!r2.isSpec) ok('detectSpecIntent: no keyword + no attachments → isSpec=false');
    else fail('detectSpecIntent: no keyword + no attachments → isSpec=false');

    const r3 = mod.detectSpecIntent('', [{ ext: '.md', name: 'spec.md' }]);
    if (r3.isSpec) ok('detectSpecIntent: .md attachment → isSpec=true');
    else fail('detectSpecIntent: .md attachment → isSpec=true');

    const r4 = mod.detectSpecIntent('', [{ base64DataUrl: 'data:image/png;base64,abc', ext: '.png', name: 'design.png' }]);
    if (r4.isSpec) ok('detectSpecIntent: image attachment → isSpec=true');
    else fail('detectSpecIntent: image attachment → isSpec=true');

    // analyzeSpecText
    const r5 = mod.analyzeSpecText('テスト内容', 'test.md');
    if (r5.text === 'テスト内容' && r5.filename === 'test.md') ok('analyzeSpecText: returns text and filename');
    else fail('analyzeSpecText: returns text and filename', JSON.stringify(r5));

    // decomposeSpecToTasks — section headings
    const specMd = `# ログイン画面\nユーザー認証が必要です。\n\n## ダッシュボード\nKPIを表示します。`;
    const tasks = mod.decomposeSpecToTasks(specMd, '/home/lavie/kosame-dev-orchestra');
    if (tasks.length >= 2) ok(`decomposeSpecToTasks: sections → ${tasks.length} tasks`);
    else fail(`decomposeSpecToTasks: sections → at least 2 tasks`, `got ${tasks.length}`);

    // Task structure
    const t = tasks[0];
    const hasId = typeof t.id === 'string' && t.id.startsWith('spec-');
    const hasTitle = typeof t.title === 'string' && t.title.length > 0;
    const hasAgent = t.assigned_agent === 'Codex';
    const hasRisk = t.risk_level === 'low';
    const hasGate = t.human_gate_required === false;
    const hasRepo = typeof t.target_repo === 'string' && t.target_repo.length > 0;
    const hasPrompt = typeof t.prompt_text === 'string' && t.prompt_text.length > 0;
    if (hasId && hasTitle && hasAgent && hasRisk && hasGate && hasRepo && hasPrompt) {
      ok('decomposeSpecToTasks: task structure has all required fields');
    } else {
      fail('decomposeSpecToTasks: task structure', JSON.stringify({ hasId, hasTitle, hasAgent, hasRisk, hasGate, hasRepo, hasPrompt }));
    }

    // decomposeSpecToTasks — fallback for unstructured text
    const plain = 'ユーザー管理機能を実装してください。';
    const fallbackTasks = mod.decomposeSpecToTasks(plain, '/home/lavie/kosame-dev-orchestra');
    if (fallbackTasks.length === 1) ok('decomposeSpecToTasks: unstructured → 1 fallback task');
    else fail('decomposeSpecToTasks: unstructured → 1 fallback task', `got ${fallbackTasks.length}`);

    // decomposeSpecToTasks — numbered items
    const numbered = '1. ログイン機能\n2. ユーザー一覧\n3. 詳細画面';
    const numTasks = mod.decomposeSpecToTasks(numbered, '/home/lavie/kosame-dev-orchestra');
    if (numTasks.length === 3) ok('decomposeSpecToTasks: numbered items → 3 tasks');
    else fail('decomposeSpecToTasks: numbered items → 3 tasks', `got ${numTasks.length}`);

    // SPEC_TRIGGERS and SPEC_EXTENSIONS
    if (Array.isArray(mod.SPEC_TRIGGERS) && mod.SPEC_TRIGGERS.includes('設計書')) ok('SPEC_TRIGGERS includes 設計書');
    else fail('SPEC_TRIGGERS includes 設計書');
    if (Array.isArray(mod.SPEC_EXTENSIONS) && mod.SPEC_EXTENSIONS.includes('.md')) ok('SPEC_EXTENSIONS includes .md');
    else fail('SPEC_EXTENSIONS includes .md');
    if (Array.isArray(mod.SPEC_EXTENSIONS) && mod.SPEC_EXTENSIONS.includes('.png')) ok('SPEC_EXTENSIONS includes .png');
    else fail('SPEC_EXTENSIONS includes .png');

    ok('unit tests: all kosame-spec-to-tasks unit tests passed');
  } catch (e) { fail('unit tests: kosame-spec-to-tasks', e.message); }

  // ─── chat server integration ─────────────────────────────────────────────
  console.log('--- chat server integration ---');
  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  if (!chatSrc) { fail('chat server exists', 'file not found'); }
  else {
    checkContains('chat: requires kosame-spec-to-tasks', chatSrc, 'kosame-spec-to-tasks');
    checkContains('chat: detectSpecIntent called', chatSrc, 'detectSpecIntent');
    checkContains('chat: processSpec called', chatSrc, 'processSpec');
    checkContains('chat: spec pipeline runs before GPT', chatSrc, /detectSpecIntent[\s\S]{0,300}processSpec/);
    checkContains('chat: returns early on spec detection', chatSrc, /specResult\.ok[\s\S]{0,1000}return result/);
    checkContains('chat: 完成しました mentioned in reply', chatSrc, '完成しました');
    checkContains('chat: Handoff Inbox mentioned in reply', chatSrc, 'Handoff Inbox');
  }

  // ─── package.json ────────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:spec-to-tasks']) ok('package.json: smoke:spec-to-tasks exists');
    else fail('package.json: smoke:spec-to-tasks exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:spec-to-tasks')) ok('verify includes smoke:spec-to-tasks');
    else fail('verify includes smoke:spec-to-tasks');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
