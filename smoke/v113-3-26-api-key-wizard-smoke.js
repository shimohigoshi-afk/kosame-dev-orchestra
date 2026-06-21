'use strict';

// Smoke test for v113.3.26:
//   API Key Setup Wizard — auto-launches from KOSAME.bat on startup.
//   Prompts only for unset keys; hidden input (read -s); append-only to .env.
// Does NOT read .env values. Does NOT make live calls.

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
  console.log('===== v113-3-26-api-key-wizard smoke =====');
  console.log('Verifies: API Key Wizard script + KOSAME.bat integration');
  console.log('');

  // ─── wizard script ───────────────────────────────────────────────────────
  console.log('--- tools/kosame-api-key-wizard.sh ---');
  const wizardSrc = readFile('tools/kosame-api-key-wizard.sh');
  if (!wizardSrc) { fail('wizard script exists', 'file not found'); }
  else {
    ok('wizard script exists');
    checkContains('wizard: shebang is bash', wizardSrc, '#!/usr/bin/env bash');
    checkContains('wizard: ENV_FILE points to kosame-dev-orchestra/.env', wizardSrc, 'kosame-dev-orchestra/.env');
    checkContains('wizard: GEMINI_API_KEY in target list', wizardSrc, 'GEMINI_API_KEY');
    checkContains('wizard: DEEPSEEK_API_KEY in target list', wizardSrc, 'DEEPSEEK_API_KEY');
    checkContains('wizard: GROK_API_KEY in target list', wizardSrc, 'GROK_API_KEY');
    checkContains('wizard: GROQ_API_KEY in target list', wizardSrc, 'GROQ_API_KEY');
    checkContains('wizard: OPENAI_API_KEY in target list', wizardSrc, 'OPENAI_API_KEY');
    checkContains('wizard: read -s hides input', wizardSrc, 'read -rs');
    checkContains('wizard: appends with >> (never overwrites)', wizardSrc, '>> "$ENV_FILE"');
    checkNotContains('wizard: no write-redirect to .env', wizardSrc, /(?<!>)> "\$ENV_FILE"/);
    checkContains('wizard: skips non-interactive stdin', wizardSrc, '[ -t 0 ]');
    checkContains('wizard: key_has_value function', wizardSrc, 'key_has_value()');
    checkContains('wizard: grep checks for non-empty value', wizardSrc, 'grep -qE');
    checkContains('wizard: exits early if no missing keys', wizardSrc, '-eq 0 ] && exit 0');
    checkContains('wizard: skips already-set keys', wizardSrc, 'key_has_value "$key"');
  }

  // ─── KOSAME.bat integration ──────────────────────────────────────────────
  console.log('--- KOSAME.bat ---');
  const batSrc = readFile('KOSAME.bat');
  if (!batSrc) { fail('KOSAME.bat exists', 'file not found'); }
  else {
    ok('KOSAME.bat exists');
    checkContains('KOSAME.bat: calls kosame-api-key-wizard.sh', batSrc, 'kosame-api-key-wizard.sh');
    checkContains('KOSAME.bat: wizard runs via wsl bash', batSrc, 'bash tools/kosame-api-key-wizard.sh');
    checkContains('KOSAME.bat: wizard runs before cockpit:server', batSrc, /kosame-api-key-wizard[\s\S]{0,200}cockpit:server/);
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
    if (scripts['smoke:api-key-wizard']) ok('package.json: smoke:api-key-wizard exists');
    else fail('package.json: smoke:api-key-wizard exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:api-key-wizard')) ok('verify includes smoke:api-key-wizard');
    else fail('verify includes smoke:api-key-wizard');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
