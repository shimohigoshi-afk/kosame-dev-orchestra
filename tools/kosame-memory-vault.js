#!/usr/bin/env node
'use strict';

// KOSAME Memory Vault — long-term chat memory (RAG search + explicit
// memory.json facts) and API cost tracking for the casual-chat LLM router.
//
// Responsibilities:
//  1. RAG-style search over the FULL chat-history.jsonl to inject relevant
//     past exchanges into the system prompt, beyond the recent-N window
//     kosame-chat-history.js already injects (which stays unchanged).
//  2. Long-term fact memory (memory.json, shared with kosame-memory.js):
//     explicit "〇〇を覚えて/忘れて/記憶を確認" commands, periodic automatic
//     extraction from recent exchanges, and consolidation once entries grow
//     past a cap.
//  3. Per-call API cost tracking (.kosame-state/api-usage.jsonl) with a
//     monthly budget check ("今月のAPI代").
//
// Deliberately has NO dependency on kosame-chat-llm-router.js (which depends
// on this file) to avoid a circular require; the light-model calls used for
// memory extraction are made directly here with a minimal, non-streaming
// fetch, independent of the router's candidate chain.

const fs = require('node:fs');
const path = require('node:path');
const { loadMemory, MEMORY_FILE } = require('./kosame-memory');
const { loadChatHistory } = require('./kosame-chat-history');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.kosame-state');
const API_USAGE_FILE = path.join(STATE_DIR, 'api-usage.jsonl');
const PENDING_FORGET_FILE = path.join(STATE_DIR, 'memory-pending-forget.json');
const CHAT_MODEL_CONFIG_PATH = path.join(STATE_DIR, 'chat-model-config.json');

const MEMORY_CONSOLIDATE_THRESHOLD = 100;
const MEMORY_CONSOLIDATE_KEEP_RECENT = 80;
const MEMORY_AUTO_EXTRACT_EVERY = 10; // ユーザー発言10件(≒10往復)ごと
const FORGET_CONFIRM_TTL_MS = 10 * 60 * 1000; // 確認の有効期限: 10分

const RAG_MAX_HITS = 5;
const RAG_TOKEN_BUDGET = 3000;
const RAG_CONTEXT_WINDOW = 1; // ヒット前後1往復ずつ(=最大3往復ぶんの文脈)

const USD_TO_JPY = 150;
const DEFAULT_MONTHLY_BUDGET_JPY = 3000;

// 概算単価(USD / 1M tokens)。正確な請求額ではなく「今月のAPI代」の目安表示用。
const PRICING_TABLE = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 5.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
};

function _ensureDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

// ざっくりトークン推定(日本語混在を想定し文字数/1.8)。課金額そのものは
// プロバイダのusageフィールドから記録するので、ここは文脈注入の予算管理
// (RAG_TOKEN_BUDGET)にのみ使う近似値。
function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 1.8);
}

// ── キーワード抽出(簡易) ────────────────────────────────────────────────
// 形態素解析器を使わず、記号/主要助詞で分割するヒューリスティック。完璧な
// 分かち書きにはならないが、RAG検索のスコアリングには十分機能する。
const STOPWORDS = new Set([
  'です', 'ます', 'ください', 'お願いします', 'おねがいします', 'こと', 'もの', 'これ', 'それ', 'あれ',
  'ため', 'なので', 'けど', 'でも', 'という', 'として', 'たち', 'さん', 'ちゃん', 'くん', 'よう', 'よね',
  'ですか', 'ますか', 'した', 'する', 'ある', 'いる', 'なる', 'できる', 'かも', 'とても', 'すごく',
]);
const PARTICLE_SPLIT_RE = /(?:について|に関して|をお願いします|してください|お願いします|ください|でした|ですが|という|って|には|とは|から|まで|へと|でも|とも|を|は|が|に|の|で|と|も|へ|や|か)/;

function extractKeywords(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  const rough = t.split(/[\s、。！？!?,.\/\\()（）「」『』:：;；\-—~〜"'"'・\n]+/).filter(Boolean);
  const words = [];
  rough.forEach((tok) => {
    tok.split(PARTICLE_SPLIT_RE).forEach((p) => { if (p) words.push(p); });
  });
  const uniq = [...new Set(words)].filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  return uniq.slice(0, 12);
}

// ── RAG: chat-history.jsonl全体からキーワード関連度で過去会話を検索 ──────────
function loadAllChatHistory() {
  return loadChatHistory(Infinity);
}

// user→(直後の)assistant を1往復のペアとして並べる。相槌等でassistantが
// 続かない場合はuserのみのペアになる。
function _pairExchanges(entries) {
  const pairs = [];
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    if (e.role !== 'user') continue;
    const next = entries[i + 1];
    const reply = next && next.role === 'assistant' ? next : null;
    pairs.push({ user: e, assistant: reply, entries: reply ? [e, reply] : [e] });
  }
  return pairs;
}

function searchRelevantHistory(queryText, opts = {}) {
  const maxHits = opts.maxHits || RAG_MAX_HITS;
  const tokenBudget = opts.tokenBudget || RAG_TOKEN_BUDGET;

  const keywords = extractKeywords(queryText);
  if (!keywords.length) return { block: '', hitCount: 0, estimatedTokens: 0 };

  const all = loadAllChatHistory();
  if (!all.length) return { block: '', hitCount: 0, estimatedTokens: 0 };

  const pairs = _pairExchanges(all);
  const scored = pairs.map((pair, idx) => {
    const haystack = pair.entries.map((e) => e.content).join(' ');
    let score = 0;
    keywords.forEach((kw) => { if (haystack.includes(kw)) score += 1; });
    return { idx, pair, score };
  }).filter((s) => s.score > 0);

  if (!scored.length) return { block: '', hitCount: 0, estimatedTokens: 0 };

  // 関連度優先で候補を広めに取り、予算超過時の間引きは新しい順(idx降順)で行う。
  scored.sort((a, b) => b.score - a.score || b.idx - a.idx);
  const topCandidates = scored.slice(0, maxHits * 2);
  topCandidates.sort((a, b) => b.idx - a.idx);

  const chosen = [];
  const usedIdx = new Set();
  let totalTokens = 0;
  for (const cand of topCandidates) {
    if (chosen.length >= maxHits) break;
    if (usedIdx.has(cand.idx)) continue;
    const windowIdxs = [];
    for (let d = -RAG_CONTEXT_WINDOW; d <= RAG_CONTEXT_WINDOW; d += 1) {
      const wi = cand.idx + d;
      if (wi >= 0 && wi < pairs.length && !usedIdx.has(wi)) windowIdxs.push(wi);
    }
    const windowText = windowIdxs
      .map((wi) => pairs[wi].entries.map((e) => `${e.role === 'user' ? 'User' : 'こさめ'}: ${e.content.slice(0, 300)}`).join('\n'))
      .join('\n');
    const windowTokens = estimateTokens(windowText);
    if (totalTokens + windowTokens > tokenBudget && chosen.length > 0) continue;
    windowIdxs.forEach((wi) => usedIdx.add(wi));
    totalTokens += windowTokens;
    chosen.push({ idx: cand.idx, text: windowText });
  }

  if (!chosen.length) return { block: '', hitCount: 0, estimatedTokens: 0 };

  chosen.sort((a, b) => a.idx - b.idx); // 表示は時系列順(古い→新しい)
  const block = `【過去の関連会話（${chosen.length}件・キーワード: ${keywords.slice(0, 5).join('/')}）】\n${chosen.map((c) => c.text).join('\n---\n')}`;
  process.stderr.write(`[memory-vault] RAG hit=${chosen.length} estTokens=${totalTokens} keywords=${keywords.slice(0, 5).join(',')}\n`);
  return { block, hitCount: chosen.length, estimatedTokens: totalTokens };
}

// ── Memory Vault: memory.json のCRUD ────────────────────────────────────
function saveMemory(memory) {
  _ensureDir();
  const toSave = { ...memory, updated: new Date().toISOString() };
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  return toSave;
}

function listMemoryEntries() {
  const memory = loadMemory();
  return Array.isArray(memory.entries) ? memory.entries : [];
}

function addMemoryEntry(value, key) {
  const memory = loadMemory();
  const entries = Array.isArray(memory.entries) ? memory.entries.slice() : [];
  const entryKey = key || `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = { key: entryKey, value: String(value).trim(), createdAt: new Date().toISOString() };
  entries.push(entry);
  saveMemory({ ...memory, entries });
  consolidateMemoryIfNeeded();
  return entry;
}

function _findBestMatchIndex(entries, query) {
  const q = String(query || '').trim();
  if (!q) return -1;
  const kws = extractKeywords(q);
  let bestIdx = -1;
  let bestScore = 0;
  entries.forEach((e, idx) => {
    const hay = `${e.key || ''} ${e.value || ''}`;
    let score = 0;
    if (hay.includes(q)) score += 5;
    kws.forEach((kw) => { if (hay.includes(kw)) score += 1; });
    if (score > bestScore) { bestScore = score; bestIdx = idx; }
  });
  return bestScore > 0 ? bestIdx : -1;
}

function findMemoryEntry(query) {
  const entries = listMemoryEntries();
  const idx = _findBestMatchIndex(entries, query);
  return idx >= 0 ? { index: idx, entry: entries[idx] } : null;
}

function removeMemoryEntryAt(index) {
  const memory = loadMemory();
  const entries = Array.isArray(memory.entries) ? memory.entries.slice() : [];
  if (index < 0 || index >= entries.length) return null;
  const [removed] = entries.splice(index, 1);
  saveMemory({ ...memory, entries });
  return removed;
}

// 100件を超えたら古い分(直近80件を残して残りすべて)を1件の統合エントリに
// まとめる。要約はLLMを介さない単純な箇条書き結合(確実性・コストを優先)。
function consolidateMemoryIfNeeded() {
  const memory = loadMemory();
  const entries = Array.isArray(memory.entries) ? memory.entries : [];
  if (entries.length <= MEMORY_CONSOLIDATE_THRESHOLD) return false;
  const toConsolidate = entries.slice(0, entries.length - MEMORY_CONSOLIDATE_KEEP_RECENT);
  const toKeep = entries.slice(entries.length - MEMORY_CONSOLIDATE_KEEP_RECENT);
  const consolidatedValue = `【統合記憶（${toConsolidate.length}件をまとめました）】\n${toConsolidate.map((e) => `- ${e.value}`).join('\n')}`;
  const consolidatedEntry = {
    key: `consolidated_${Date.now()}`,
    value: consolidatedValue.slice(0, 4000),
    createdAt: new Date().toISOString(),
    consolidatedCount: toConsolidate.length,
  };
  saveMemory({ ...memory, entries: [consolidatedEntry, ...toKeep] });
  process.stderr.write(`[memory-vault] consolidated ${toConsolidate.length} old entries into 1\n`);
  return true;
}

// ── Memory自動抽出: ユーザー発言10件ごとに重要事項を軽量モデルで抽出 ────────
function _countUserMessages(entries) {
  return entries.filter((e) => e.role === 'user').length;
}

async function _callLightModelDirect(prompt, opts = {}) {
  const maxTokens = opts.maxTokens || 300;
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = 'gemini-2.5-flash';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 } }),
      });
      if (res.ok) {
        const data = await res.json();
        const cand = data.candidates && data.candidates[0];
        const text = cand && cand.content && cand.content.parts && cand.content.parts[0] ? cand.content.parts[0].text : null;
        const usage = data.usageMetadata || {};
        if (text) {
          recordApiUsage({ model, provider: 'gemini', inputTokens: usage.promptTokenCount || 0, outputTokens: usage.candidatesTokenCount || 0, purpose: 'memory-extraction' });
          return text.trim();
        }
      }
    } catch (_) { /* fall through to next provider */ }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.3 }),
      });
      if (res.ok) {
        const data = await res.json();
        const choice = data.choices && data.choices[0];
        const text = choice && choice.message ? choice.message.content : null;
        const usage = data.usage || {};
        if (text) {
          recordApiUsage({ model, provider: 'openai', inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, purpose: 'memory-extraction' });
          return text.trim();
        }
      }
    } catch (_) { /* no more fallbacks: skip extraction silently */ }
  }
  return null;
}

async function maybeExtractMemory() {
  try {
    const memory = loadMemory();
    const lastCount = Number(memory.lastExtractedCount || 0);
    const all = loadAllChatHistory();
    const userCount = _countUserMessages(all);
    if (userCount < lastCount + MEMORY_AUTO_EXTRACT_EVERY) return false;

    const recentSlice = all.slice(-MEMORY_AUTO_EXTRACT_EVERY * 2);
    const convoText = recentSlice.map((e) => `${e.role === 'user' ? 'User' : 'こさめ'}: ${e.content.slice(0, 300)}`).join('\n');
    const prompt = `以下は最近のチャット履歴です。この中から今後の会話で覚えておくべき重要事項(決定事項・好み・約束・プロジェクトの状況)だけを、箇条書きで3件以内、日本語1行ずつで抽出してください。重要事項が無ければ「なし」とだけ出力してください。\n\n${convoText}`;
    const result = await _callLightModelDirect(prompt);

    if (result && !/^なし$/.test(result.trim())) {
      const bullets = result.split('\n').map((l) => l.replace(/^[-・*\s]+/, '').trim()).filter((l) => l && l !== 'なし');
      bullets.slice(0, 3).forEach((b) => addMemoryEntry(b, `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`));
    }
    const newLastCount = lastCount + Math.floor((userCount - lastCount) / MEMORY_AUTO_EXTRACT_EVERY) * MEMORY_AUTO_EXTRACT_EVERY;
    const memoryAfter = loadMemory();
    saveMemory({ ...memoryAfter, lastExtractedCount: newLastCount });
    return true;
  } catch (err) {
    process.stderr.write(`[memory-vault] maybeExtractMemory error: ${err.message}\n`);
    return false;
  }
}

// ── 「〇〇を忘れて」の確認待ち状態 ───────────────────────────────────────
function _loadPendingForget() {
  try {
    if (!fs.existsSync(PENDING_FORGET_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(PENDING_FORGET_FILE, 'utf8'));
    if (!raw || !raw.askedAt) return null;
    if (Date.now() - new Date(raw.askedAt).getTime() > FORGET_CONFIRM_TTL_MS) return null;
    return raw;
  } catch (_) { return null; }
}
function _savePendingForget(data) {
  _ensureDir();
  fs.writeFileSync(PENDING_FORGET_FILE, JSON.stringify(data), 'utf8');
}
function _clearPendingForget() {
  try { if (fs.existsSync(PENDING_FORGET_FILE)) fs.unlinkSync(PENDING_FORGET_FILE); } catch (_) {}
}

// ── チャットコマンド判定(記憶の確認/覚えて/忘れて、今月のAPI代) ────────────
// 「削除して」はTASK_VERB_RE(意図判定)にヒットしタスク扱いされてしまうため、
// 確認の返答は「はい/いいえ」のみを使う設計にしている。
const MEMORY_CHECK_RE = /^(記憶|メモリ)を?(確認|教えて|一覧|見せて|表示)/;
const MEMORY_REMEMBER_RE = /^(.+?)を覚えて[。！!]*$/;
const MEMORY_FORGET_RE = /^(.+?)を忘れて[。！!]*$/;
const FORGET_CONFIRM_YES_RE = /^はい[。！!]*$/;
const FORGET_CONFIRM_NO_RE = /^(いいえ|やめて|キャンセル)[。！!]*$/;
const API_COST_RE = /今月の(api代|API代|api費用|API費用|apiコスト|APIコスト|コスト|料金|費用)/i;

function handleMemoryOrCostCommand(userText) {
  const t = String(userText || '').trim();
  if (!t) return null;

  const pending = _loadPendingForget();
  if (pending && FORGET_CONFIRM_YES_RE.test(t)) {
    const removed = removeMemoryEntryAt(pending.index);
    _clearPendingForget();
    if (removed) return { handled: true, reply: `「${removed.value}」を記憶から削除しましたっ☂️` };
    return { handled: true, reply: 'その記憶はもう見つかりませんでした…別の変更で消えていたかもしれません。' };
  }
  if (pending && FORGET_CONFIRM_NO_RE.test(t)) {
    _clearPendingForget();
    return { handled: true, reply: '削除をやめて、そのまま覚えておきますねっ☂️' };
  }

  if (MEMORY_CHECK_RE.test(t)) {
    const entries = listMemoryEntries();
    if (!entries.length) return { handled: true, reply: '今のところ記憶している項目はまだありませんっ。' };
    const lines = entries.map((e, i) => `${i + 1}. ${e.value}`);
    return { handled: true, reply: `【記憶している項目（${entries.length}件）】\n${lines.join('\n')}` };
  }

  const rememberMatch = t.match(MEMORY_REMEMBER_RE);
  if (rememberMatch && rememberMatch[1]) {
    const value = rememberMatch[1].trim();
    addMemoryEntry(value);
    return { handled: true, reply: `「${value}」を覚えましたっ☂️これからはこれを踏まえてお話ししますねっ。` };
  }

  const forgetMatch = t.match(MEMORY_FORGET_RE);
  if (forgetMatch && forgetMatch[1]) {
    const query = forgetMatch[1].trim();
    const found = findMemoryEntry(query);
    if (!found) return { handled: true, reply: `「${query}」に一致する記憶が見つかりませんでした。` };
    _savePendingForget({ index: found.index, value: found.entry.value, askedAt: new Date().toISOString() });
    return { handled: true, reply: `「${found.entry.value}」を記憶から削除しますか？よろしければ「はい」とだけ送ってください。` };
  }

  if (API_COST_RE.test(t)) {
    return { handled: true, reply: formatUsageSummaryForChat(getMonthlyUsageSummary()) };
  }

  return null;
}

// ── APIコスト計測 ────────────────────────────────────────────────────────
function _yearMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function recordApiUsage({ model, provider, inputTokens = 0, outputTokens = 0, purpose = 'chat' }) {
  try {
    _ensureDir();
    const pricing = PRICING_TABLE[model] || { input: 0, output: 0 };
    const costUsd = (inputTokens / 1e6) * pricing.input + (outputTokens / 1e6) * pricing.output;
    const costJpy = costUsd * USD_TO_JPY;
    const line = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      model, provider: provider || null,
      inputTokens, outputTokens,
      costJpy: Math.round(costJpy * 100) / 100,
      purpose,
    })}\n`;
    fs.appendFileSync(API_USAGE_FILE, line, 'utf8');
  } catch (err) {
    process.stderr.write(`[memory-vault] recordApiUsage error: ${err.message}\n`);
  }
}

function _loadApiUsageEntries() {
  try {
    if (!fs.existsSync(API_USAGE_FILE)) return [];
    const raw = fs.readFileSync(API_USAGE_FILE, 'utf8');
    return raw.trim().split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (_) { return []; }
}

function getMonthlyUsageSummary(yearMonth) {
  const ym = yearMonth || _yearMonthKey();
  const entries = _loadApiUsageEntries().filter((e) => String(e.timestamp || '').startsWith(ym));
  const byModel = {};
  let totalJpy = 0;
  entries.forEach((e) => {
    const key = e.model || 'unknown';
    if (!byModel[key]) byModel[key] = { count: 0, inputTokens: 0, outputTokens: 0, costJpy: 0 };
    byModel[key].count += 1;
    byModel[key].inputTokens += e.inputTokens || 0;
    byModel[key].outputTokens += e.outputTokens || 0;
    byModel[key].costJpy += e.costJpy || 0;
    totalJpy += e.costJpy || 0;
  });
  return { yearMonth: ym, totalJpy: Math.round(totalJpy * 100) / 100, byModel, callCount: entries.length };
}

function getMonthlyBudgetLimitJpy() {
  try {
    const raw = fs.readFileSync(CHAT_MODEL_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const v = Number(parsed.monthlyBudgetJpy);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_MONTHLY_BUDGET_JPY;
  } catch (_) { return DEFAULT_MONTHLY_BUDGET_JPY; }
}

function isMonthlyBudgetExceeded() {
  const summary = getMonthlyUsageSummary();
  const limit = getMonthlyBudgetLimitJpy();
  return { exceeded: summary.totalJpy > limit, totalJpy: summary.totalJpy, limitJpy: limit };
}

function formatUsageSummaryForChat(summary) {
  if (!summary.callCount) return `今月（${summary.yearMonth}）はまだAPI利用の記録がありませんっ。`;
  const lines = Object.entries(summary.byModel).map(([model, v]) => `- ${model}: ${v.count}回 / 約${Math.round(v.costJpy)}円`);
  return `【今月（${summary.yearMonth}）のAPI代（概算）】\n合計: 約${Math.round(summary.totalJpy)}円\n${lines.join('\n')}`;
}

// ── コンソールのAPI COST METERパネル向けスナップショット ────────────────────
// 旧実装(kosame-cost-meter.js)は~/.kosame/task-vault/cost-ledger.jsonlを
// 集計元にしていたが、そこへの書き込み経路が存在せず常に$0.00になっていた
// (テストコードからしか呼ばれていなかった)。実際にLLM呼び出しごとに記録
// されているapi-usage.jsonlを共通の集計元にする。
// 「セッション」概念はapi-usage.jsonl側に無いため、本日分で近似する。
function _todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getCostMeterSnapshot() {
  const entries = _loadApiUsageEntries();
  const todayKey = _todayKey();
  const monthKey = _yearMonthKey();

  function aggregate(filterFn) {
    const byModel = {};
    let usd = 0;
    let jpy = 0;
    entries.filter(filterFn).forEach((e) => {
      const pricing = PRICING_TABLE[e.model] || { input: 0, output: 0 };
      const costUsd = (e.inputTokens / 1e6) * (pricing.input || 0) + (e.outputTokens / 1e6) * (pricing.output || 0);
      usd += costUsd;
      jpy += e.costJpy || 0;
      const key = e.model || 'unknown';
      if (!byModel[key]) byModel[key] = { model: key, provider: e.provider || 'unknown', callCount: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, costJpy: 0, lastUsedAt: null };
      const m = byModel[key];
      m.callCount += 1;
      m.inputTokens += e.inputTokens || 0;
      m.outputTokens += e.outputTokens || 0;
      m.costUsd += costUsd;
      m.costJpy += e.costJpy || 0;
      if (!m.lastUsedAt || (e.timestamp && e.timestamp > m.lastUsedAt)) m.lastUsedAt = e.timestamp;
    });
    return { usd, jpy, byModel };
  }

  const monthAgg = aggregate((e) => String(e.timestamp || '').startsWith(monthKey));
  const todayAgg = aggregate((e) => String(e.timestamp || '').startsWith(todayKey));

  const byProvider = {};
  Object.values(monthAgg.byModel).forEach((m) => {
    const key = m.provider || 'unknown';
    if (!byProvider[key]) byProvider[key] = { provider: key, callCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, estimatedCostJpy: 0, lastUsedAt: null };
    const p = byProvider[key];
    p.callCount += m.callCount;
    p.inputTokens += m.inputTokens;
    p.outputTokens += m.outputTokens;
    p.totalTokens += m.inputTokens + m.outputTokens;
    p.estimatedCostUsd += m.costUsd;
    p.estimatedCostJpy += m.costJpy;
    if (!p.lastUsedAt || (m.lastUsedAt && m.lastUsedAt > p.lastUsedAt)) p.lastUsedAt = m.lastUsedAt;
  });

  const byModel = Object.values(monthAgg.byModel).map((m) => ({
    model: m.model,
    provider: m.provider,
    callCount: m.callCount,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
    totalTokens: m.inputTokens + m.outputTokens,
    estimatedCostUsd: m.costUsd,
    estimatedCostJpy: m.costJpy,
    lastUsedAt: m.lastUsedAt,
    budgetTier: 'unknown',
    warning: false,
  }));

  const budget = isMonthlyBudgetExceeded();

  return {
    total: {
      sessionUsd: todayAgg.usd,
      sessionJpy: todayAgg.jpy,
      todayUsd: todayAgg.usd,
      todayJpy: todayAgg.jpy,
      monthUsd: monthAgg.usd,
      monthJpy: monthAgg.jpy,
      unknownCount: 0,
    },
    byProvider,
    byModel,
    highCostModelWarning: false,
    unknownUsageCount: 0,
    sessionBudgetOver: false,
    dailyBudgetOver: false,
    monthlyBudgetOver: budget.exceeded,
    warningCount: budget.exceeded ? 1 : 0,
    warnings: budget.exceeded ? [`月間予算(約${budget.limitJpy}円)を超過しています(概算 約${Math.round(budget.totalJpy)}円)。`] : [],
  };
}

module.exports = {
  estimateTokens,
  extractKeywords,
  searchRelevantHistory,
  addMemoryEntry,
  listMemoryEntries,
  findMemoryEntry,
  removeMemoryEntryAt,
  consolidateMemoryIfNeeded,
  maybeExtractMemory,
  handleMemoryOrCostCommand,
  recordApiUsage,
  getMonthlyUsageSummary,
  getMonthlyBudgetLimitJpy,
  isMonthlyBudgetExceeded,
  formatUsageSummaryForChat,
  getCostMeterSnapshot,
  PRICING_TABLE,
  USD_TO_JPY,
  DEFAULT_MONTHLY_BUDGET_JPY,
  API_USAGE_FILE,
  PENDING_FORGET_FILE,
  MEMORY_CONSOLIDATE_THRESHOLD,
  MEMORY_AUTO_EXTRACT_EVERY,
  RAG_MAX_HITS,
  RAG_TOKEN_BUDGET,
  _loadPendingForget,
};
