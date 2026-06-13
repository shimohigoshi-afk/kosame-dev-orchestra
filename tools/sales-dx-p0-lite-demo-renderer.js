#!/usr/bin/env node
'use strict';

/**
 * Sales DX P0 Lite Demo Renderer v110.76.0
 *
 * analyzeText のJSON結果を、人間が見やすいMarkdown風デモ表示に整形する。
 * Web UIではない。CLI上でβ候補者が読める形にする。
 *
 * Usage:
 *   node tools/sales-dx-p0-lite-demo-renderer.js --fixture notta
 *   node tools/sales-dx-p0-lite-analyze-text.js --text "..." --demo
 */

const analyzer = require('./sales-dx-p0-lite-analyze-text');

const TOOL_META = {
  version:       '110.76.0',
  slug:          'sales-dx-p0-lite-demo-renderer',
  dryRunOnly:    true,
};

const FIXTURES = {
  high: () => analyzer.analyzeText({
    text: '鈴木さん。いつまでに決めればいいですか？申し込み手続きを教えてください。お願いします。',
    caseName: '高温度サンプル',
  }),
  guard: () => analyzer.analyzeText({
    text: '田中さん。考えておきます。また連絡します。他にも聞いてます。保険は間に合ってます。わかりました。わかりました。わかりました。わかりました。わかりました。',
    caseName: '警戒サンプル',
  }),
  comparing: () => analyzer.analyzeText({
    text: '佐藤さん。A社とB社の違いがわからなくて。家族と話してみます。',
    caseName: '競合比較サンプル',
  }),
  compliance: () => analyzer.analyzeText({
    text: 'この商品は絶対にお得です。必ず入った方がいいです。一番人気です。',
    caseName: 'コンプラ警告サンプル',
  }),
  notta: () => analyzer.analyzeText({
    text: '投資型保険の提案をした。少額から始められることには興味を示していた。「検討します」と言っていた。ただ、「為替リスクが心配」「ちょっと高い」「考えておきます」と警戒もあった。「もう少し考えます」と迷いも見られた。資料を確認して次回面談で判断したいとのこと。わかりました、と何度か言っていた。',
    caseName: '投資商品説明',
  }),
};

const STATUS_COLORS = {
  high:          'GREEN',
  high_caution:  'YELLOW',
  medium:        'YELLOW',
  medium_caution:'YELLOW',
  low:           'RED',
  guard:         'RED',
  comparing:     'YELLOW',
  info_low:      'GRAY',
};

function colorize(level, text) {
  const color = STATUS_COLORS[level] || 'GRAY';
  const codes = { GREEN: '\x1b[32m', YELLOW: '\x1b[33m', RED: '\x1b[31m', GRAY: '\x1b[90m', BOLD: '\x1b[1m', CYAN: '\x1b[36m', RESET: '\x1b[0m' };
  return `${codes[color] || ''}${text}${codes.RESET}`;
}

// ── Render function ─────────────────────────────────────────────────────────

function render(result) {
  const lines = [];

  const hr = '─'.repeat(60);

  lines.push('');
  lines.push(`# 営業DX P0 Lite デモ出力${result.caseName ? ` — ${result.caseName}` : ''}`);
  lines.push('');
  lines.push(hr);
  lines.push('');

  // 1. Temperature
  const t = result.temperature;
  const tColor = STATUS_COLORS[t.level] || 'GRAY';
  lines.push(`## 温度感`);
  lines.push('');
  lines.push(`${t.emoji} **${t.label}**`);
  lines.push('');
  lines.push(`> ${colorize(t.level, 'この判定は参考情報です。面談の雰囲気を踏まえて総合判断してください。')}`);
  lines.push('');
  if (t.reason) {
    const parts = t.reason.split(/[。.．]+/).filter(Boolean);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed) lines.push(`* ${trimmed}`);
    }
    lines.push('');
  }

  // 2. Alert words
  const aw = result.alertWords;
  const hasAlert = aw.guard.length > 0 || aw.hesitate.length > 0 || aw.positive.length > 0;
  if (hasAlert) {
    lines.push(`## 警戒・迷いワード`);
    lines.push('');
    if (aw.guard.length) {
      lines.push('**警戒がうかがえる発言:**');
      for (const w of aw.guard) lines.push(`* ${w.word}`);
      lines.push('');
    }
    if (aw.hesitate.length) {
      lines.push('**迷い・検討中の発言:**');
      for (const w of aw.hesitate) lines.push(`* ${w.word}`);
      lines.push('');
    }
    if (aw.positive.length) {
      lines.push('**前向きな発言:**');
      for (const w of aw.positive) lines.push(`* ${w.word}`);
      lines.push('');
    }
    if (aw.wakamamaNote) {
      lines.push(`**「わかりました」に注目:**`);
      lines.push(`* ${aw.wakamamaNote}`);
      lines.push('');
    }
  }

  // 3. Compliance
  lines.push(`## コンプラチェック（参考）`);
  lines.push('');
  if (result.compliance.warnings.length > 0) {
    lines.push(`気になる表現が検出されました。最終確認は人間が行ってください。`);
    for (const w of result.compliance.warnings) {
      lines.push(`* 「${w.word}」（${w.category}）`);
    }
  } else {
    lines.push('今回の簡易チェックでは、特に気になる表現は検出されませんでした。');
  }
  lines.push('');
  lines.push(`> ${result.compliance.note || ''}`);
  lines.push('');

  // 4. Transcript / TODO / Pending
  lines.push(`## 議事録下書き`);
  lines.push('');
  if (result.transcript.summary) {
    const summaryLines = result.transcript.summary.split('\n');
    for (const sl of summaryLines) {
      const trimmed = sl.trim();
      if (trimmed) lines.push(trimmed);
    }
    lines.push('');
  }

  if (result.transcript.nextTodos && result.transcript.nextTodos.length > 0) {
    lines.push('**次回対応TODO:**');
    for (const t of result.transcript.nextTodos) lines.push(`* ☐ ${t.text || t}`);
    lines.push('');
  }

  if (result.transcript.pendingItems && result.transcript.pendingItems.length > 0) {
    lines.push('**保留・確認事項:**');
    for (const p of result.transcript.pendingItems) lines.push(`* ${p.text || p}`);
    lines.push('');
  }

  // 5. Followup draft
  lines.push(`## 追客文下書き`);
  lines.push('');
  if (result.followupDraft) {
    const fLines = result.followupDraft.split('\n');
    for (const fl of fLines) {
      lines.push(`> ${fl}`);
    }
    lines.push('');
  }

  // 6. Human gate
  lines.push(`## Human Gate / 最終確認`);
  lines.push('');
  lines.push(`> ${colorize('medium', 'この出力はAIによる下書きです。')}`);
  lines.push(`> ${colorize('medium', 'お客様へ送信・保存・提案に使う前に、必ず人間が内容を確認してください。')}`);
  lines.push('');

  // 7. Dry run guarantee
  lines.push(`## Dry Run（動作モード）`);
  lines.push('');
  lines.push(`| 項目 | 状態 |`);
  lines.push(`|------|------|`);
  for (const [key, label] of [
    ['dryRun', 'Dry Run（実動作なし）'],
    ['saved', '保存'],
    ['sent', '送信'],
    ['charged', '課金'],
    ['externalApiCalled', '外部API接続'],
  ]) {
    const val = result[key];
    if (val !== undefined) {
      const display = val ? colorize('high', 'YES') : colorize('high', 'NO');
      lines.push(`| ${label} | ${display} |`);
    }
  }
  lines.push('');
  lines.push(hr);
  lines.push('');

  return lines.join('\n');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

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
    fixture: get('fixture') || '',
    demo:    args.includes('--demo'),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  let result;
  if (cliArgs.fixture && FIXTURES[cliArgs.fixture]) {
    result = FIXTURES[cliArgs.fixture]();
    console.log(`\n  (using fixture: ${cliArgs.fixture})`);
  } else {
    result = FIXTURES.notta();
    console.log(`\n  (using default fixture: notta)`);
  }
  console.log(render(result));
}

module.exports = {
  TOOL_META,
  FIXTURES,
  render,
};
