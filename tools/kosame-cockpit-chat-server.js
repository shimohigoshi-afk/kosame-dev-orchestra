#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PERSONA_PATH = path.join(__dirname, '..', 'config', 'kosame-cockpit-chat-persona.md');
const CHAT_EVENTS_PATH = path.join(os.homedir(), '.kosame', 'kosame-chat-events.jsonl');
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 800;
const DIRECT_MESSAGE_KEYS = ['message', 'text', 'input', 'prompt', 'content'];
const CONTEXT_KEYS = [
  'context',
  'contextSummary',
  'snapshotSummary',
  'consoleContextSummary',
  'stateContext',
  'confirmationContext',
];
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{12,}/i,
  /\b[A-Z0-9_]*API_KEY\b/i,
  /\b(?:OPENAI|GEMINI|ANTHROPIC|CLAUDE)[A-Z0-9_]*\b/i,
  /\bSECRET\b/i,
  /\bTOKEN\b/i,
  /\bPASSWORD\b/i,
  /\bCREDENTIALS\b/i,
  /\bAUTHORIZATION\b/i,
  /\bBEARER\b/i,
  /\.env\b/i,
];

function loadPersona() {
  try {
    return fs.readFileSync(PERSONA_PATH, 'utf8').trim();
  } catch {
    return 'あなたはこさめです。じゅんやさんの相談AIです。危険操作は止めてください。';
  }
}

function normalizeContent(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMessageBody(source) {
  const body = source && typeof source === 'object' ? source : {};
  const normalizedMessages = [];

  const pushMessage = (role, content) => {
    const text = normalizeContent(content);
    if (text) normalizedMessages.push({ role, content: text });
  };

  if (Array.isArray(body.messages)) {
    for (const message of body.messages) {
      if (typeof message === 'string') {
        pushMessage('user', message);
        continue;
      }
      if (!message || typeof message !== 'object') continue;
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      const content = message.content ?? message.text ?? message.message ?? message.input ?? message.prompt;
      pushMessage(role, content);
    }
  }

  if (!normalizedMessages.length) {
    for (const key of DIRECT_MESSAGE_KEYS) {
      const direct = normalizeContent(body[key]);
      if (direct) {
        normalizedMessages.push({ role: 'user', content: direct });
        break;
      }
    }
  }

  const contextValues = [];
  for (const key of CONTEXT_KEYS) {
    const candidate = normalizeContent(body[key]);
    if (candidate) contextValues.push(candidate);
  }

  return {
    messages: normalizedMessages,
    project: normalizeContent(body.project),
    context: normalizeContent(body.context).slice(0, MAX_CONTEXT_LENGTH),
    contextSummary: normalizeContent(body.contextSummary || body.snapshotSummary || body.consoleContextSummary || body.stateContext).slice(0, MAX_CONTEXT_LENGTH),
    confirmationContext: normalizeContent(body.confirmationContext),
    contextValues,
  };
}

function hasSecretLikeText(text) {
  const value = normalizeContent(text);
  if (!value) return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function isTooLong(text) {
  return normalizeContent(text).length > MAX_MESSAGE_LENGTH;
}

function truncate(text, maxLength = 120) {
  const value = normalizeContent(text);
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function buildContextDigest(contextText) {
  const value = normalizeContent(contextText);
  if (!value) return '';
  const parts = value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const preferredKeys = ['currentVersion=', 'activeRepo=', 'taskFeeder=', 'shellActivity=', 'confirmationBridge='];
  const selected = [];

  for (const key of preferredKeys) {
    const match = parts.find((part) => part.startsWith(key));
    if (match) selected.push(match);
  }

  if (!selected.length) {
    selected.push(...parts.slice(0, 3));
  }

  return selected.map((part) => truncate(part, 80)).join(' / ');
}

function parseSummarySignals(contextText) {
  const summary = normalizeContent(contextText);
  const lines = summary.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const signals = {
    version: '',
    mode: '',
    changed: null,
    staged: null,
    verifyPassCount: null,
    verifyCount: null,
    humanGateCount: null,
    shellVerifyingCount: null,
    shellRunningCount: null,
    selectedCount: null,
    blockedCount: null,
  };

  const getNumber = (text, key) => {
    const match = String(text || '').match(new RegExp(`${key}=([0-9]+)`));
    return match ? Number(match[1]) : null;
  };

  for (const line of lines) {
    if (!signals.version) {
      const versionMatch = line.match(/^KOSAME Console \/ version=([^/]+) \/ mode=([^/]+)/);
      if (versionMatch) {
        signals.version = normalizeContent(versionMatch[1]);
        signals.mode = normalizeContent(versionMatch[2]);
      }
    }

    if (!signals.version) {
      const currentVersionMatch = line.match(/^currentVersion=([^/]+)/);
      if (currentVersionMatch) {
        signals.version = normalizeContent(currentVersionMatch[1]);
      }
    }

    if (!signals.mode) {
      const modeMatch = line.match(/(?:^|[\/\s])mode=([^/]+)/);
      if (modeMatch) {
        signals.mode = normalizeContent(modeMatch[1]);
      }
    }

    if (signals.changed == null) {
      const changed = getNumber(line, 'changed');
      if (changed != null) signals.changed = changed;
    }

    if (signals.staged == null) {
      const staged = getNumber(line, 'staged');
      if (staged != null) signals.staged = staged;
    }

    if (signals.verifyPassCount == null && /agentEventFeed=/.test(line)) {
      const match = line.match(/VERIFY_PASS=([0-9]+)/);
      if (match) signals.verifyPassCount = Number(match[1]);
    }

    if (signals.verifyCount == null && /agentEventFeed=/.test(line)) {
      const match = line.match(/VERIFY=([0-9]+)/);
      if (match) signals.verifyCount = Number(match[1]);
    }

    if (signals.humanGateCount == null) {
      const match = line.match(/^humanGate=([0-9]+)/);
      if (match) signals.humanGateCount = Number(match[1]);
    }

    if (signals.shellVerifyingCount == null && /shellActivity=/.test(line)) {
      const match = line.match(/verifying=([0-9]+)/);
      if (match) signals.shellVerifyingCount = Number(match[1]);
    }

    if (signals.shellRunningCount == null && /shellActivity=/.test(line)) {
      const match = line.match(/running=([0-9]+)/);
      if (match) signals.shellRunningCount = Number(match[1]);
    }

    if (signals.selectedCount == null && /taskFeeder=/.test(line)) {
      const match = line.match(/selected=([0-9]+)/);
      if (match) signals.selectedCount = Number(match[1]);
    }

    if (signals.blockedCount == null && /taskFeeder=/.test(line)) {
      const match = line.match(/blocked=([0-9]+)/);
      if (match) signals.blockedCount = Number(match[1]);
    }
  }

  return signals;
}

function buildStatusReply(input, snapshotSummary) {
  const signals = parseSummarySignals(input.contextSummary || input.context || snapshotSummary);
  const segments = [];
  const versionLabel = signals.version ? `v${signals.version}` : 'いま';

  if (signals.version) {
    segments.push(`${versionLabel} の Chat API Bridge を確認中です。`);
  } else {
    segments.push('今の状況を確認中です。');
  }

  if (signals.mode && signals.mode.toLowerCase() === 'readonly') {
    segments.push('確認モードです。');
  }

  if (signals.changed != null) {
    segments.push(signals.changed > 0 ? `未コミットの変更が${signals.changed}件あります。` : '未コミットの変更はありません。');
  }

  if (signals.staged != null && signals.staged > 0) {
    segments.push(`ステージ済みの変更が${signals.staged}件あります。`);
  }

  if ((signals.verifyPassCount || 0) > 0) {
    segments.push('verify は通っています。');
  } else if ((signals.verifyCount || 0) > 0 || (signals.shellVerifyingCount || 0) > 0) {
    segments.push('verify は確認中です。');
  } else {
    segments.push('verify結果はまだ確認が必要です。');
  }

  if ((signals.humanGateCount || 0) > 0) {
    segments.push(`人間確認待ちは${signals.humanGateCount}件です。`);
  }

  segments.push('次は見た目を確認して、問題なければ正本化できます☂️');

  return {
    reply: segments.join(' '),
    suggested_action: 'KOSAME CHATの表示と返答を軽く確認する。',
  };
}

function buildNextActionReply(input, snapshotSummary) {
  const signals = parseSummarySignals(input.contextSummary || input.context || snapshotSummary);
  const versionLabel = signals.version ? `v${signals.version}` : 'いま';
  const parts = [];

  if (signals.changed != null && signals.changed > 0) {
    parts.push('まずは表示を軽く確認して、');
  }

  if ((signals.verifyPassCount || 0) > 0) {
    parts.push('verify は通っているので、');
  } else {
    parts.push('verify結果を目で確認して、');
  }

  parts.push(`${versionLabel} の Chat API Bridge をこのまま正本化へ進めるのがよさそうです。`);

  return {
    reply: parts.join(''),
    suggested_action: 'KOSAME CHATの表示と assistant bubble を確認する。',
  };
}

function buildSummaryReply(input, snapshotSummary) {
  const signals = parseSummarySignals(input.contextSummary || input.context || snapshotSummary);
  const parts = [];

  if (signals.version) {
    parts.push(`${signals.version} を確認中です。`);
  }

  if (signals.changed != null) {
    parts.push(signals.changed > 0 ? `変更は${signals.changed}件です。` : '変更はありません。');
  }

  if ((signals.verifyPassCount || 0) > 0) {
    parts.push('verify は通っています。');
  }

  if (!parts.length) {
    parts.push('作業内容を短く整理しています。');
  }

  return {
    reply: parts.join(' '),
    suggested_action: '要点を3つに絞って送る。',
  };
}

function buildGeneralReply(input) {
  const projectLabel = truncate(input.project, 40);
  return {
    reply: projectLabel
      ? `${projectLabel} の件、内容を受け取りました。短く整理して返しますね。`
      : '内容を受け取りました。短く整理して返しますね。',
    suggested_action: '目的・対象・制約を短く送る。',
  };
}

function detectIntent(message) {
  const text = normalizeContent(message);
  if (!text) return 'empty';
  if (/[次つぎ].*(なに|何)|次の一手|どう進め|next/i.test(text)) return 'next_action';
  if (/今の状況|現在地|進捗|状態|snapshot|activity|実行状況/i.test(text)) return 'status';
  if (/この方針で進める|この案で進める|進めてください/i.test(text)) return 'proceed';
  if (/要約|summary|まとめ/i.test(text)) return 'summary';
  return 'general';
}

function buildLocalReply(input, snapshotSummary) {
  const intent = detectIntent(input.message);
  const message = truncate(input.message, 80);

  if (intent === 'status') {
    return buildStatusReply(input, snapshotSummary);
  }

  if (intent === 'next_action') {
    return buildNextActionReply(input, snapshotSummary);
  }

  if (intent === 'proceed') {
    return {
      reply: '了解です。ではこの方針で進めます。',
      suggested_action: '必要なら確認待ちや危険ゲートを先に整理する。',
    };
  }

  if (intent === 'summary') {
    return buildSummaryReply(input, snapshotSummary);
  }

  return buildGeneralReply(input);
}

function safeEventText(text) {
  const value = normalizeContent(text);
  if (!value) return '';
  return truncate(value, 80);
}

function appendChatEvent(event) {
  try {
    fs.mkdirSync(path.dirname(CHAT_EVENTS_PATH), { recursive: true });
    const row = {
      timestamp: new Date().toISOString(),
      type: 'chat',
      project: safeEventText(event.project),
      intent: safeEventText(event.intent),
      message_length: Number(event.messageLength || 0),
      context_length: Number(event.contextLength || 0),
      reply_length: Number(event.replyLength || 0),
      human_gate_required: !!event.humanGateRequired,
      suggested_action: safeEventText(event.suggestedAction),
    };
    fs.appendFileSync(CHAT_EVENTS_PATH, `${JSON.stringify(row)}\n`, 'utf8');
  } catch {
    // Best-effort only. Chat must stay functional even when persistence fails.
  }
}

function normalizeChatRequest(body) {
  const source = body && typeof body === 'object' ? body : {};
  const normalized = normalizeMessageBody(source);
  const directMessage = normalizeContent(source.message);
  const message = directMessage || normalized.messages.find((item) => item.role === 'user')?.content || '';
  const context = normalized.context || normalized.contextSummary || normalized.confirmationContext || normalized.contextValues[0] || '';
  return {
    messages: normalized.messages,
    message,
    project: normalized.project,
    context,
    contextSummary: normalized.contextSummary || context,
    confirmationContext: normalized.confirmationContext,
    contextValues: normalized.contextValues,
  };
}

async function handleChatRequest(body) {
  const requestAt = new Date().toISOString();
  const normalized = normalizeChatRequest(body);
  const message = normalizeContent(normalized.message);
  const project = normalizeContent(normalized.project);
  const context = normalizeContent(normalized.context);
  const contextSummary = normalizeContent(normalized.contextSummary);
  const directText = [message, project].filter(Boolean).join(' ');

  if (!message) {
    return {
      ok: false,
      error: 'message を入力してください。',
      created_at: requestAt,
    };
  }

  if (hasSecretLikeText(directText)) {
    return {
      ok: false,
      error: 'secret っぽい文字列は受け取れません。',
      created_at: requestAt,
    };
  }

  if (isTooLong(message)) {
    return {
      ok: false,
      error: 'message が長すぎます。',
      created_at: requestAt,
    };
  }

  const replyPacket = buildLocalReply({
    message,
    project,
    context: context.slice(0, MAX_CONTEXT_LENGTH),
    contextSummary: contextSummary.slice(0, MAX_CONTEXT_LENGTH),
  }, contextSummary);

  const result = {
    ok: true,
    reply: replyPacket.reply,
    suggested_action: replyPacket.suggested_action,
    human_gate_required: false,
    created_at: requestAt,
  };

  appendChatEvent({
    project,
    intent: detectIntent(message),
    messageLength: message.length,
    contextLength: context.length || contextSummary.length || 0,
    replyLength: result.reply.length,
    humanGateRequired: result.human_gate_required,
    suggestedAction: result.suggested_action,
  });

  return result;
}

module.exports = {
  handleChatRequest,
  loadPersona,
  normalizeChatRequest,
  normalizeContent,
  buildLocalReply,
  detectIntent,
  appendChatEvent,
};
