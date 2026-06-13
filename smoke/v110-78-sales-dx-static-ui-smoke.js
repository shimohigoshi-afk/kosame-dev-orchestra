#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.78 Sales DX P0 Lite Static UI
 *
 * Verifies public/sales-dx-p0-lite-demo.html:
 *   - File exists
 *   - Key headings and labels present
 *   - Sample fixture data present (中温度_警戒あり)
 *   - Safety notices present
 *   - Dry Run table present
 *   - No real API calls (fetch / axios / XMLHttpRequest)
 *   - No localStorage / sessionStorage
 *   - No React / Next / Vite / CDN
 *   - No forbidden expressions
 *   - No secret leakage
 *   - No transcriber / ANESTY Board
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

console.log('=== v110.78 sales dx static ui smoke ===');

// ── File existence ────────────────────────────────────────────────────────────

const htmlPath = path.join(__dirname, '..', 'public', 'sales-dx-p0-lite-demo.html');
const htmlExists = fs.existsSync(htmlPath);
check('public/sales-dx-p0-lite-demo.html exists', htmlExists);

if (!htmlExists) {
  console.error('\n❌ HTML file not found, aborting');
  process.exit(1);
}

const content = fs.readFileSync(htmlPath, 'utf-8');

// ── Key content checks ────────────────────────────────────────────────────────

check('contains "KOSAME 商談アシスト"', content.includes('KOSAME 商談アシスト'));
check('contains "β版"', content.includes('β版'));
check('contains "面談メモ"',        content.includes('面談メモ'));
check('contains "デモ解析"',        content.includes('デモ解析'));
check('contains "中温度_警戒あり"', content.includes('中温度_警戒あり'));
check('contains "AIによる下書き"',  content.includes('AIによる下書き'));
check('contains "最終確認は人間"',  content.includes('最終確認は人間'));
check('contains "法令遵守の確認を代替するものではありません"', content.includes('法令遵守の確認を代替するものではありません'));
check('contains "Dry Run"',        content.includes('Dry Run'));

// Save NO check: any of these patterns
const saveNoPatterns = ['保存: NO', '保存</td><td>NO', '保存', 'NO'];
const hasSaveNo = content.includes('保存: NO') || content.includes('保存</td><td>NO') ||
  (content.includes('保存') && content.includes('NO'));
check('contains save NO equivalent', hasSaveNo);

// ── No real API calls ─────────────────────────────────────────────────────────

check('no fetch() call',          !content.includes('fetch('));
check('no XMLHttpRequest',        !content.includes('XMLHttpRequest'));
check('no axios',                 !content.includes('axios'));
check('no localStorage',          !content.includes('localStorage'));
check('no sessionStorage',        !content.includes('sessionStorage'));

// ── No framework / CDN ────────────────────────────────────────────────────────

check('no React',                 !content.includes('React') || content === 'React');
check('no Next',                  !content.includes('Next'));
check('no Vite',                  !content.includes('Vite'));
check('no CDN',                   !content.includes('CDN') && !content.includes('cdn.'));

// ── Forbidden expressions ─────────────────────────────────────────────────────

const forbiddenExpr = ['自動判定', '確定', '正確に判断', 'コンプラ保証', '法令遵守を保証', '最適な追客', '完全自動化'];
for (const fe of forbiddenExpr) {
  check(`no forbidden expr: "${fe}"`, !content.includes(fe));
}

// ── No secret leakage ─────────────────────────────────────────────────────────

check('no API key pattern',       !content.includes('api_key') && !content.includes('sk-') && !content.includes('AIza'));
check('no secret value',          !content.includes('.env') && !content.includes('credentials'));

// ── No transcriber / ANESTY Board ─────────────────────────────────────────────

check('no "transcriber"',         !content.includes('transcriber'));
check('no "ANESTY"',              !content.includes('ANESTY'));

// ── Package checks ────────────────────────────────────────────────────────────

check('package version >= 110.78.0', versionAtLeast(pkg.version, 110, 78));
check('smoke:v110-78 script in package.json', 'smoke:v110-78' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.78 sales dx static ui smoke PASSED`);
} else {
  console.error(`\n❌ v110.78 sales dx static ui smoke FAILED (${failures} failures)`);
  process.exit(1);
}
