#!/usr/bin/env node
'use strict';

// 医務査定基準 PDF 取り込みツール
//
// Usage:
//   node tools/import-underwriting-pdf.js "保険会社名" path/to/file.pdf
//   node tools/import-underwriting-pdf.js "保険会社名" path/to/dir/  (複数PDF一括)
//
// 出力: data/underwriting/<timestamp>-<company>.json
//   → fk-omiya-console.html の UW_DATA フォーマットで保存
//
// ⚠️  data/underwriting/ は .gitignore 対象。社外秘データは絶対にコミットしない。
//
// 依存: npm install pdf-parse --save-dev

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const UW_DIR = path.resolve(ROOT, 'data', 'underwriting');

// 月フォーマット (YYYY-MM)
const TODAY = new Date().toISOString().slice(0, 7);

// 引受判定キーワードマッピング
const CRITERIA_MAP = [
  { criteria: 'accept',     label: '引受可',    patterns: ['引受可', '標準体', '標準引受', 'スタンダード', '通常引受', '可能', '引受け可', '○'] },
  { criteria: 'conditional', label: '条件付き', patterns: ['条件付', '条件付き', '割増保険料', 'E付', 'D付', 'C付', 'B付', '特別条件', '割増', '条件'] },
  { criteria: 'exclusion',  label: '部位不担保', patterns: ['不担保', '部位不担保', '特定部位', '免責', '特定疾病不担保', '除外'] },
  { criteria: 'reject',     label: '謝絶',      patterns: ['謝絶', '不可', '引受不可', '引き受け不可', '断', 'NG', '×', '謝絶対象'] },
];

// テキストから引受判定を推定
function detectCriteria(text) {
  const t = text.trim();
  for (const { criteria, label, patterns } of CRITERIA_MAP) {
    if (patterns.some(p => t.includes(p))) {
      return { criteria, criteriaLabel: label };
    }
  }
  return { criteria: 'conditional', criteriaLabel: '条件付き' };
}

// テキストブロックを UW エントリに変換
// 期待するフォーマット（各社 PDF の構造に応じて調整が必要）:
//   疾患名    引受判定    備考・条件
//   糖尿病    条件付き    HbA1c 7.0未満は割増保険料。7.0以上は謝絶。
function parseTextToEntries(text, company) {
  const entries = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 病名らしき行を検出（疾患名 + 判定キーワードの組み合わせ）
    const allKeywords = CRITERIA_MAP.flatMap(m => m.patterns);
    const hasJudgment = allKeywords.some(p => line.includes(p));

    // タブ区切り or 空白区切りで分割を試みる
    const tabParts = line.split(/\t+/);
    const spaceParts = line.split(/\s{2,}/);
    const parts = tabParts.length >= 2 ? tabParts : spaceParts.length >= 2 ? spaceParts : null;

    if (parts && parts.length >= 2) {
      const disease = parts[0].trim();
      const rest = parts.slice(1).join(' ').trim();
      const { criteria, criteriaLabel } = detectCriteria(rest);
      const notes = rest.replace(/[引受可条件付き謝絶不担保○×]/g, '').trim();

      if (disease.length >= 2 && disease.length <= 40) {
        entries.push({
          disease,
          company,
          criteria,
          criteriaLabel,
          notes: notes || rest,
          updated: TODAY,
        });
        i++;
        continue;
      }
    }

    // 単独行に判定キーワードがあり前行が病名っぽい場合
    if (hasJudgment && i > 0) {
      const prevLine = lines[i - 1];
      if (prevLine.length >= 2 && prevLine.length <= 40 && !allKeywords.some(p => prevLine.includes(p))) {
        const lastEntry = entries[entries.length - 1];
        if (!lastEntry || lastEntry.disease !== prevLine) {
          const { criteria, criteriaLabel } = detectCriteria(line);
          entries.push({
            disease: prevLine,
            company,
            criteria,
            criteriaLabel,
            notes: line,
            updated: TODAY,
          });
        }
      }
    }
    i++;
  }
  return entries;
}

async function processPdf(pdfParse, filePath, company) {
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  const entries = parseTextToEntries(data.text, company);
  console.log(`  → ${path.basename(filePath)}: ${data.numpages}ページ, ${entries.length}件抽出`);
  return entries;
}

function saveEntries(company, entries) {
  if (!fs.existsSync(UW_DIR)) fs.mkdirSync(UW_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = company.replace(/[/\\?%*:|"<>]/g, '_');
  const outPath = path.join(UW_DIR, `${ts}-${safeName}.json`);
  const out = {
    _source: `${company} 査定基準 PDF（自動抽出）`,
    _extractedAt: new Date().toISOString(),
    _company: company,
    _count: entries.length,
    entries,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
  return outPath;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node tools/import-underwriting-pdf.js "保険会社名" path/to/file.pdf');
    console.error('       node tools/import-underwriting-pdf.js "保険会社名" path/to/dir/');
    process.exit(1);
  }

  const company = args[0];
  const target = path.resolve(args[1]);

  if (!fs.existsSync(target)) {
    console.error(`[ERROR] Not found: ${target}`);
    process.exit(1);
  }

  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch (_) {
    console.error('[ERROR] pdf-parse is not installed.');
    console.error('  Run: npm install pdf-parse --save-dev');
    process.exit(1);
  }

  const stat = fs.statSync(target);
  let pdfFiles = [];

  if (stat.isDirectory()) {
    pdfFiles = fs.readdirSync(target)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(target, f));
    if (pdfFiles.length === 0) {
      console.log(`[WARN] No PDF files found in ${target}`);
      process.exit(0);
    }
  } else {
    pdfFiles = [target];
  }

  console.log(`[import-underwriting-pdf] 会社: ${company}`);
  console.log(`[import-underwriting-pdf] PDF: ${pdfFiles.length}件`);

  const allEntries = [];
  for (const f of pdfFiles) {
    try {
      const entries = await processPdf(pdfParse, f, company);
      allEntries.push(...entries);
    } catch (err) {
      console.warn(`  [WARN] ${path.basename(f)}: ${err.message}`);
    }
  }

  if (allEntries.length === 0) {
    console.log('[WARN] エントリが抽出できませんでした。PDFのテキストレイアウトを確認してください。');
    console.log('  parseTextToEntries() 関数の疾患名検出パターンを調整してください。');
    process.exit(0);
  }

  const outPath = saveEntries(company, allEntries);
  console.log(`\n✅ 完了: ${allEntries.length}件 → ${path.relative(ROOT, outPath)}`);
  console.log('\n--- サンプル出力 ---');
  allEntries.slice(0, 3).forEach(e => {
    console.log(`  [${e.criteriaLabel}] ${e.disease} — ${e.notes.slice(0, 60)}`);
  });
  console.log('\n次のステップ:');
  console.log(`  1. ${path.relative(ROOT, outPath)} を確認・編集`);
  console.log('  2. fk-omiya-console.html の UW_DATA に手動追記またはスクリプトでマージ');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
