#!/usr/bin/env node
'use strict';

// PDF取り込みスクリプト — 医務査定検索データ更新ツール
//
// Usage:
//   node tools/import-underwriting-pdf.js [--dir data/underwriting]
//
// 概要:
//   data/underwriting/ フォルダ内の PDF ファイルを読み込み、
//   public/fk-omiya-console.html 内の UW_DATA を更新する。
//
// ⚠️  data/underwriting/ は .gitignore 対象です。
//     社外秘の査定基準 PDF をコミットしないでください。
//
// PDF解析には pdf-parse または pdf2json を使用:
//   npm install pdf-parse --save-dev

const fs = require('node:fs');
const path = require('node:path');

const UW_DIR = path.resolve(__dirname, '..', 'data', 'underwriting');
const HTML_PATH = path.resolve(__dirname, '..', 'public', 'fk-omiya-console.html');

function main() {
  console.log('[import-underwriting-pdf] start');
  console.log(`[import-underwriting-pdf] scanning: ${UW_DIR}`);

  if (!fs.existsSync(UW_DIR)) {
    console.error('[import-underwriting-pdf] data/underwriting/ not found. Create the directory and place PDF files.');
    process.exit(1);
  }

  const pdfs = fs.readdirSync(UW_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) {
    console.log('[import-underwriting-pdf] no PDF files found in data/underwriting/');
    console.log('  Place <company-name>.pdf files here and re-run.');
    return;
  }

  console.log(`[import-underwriting-pdf] found ${pdfs.length} PDF(s): ${pdfs.join(', ')}`);

  // PDF解析ライブラリ確認
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch (_) {
    console.error('[import-underwriting-pdf] pdf-parse is not installed.');
    console.error('  Run: npm install pdf-parse --save-dev');
    process.exit(1);
  }

  // 各 PDF を解析して UW エントリを抽出
  const newEntries = [];
  for (const pdf of pdfs) {
    const pdfPath = path.join(UW_DIR, pdf);
    const company = path.basename(pdf, '.pdf');
    console.log(`[import-underwriting-pdf] parsing: ${pdf}`);

    try {
      const buf = fs.readFileSync(pdfPath);
      // 非同期処理は簡略化のため同期的に扱う（実際はPromise.all推奨）
      console.log(`  → ${company}: PDF loaded (${(buf.length / 1024).toFixed(1)} KB)`);
      console.log(`  → TODO: implement disease/criteria extraction for ${company}`);
      // 実装例:
      // const data = await pdfParse(buf);
      // const lines = data.text.split('\n');
      // lines.forEach(line => { ... parse disease/criteria from line ... });
    } catch (err) {
      console.warn(`  [WARN] failed to read ${pdf}: ${err.message}`);
    }
  }

  if (newEntries.length === 0) {
    console.log('[import-underwriting-pdf] no new entries extracted. UW_DATA not updated.');
    return;
  }

  // UW_DATA を更新
  console.log(`[import-underwriting-pdf] ${newEntries.length} entries to add/update`);
  // TODO: merge newEntries into HTML's UW_DATA array
  console.log('[import-underwriting-pdf] done');
}

main();
