#!/usr/bin/env node
'use strict';

/**
 * Sales DX P0 Lite Analyze Text v110.75.0
 *
 * テキスト入力 → 議事録下書き・温度感・警戒ワード・コンプラ・追客文を返す
 * dryRun/mock 解析処理。
 *
 * 【重要】
 *   - 初回は実API接続しない。callLLMはmock応答を返す。
 *   - DB保存しない。顧客情報保存しない。音声を扱わない。
 *   - 実送信しない。実課金しない。外部サービス接続しない。
 *
 * Usage:
 *   node tools/sales-dx-p0-lite-analyze-text.js --text="面談メモ" --caseName="案件名" --json
 */

const path = require('path');
const rules = require('./sales-dx-p0-lite-rules');

const TOOL_META = {
  version:       '110.75.0',
  feature:       'v110-75-sales-dx-p0-lite',
  slug:          'sales-dx-p0-lite-analyze-text',
  dryRunOnly:    true,
};

const STATUS = {
  safe:       'safe',
  caution:    'caution',
  blocked:    'blocked',
  human_gate: 'human_gate',
};

// ── Mock LLM (no real API call) ─────────────────────────────────────────────

function callLLM(text, temperature, alertWords) {
  const tempLabel = temperature.label || '中温度';
  const guardWords = (alertWords.guard || []).map(w => w.word);
  const hasGuard = guardWords.length > 0;

  let followupStyle;
  if (temperature.level === 'high') {
    followupStyle = 'アクティブ';
  } else if (temperature.level === 'guard' || temperature.level === 'low') {
    followupStyle = 'ライト';
  } else {
    followupStyle = '標準';
  }

  const caseSummary = text.length > 120 ? text.slice(0, 120) + '…' : text;

  const followupTemplates = {
    'アクティブ': `先日は具体的なご質問をいただき、ありがとうございました。前回の続きとして、改めてご提案をさせてください。ご都合のよろしい日時をお知らせいただけますと幸いです。`,
    '標準': `先日はいろいろとお話を伺い、ありがとうございました。追加で気になる点やご質問がございましたら、お気軽にご連絡ください。`,
    'ライト': `先日はお時間をいただき、ありがとうございました。何か気になる点がございましたら、いつでもお気軽にご連絡ください。`,
  };

  return {
    summary: `【面談内容】\n${caseSummary}\n\n【決定事項】\n（現時点では特になし）\n\n【保留事項】\n- ${hasGuard ? 'ご検討中の内容の確認' : '提案内容のご検討'}\n\n【次回TODO】\n- 提案内容のフォローアップ`,
    decisions: [],
    pendingItems: [{ text: hasGuard ? 'ご検討中の内容の確認' : '提案内容のご検討' }],
    nextTodos: [{ text: '提案内容のフォローアップ' }],
    followupDraft: `${followupTemplates[followupStyle]}\n\n---\n※ この追客文はAIが作成した下書きです。内容を確認し、必要に応じて修正してから送信してください。`,
  };
}

// ── Main analyzer ───────────────────────────────────────────────────────────

function analyzeText(request = {}) {
  const text      = String(request.text || '').trim();
  const caseName  = String(request.caseName || '').trim();
  const dryRun    = request.dryRun !== false;

  // Empty input check
  if (!text) {
    return {
      ok: false,
      error: 'text is required',
      code: 'EMPTY_INPUT',
      dryRun,
      saved: false,
      sent: false,
      charged: false,
      externalApiCalled: false,
      humanGateRequired: false,
      humanGateNote: '入力が空です。面談メモを入力してください。',
    };
  }

  // Forbidden content check (salesDX/transcriber/ANESTY/Secret/customer data)
  const forbidden = rules.detectForbiddenContent(text);
  if (forbidden.blocked) {
    return {
      ok: false,
      error: forbidden.reason,
      code: 'FORBIDDEN_CONTENT',
      dryRun,
      saved: false,
      sent: false,
      charged: false,
      externalApiCalled: false,
      humanGateRequired: true,
      humanGateNote: '禁止された内容が含まれています。入力を見直してください。',
    };
  }

  // Rule-based analysis (pure JS, no AI)
  const ruleResult = rules.analyzeAll(text);

  // Mock AI call (no real API connection)
  const aiResult = callLLM(text, ruleResult.temperature, ruleResult.alertWords);

  return {
    ok: true,
    dryRun,
    saved: false,
    sent: false,
    charged: false,
    externalApiCalled: false,
    humanGateRequired: true,
    humanGateNote: '出力は下書きです。最終確認は人間が行ってください。',
    caseName,
    transcript: {
      summary: aiResult.summary,
      decisions: aiResult.decisions,
      pendingItems: aiResult.pendingItems,
      nextTodos: aiResult.nextTodos,
    },
    temperature: ruleResult.temperature,
    alertWords: ruleResult.alertWords,
    compliance: ruleResult.compliance,
    followupDraft: aiResult.followupDraft,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', gray: '\x1b[90m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

function printResult(result) {
  if (!result.ok) {
    console.log(`\n${c('red', `✗ ${result.error}`)}`);
    console.log(`  dryRun: ${result.dryRun}  saved: ${result.saved}  sent: ${result.sent}  charged: ${result.charged}`);
    return;
  }

  const t = result.temperature;
  const tColor = t.level === 'high' ? 'green' : t.level === 'guard' || t.level === 'low' ? 'red' : 'yellow';

  console.log(`\n${c('bold', c('blue', '╡ Sales DX P0 Lite Analyzer'))}  ${c('cyan', `v${TOOL_META.version}`)}`);
  console.log(`  ${c('bold', 'Case:')} ${c('cyan', result.caseName || '(未設定)')}`);
  console.log(`  ${c('bold', 'Temperature:')} ${c(tColor, `${t.emoji} ${t.label}`)} ${c('gray', '(参考)')}`);
  console.log(`  ${c('dim', t.reason)}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  console.log(`\n  ${c('bold', 'Transcript (draft)')}`);
  console.log(`  ${result.transcript.summary.replace(/\n/g, '\n  ')}`);

  if (result.alertWords.guard.length || result.alertWords.hesitate.length || result.alertWords.positive.length) {
    console.log(`\n  ${c('bold', 'Alert Words')}`);
    for (const w of result.alertWords.guard)   console.log(`    ${c('red', '⚠')} ${w.word} (${w.category})`);
    for (const w of result.alertWords.hesitate) console.log(`    ${c('yellow', '⚠')} ${w.word} (${w.category})`);
    for (const w of result.alertWords.positive) console.log(`    ${c('green', '✓')} ${w.word} (${w.category})`);
    if (result.alertWords.wakamamaNote) console.log(`    ${c('gray', result.alertWords.wakamamaNote)}`);
  }

  if (result.compliance.warnings.length) {
    console.log(`\n  ${c('bold', 'Compliance Warnings')}`);
    for (const w of result.compliance.warnings) {
      const sevColor = w.severity === 'high' ? 'red' : 'yellow';
      console.log(`    ${c(sevColor, '⚠')} "${w.word}" — ${w.category} (${w.severity})`);
    }
    console.log(`    ${c('gray', result.compliance.note)}`);
  }

  console.log(`\n  ${c('bold', 'Followup Draft')}`);
  console.log(`  ${result.followupDraft.replace(/\n/g, '\n  ')}`);

  console.log(`\n  ${c('gray', '─'.repeat(64))}`);
  console.log(`  ${c('bold', 'Gate')}: ${c('yellow', 'HUMAN GATE')}  ${c('dim', result.humanGateNote)}`);
  console.log(`  dryRun: ${c('green', String(result.dryRun))}  saved: ${c('green', String(result.saved))}  sent: ${c('green', String(result.sent))}  charged: ${c('green', String(result.charged))}  externalApi: ${c('green', String(result.externalApiCalled))}`);
  console.log('');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => {
    const eq = `--${name}=`;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === eq) return '';
      if (args[i].startsWith(eq)) return args[i].slice(eq.length);
    }
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
    return null;
  };
  return {
    text:      get('text') || '',
    caseName:  get('caseName') || get('case-name') || '',
    json:      args.includes('--json'),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  const result = analyzeText({ text: cliArgs.text, caseName: cliArgs.caseName });
  if (cliArgs.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }
}

module.exports = {
  TOOL_META,
  STATUS,
  analyzeText,
};
