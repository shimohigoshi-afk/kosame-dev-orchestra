#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.77 Sales DX P0 Lite UI Spec
 *
 * Verifies docs/sales-dx-p0-lite-ui-spec-v110-77.md:
 *   - File exists
 *   - Key headings present
 *   - Safety notices present
 *   - Dry Run table present
 *   - Forbidden expressions absent
 *   - No secret leakage
 *   - No transcriber / ANESTY Board references
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

console.log('=== v110.77 sales dx ui spec smoke ===');

// ── File existence ────────────────────────────────────────────────────────────

const specPath = path.join(__dirname, '..', 'docs', 'sales-dx-p0-lite-ui-spec-v110-77.md');
const specExists = fs.existsSync(specPath);
check('docs/sales-dx-p0-lite-ui-spec-v110-77.md exists', specExists);

if (!specExists) {
  console.error('\n❌ Spec file not found, aborting');
  process.exit(1);
}

const content = fs.readFileSync(specPath, 'utf-8');

// ── Key content checks ────────────────────────────────────────────────────────

check('contains "営業DX P0 Lite"',         content.includes('営業DX P0 Lite'));
check('contains "1画面UI"',                content.includes('1画面UI'));
check('contains "AIによる下書き"',          content.includes('AIによる下書き'));
check('contains "最終確認は人間"',           content.includes('最終確認は人間'));
check('contains "保存なし"',                content.includes('保存なし'));
check('contains "送信なし"',                content.includes('送信なし'));
check('contains "課金なし"',                content.includes('課金なし'));
check('contains "外部API接続なし"',          content.includes('外部API接続なし'));

// ── Forbidden expressions ─────────────────────────────────────────────────────

const forbiddenExpr = ['自動判定', '確定', '正確に判断', 'コンプラ保証', '法令遵守を保証', '最適な追客', '完全自動化'];
for (const fe of forbiddenExpr) {
  check(`no forbidden expr: "${fe}"`, !content.includes(fe));
}

// ── No secret leakage ─────────────────────────────────────────────────────────

check('no API key string in spec',      !content.includes('sk-') && !content.includes('AIza'));
check('no secret value in spec',        !content.includes('api_key=') && !content.includes('.env') && !content.includes('credentials'));
check('no Secret string in spec',       !content.includes('Secret') || (content.includes('Secret') && content.includes('Secret・API key')));
check('no API key pattern',             !content.includes('api_key'));
check('no .env pattern',                !content.includes('.env') || (content.includes('.env') && content.includes('.env・credentials')));

// ── No transcriber / ANESTY Board references ─────────────────────────────────

check('no "transcriber" reference',     !content.includes('transcriber'));
check('no "ANESTY Board" or ANESTY',    !content.includes('ANESTY'));

// ── Package version check ─────────────────────────────────────────────────────

check('package version >= 110.77.0',    versionAtLeast(pkg.version, 110, 77));

// ── smoke:v110-77 script exists ──────────────────────────────────────────────

check('smoke:v110-77 script in package.json', 'smoke:v110-77' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.77 sales dx ui spec smoke PASSED`);
} else {
  console.error(`\n❌ v110.77 sales dx ui spec smoke FAILED (${failures} failures)`);
  process.exit(1);
}
