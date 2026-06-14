#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.79 KOSAME Runtime Architecture
 *
 * Verifies docs/kosame-runtime-architecture-v110-79.md:
 *   - File exists
 *   - Key content present
 *   - No secret leakage
 */

const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function versionAtLeast(v, major, minor) {
  const parts = String(v).split('.').map(Number);
  return parts[0] > major || (parts[0] === major && parts[1] >= minor);
}

console.log('=== v110.79 runtime architecture smoke ===');

// ── File existence ────────────────────────────────────────────────────────────

const docPath = path.join(__dirname, '..', 'docs', 'kosame-runtime-architecture-v110-79.md');
const docExists = fs.existsSync(docPath);
check('docs/kosame-runtime-architecture-v110-79.md exists', docExists);

if (!docExists) {
  console.error('\n❌ Document not found, aborting');
  process.exit(1);
}

const content = fs.readFileSync(docPath, 'utf-8');

// ── Key content checks ────────────────────────────────────────────────────────

check('contains "KOSAME Dev Orchestra"',     content.includes('KOSAME Dev Orchestra'));
check('contains "開発OS"',                    content.includes('開発OS'));
check('contains "母艦"',                      content.includes('母艦'));
check('contains "営業DX"',                    content.includes('営業DX'));
check('contains "別repo"',                    content.includes('別repo'));
check('contains "human_gate"',                content.includes('human_gate'));
check('contains "cheap-first"',               content.includes('cheap-first'));
check('contains "pre-commit scope check"',    content.includes('pre-commit scope check'));
check('contains "Cloud Run内で長時間waitしない"', content.includes('Cloud Run内で長時間waitしない'));
check('contains "承認待ちはDB"',              content.includes('承認待ちはDB'));
check('contains "Google Driveは共有/出力用"',   content.includes('共有/出力/人間確認用'));
check('contains "KOSAME Video Factory"',      content.includes('KOSAME Video Factory'));
check('contains "HP作成OS"',                  content.includes('HP作成OS'));

// ── No secret leakage ─────────────────────────────────────────────────────────

check('no API key pattern',       !content.includes('api_key') && !content.includes('sk-') && !content.includes('AIza'));
check('no secret value',          !content.includes('.env') && !content.includes('credentials'));

// ── Package checks ────────────────────────────────────────────────────────────

check('package version >= 110.79.0', versionAtLeast(pkg.version, 110, 79));
check('smoke:v110-79 script in package.json', 'smoke:v110-79' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.79 runtime architecture smoke PASSED`);
} else {
  console.error(`\n❌ v110.79 runtime architecture smoke FAILED (${failures} failures)`);
  process.exit(1);
}
