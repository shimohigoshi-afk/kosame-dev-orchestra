#!/usr/bin/env node
'use strict';

/**
 * Sales DX P0 Lite Rules v110.75.0
 *
 * 温度感仮判定・警戒ワード検出・コンプラ警告検出・「わかりました」解析。
 * 純JSのみ。AI不要。外部依存なし。
 *
 * 【制約】
 *   - 営業DX/transcriber/ANESTY Boardのキーワードは扱わない
 *   - Secret/API key/.env/credentialsは扱わない
 *   - 顧客情報は扱わない
 *   - 出力は参考情報。確定診断ではない。
 */

const TOOL_META = {
  version: '110.75.0',
  slug:    'sales-dx-p0-lite-rules',
};

// ── High temperature keywords ───────────────────────────────────────────────

const HIGH_KEYWORDS = [
  '申し込み', 'いつまでに', '具体的な数字', '手続き', '契約したい',
  '決めたい', 'お願いします', '入りたい', '申し込む',
];

const MID_KEYWORDS = [
  '他と比べて', '違いがわからなくて', '詳しく聞いて',
  '家族と相談', 'もう少し考えます', '検討します', 'どう思いますか',
];

const LOW_KEYWORDS = [
  '参考にします', '時期が来たら', 'また連絡します', '結構です',
  '間に合ってます', '大丈夫です', '今はいいです',
];

const GUARD_KEYWORDS = [
  '考えておきます', '主人に相談', '今は時期じゃない',
  '他にも聞いてます', 'ちょっと高い', '一旦持ち帰ります',
  '保険は間に合ってます',
];

const COMPARE_KEYWORDS = [
  '他社', 'A社', 'B社', '比較したい', 'と比べて', '比較検討',
];

const HESITATE_KEYWORDS = [
  'どっちがいい', '違いがわからなくて', 'もう少し詳しく',
  '家族と話してみます', 'もう少し考えます', '迷ってます',
];

const POSITIVE_KEYWORDS = [
  'いつまでに', '具体的な数字', '申し込み手続き',
  '説明してもらえますか', 'お願いします', '決めたい',
];

// ── Compliance warning keywords ─────────────────────────────────────────────

const COMPLIANCE_WORDS = [
  { word: '必ず',   category: '断定表現', severity: 'high' },
  { word: '絶対',   category: '断定表現', severity: 'high' },
  { word: '間違いない', category: '断定表現', severity: 'high' },
  { word: '確実',   category: '断定表現', severity: 'high' },
  { word: '一番',   category: '誇大表現', severity: 'medium' },
  { word: 'No.1',   category: '誇大表現', severity: 'medium' },
  { word: '最大',   category: '誇大表現', severity: 'medium' },
  { word: '最安',   category: '誇大表現', severity: 'medium' },
  { word: '入った方がいい', category: '誘導表現', severity: 'high' },
  { word: 'こっちが得',   category: '誘導表現', severity: 'high' },
  { word: '損しない', category: '保証表現', severity: 'high' },
  { word: '得する',   category: '保証表現', severity: 'high' },
  { word: 'お得',    category: '保証表現', severity: 'medium' },
  { word: '儲かる',  category: '保証表現', severity: 'high' },
];

// ── DANGER: patterns we MUST NOT match ──────────────────────────────────────
// These are forbidden in the entire module. No salesDX/transcriber/ANESTY.

const FORBIDDEN_PATTERNS = [
  { re: /営業DX|sales.?dx|transcriber/i, label: 'salesDX/transcriber' },
  { re: /ANESTY\s*Board|anesty[_-]?board/i, label: 'ANESTY Board' },
  { re: /api[_-]?key|sk-[A-Za-z0-9]|bot[_-]?token|secret|credential|\.env/i, label: 'secret' },
  { re: /顧客情報|個人情報|customer.?data|pii/i, label: 'customer data' },
];

// ── Public functions ────────────────────────────────────────────────────────

function countOccurrences(text, keyword) {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(keyword, idx)) !== -1) {
    count++;
    idx += keyword.length;
  }
  return count;
}

function calcTemperature(text) {
  let score = 0;
  const matched = { high: [], mid: [], low: [], guard: [], compare: [] };

  for (const kw of HIGH_KEYWORDS) {
    if (text.includes(kw)) { score += 2; matched.high.push(kw); }
  }
  for (const kw of MID_KEYWORDS) {
    if (text.includes(kw)) { score += 1; matched.mid.push(kw); }
  }
  for (const kw of LOW_KEYWORDS) {
    if (text.includes(kw)) { score -= 1; matched.low.push(kw); }
  }
  for (const kw of GUARD_KEYWORDS) {
    if (text.includes(kw)) { score -= 2; matched.guard.push(kw); }
  }
  for (const kw of COMPARE_KEYWORDS) {
    if (text.includes(kw)) { matched.compare.push(kw); }
  }

  const isComparing  = matched.compare.length > 0;
  const hasPositive  = matched.high.length > 0;
  const hasGuard     = matched.guard.length > 0;
  const hasLow       = matched.low.length > 0;
  const hasMid       = matched.mid.length > 0;
  const hasAnySignal = hasPositive || hasGuard || hasLow || hasMid || isComparing;
  const isMixed      = hasPositive && (hasGuard || hasLow);

  let level, label, emoji;

  if (!hasAnySignal) {
    level = 'info_low'; label = '情報不足'; emoji = '❓';
  } else if (isMixed && hasPositive && hasGuard && score >= 0) {
    level = 'high_caution'; label = '高温度_注意あり'; emoji = '🔥⚠';
  } else if (isMixed && hasPositive && (hasLow || matched.guard.length >= 2) && score >= -2) {
    level = 'medium_caution'; label = '中温度_警戒あり'; emoji = '⚡⚠';
  } else if (score >= 3) {
    level = 'high'; label = '高温度'; emoji = '🔥';
  } else if (score <= -3) {
    level = 'guard'; label = '警戒'; emoji = '🛡️';
  } else if (isComparing && score >= -2) {
    level = 'comparing'; label = '競合比較中'; emoji = '🔄';
  } else if (score >= 1) {
    level = 'medium'; label = '中温度'; emoji = '⚡';
  } else if (score <= -1) {
    level = 'low'; label = '低温度'; emoji = '❄️';
  } else {
    level = 'medium'; label = '中温度'; emoji = '⚡';
  }

  const reasons = [];
  if (matched.high.length)   reasons.push(`前向きワード: 「${matched.high.join('」「')}」`);
  if (matched.mid.length)    reasons.push(`検討ワード: 「${matched.mid.join('」「')}」`);
  if (matched.low.length)    reasons.push(`消極的ワード: 「${matched.low.join('」「')}」`);
  if (matched.guard.length)  reasons.push(`警戒ワード: 「${matched.guard.join('」「')}」`);
  if (isComparing)           reasons.push('競合比較を示唆する表現');

  const note = isMixed ? '前向き要素と警戒要素が混在しています。現場の雰囲気を踏まえて総合判断してください。' : '';

  const reason = reasons.length > 0
    ? reasons.join('。') + '。' + (note || '（参考）')
    : '特筆するワードは検出されませんでした（参考）';

  return { level, label, emoji, reason, isReference: true, score, isMixed };
}

function detectAlertWords(text) {
  const guard = [];
  const hesitate = [];
  const positive = [];

  for (const kw of GUARD_KEYWORDS) {
    const count = countOccurrences(text, kw);
    if (count > 0) guard.push({ word: kw, count, category: '警戒' });
  }
  for (const kw of HESITATE_KEYWORDS) {
    const count = countOccurrences(text, kw);
    if (count > 0) hesitate.push({ word: kw, count, category: '迷い' });
  }
  for (const kw of POSITIVE_KEYWORDS) {
    const count = countOccurrences(text, kw);
    if (count > 0) positive.push({ word: kw, count, category: '前向き' });
  }

  const wakamamaCount = countOccurrences(text, 'わかりました');
  const wakamamaNote = wakamamaCount === 0 ? ''
    : wakamamaCount >= 5 ? `「わかりました」が${wakamamaCount}回とやや多めです。確認不足や早く終わらせたい印象の可能性があります（参考）`
    : `「わかりました」が${wakamamaCount}回出現しました（参考）`;

  const summaries = [];
  if (guard.length) summaries.push(`警戒ワード${guard.length}件`);
  if (hesitate.length) summaries.push(`迷いワード${hesitate.length}件`);
  if (positive.length) summaries.push(`前向きワード${positive.length}件`);
  const summary = summaries.length > 0
    ? `${summaries.join('、')}が検出されました（参考）`
    : '特筆するワードは検出されませんでした（参考）';

  return { guard, hesitate, positive, wakamamaCount, wakamamaNote, summary };
}

function detectCompliance(text) {
  const warnings = [];
  for (const cw of COMPLIANCE_WORDS) {
    if (text.includes(cw.word)) {
      warnings.push({ word: cw.word, category: cw.category, severity: cw.severity });
    }
  }
  const note = warnings.length > 0
    ? 'コンプラ注意表現が検出されました。最終確認は人間が行ってください。'
    : 'コンプラ注意表現は検出されませんでした。ただし最終確認は人間が行ってください。';
  return { warnings, note };
}

function detectForbiddenContent(text) {
  for (const fp of FORBIDDEN_PATTERNS) {
    if (fp.re.test(text)) {
      return { blocked: true, reason: `[${fp.label}] Detected in input text` };
    }
  }
  return { blocked: false };
}

function analyzeAll(text) {
  const forbidden = detectForbiddenContent(text);
  if (forbidden.blocked) {
    return {
      temperature: { level: 'blocked', label: 'BLOCKED', emoji: '✗', reason: forbidden.reason, isReference: true },
      alertWords: { guard: [], hesitate: [], positive: [], wakamamaCount: 0, wakamamaNote: '', summary: '' },
      compliance: { warnings: [], note: '' },
      blocked: true,
      blockedReason: forbidden.reason,
    };
  }

  return {
    temperature: calcTemperature(text),
    alertWords: detectAlertWords(text),
    compliance: detectCompliance(text),
    blocked: false,
    blockedReason: null,
  };
}

module.exports = {
  TOOL_META,
  calcTemperature,
  detectAlertWords,
  detectCompliance,
  detectForbiddenContent,
  analyzeAll,
};
