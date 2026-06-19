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
const WORK_ORDER_TARGETS = [
  {
    label: 'Sales DX',
    repo: '/home/lavie/repos/transcriber',
    riskLevel: 'medium',
    hints: /sales dx|transcriber|営業dx/i,
  },
  {
    label: 'KOSAME Console',
    repo: '/home/lavie/kosame-dev-orchestra',
    riskLevel: 'low',
    hints: /kosame console|dev orchestra|kosame dev orchestra/i,
  },
];
const WORK_ORDER_REQUEST_PATTERNS = [
  /作業票.*(作って|作成|生成)/i,
  /work order/i,
  /codex.*(投げ|渡).*指示/i,
  /投げる指示を?作って/i,
  /次の作業票/i,
  /次の作業/i,
  /進めたい/i,
  /進めてください/i,
  /進めて/i,
  /この方針で進める/i,
  /この案で進める/i,
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

function decisionLabel(status) {
  return {
    ready_for_commit: 'commit候補',
    ready_for_review: '確認待ち',
    request_fix: '修正依頼',
    stop_and_investigate: '要調査',
    wait_for_result: '結果待ち',
  }[normalizeContent(status)] || normalizeContent(status);
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
    resultStatus: '',
    resultSmoke: '',
    resultVerify: '',
    resultNext: '',
    resultDecision: '',
    resultDecisionReason: '',
    resultDecisionHumanGate: '',
    resultDecisionCommit: '',
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

    if (/workOrderResult=/.test(line)) {
      if (!signals.resultStatus) {
        const statusMatch = line.match(/status=([^/]+)/);
        if (statusMatch) signals.resultStatus = normalizeContent(statusMatch[1]);
      }
      if (!signals.resultSmoke) {
        const smokeMatch = line.match(/smoke=([^/]+)/);
        if (smokeMatch) signals.resultSmoke = normalizeContent(smokeMatch[1]);
      }
      if (!signals.resultVerify) {
        const verifyMatch = line.match(/verify=([^/]+)/);
        if (verifyMatch) signals.resultVerify = normalizeContent(verifyMatch[1]);
      }
      if (!signals.resultNext) {
        const nextMatch = line.match(/next=([^/]+)/);
        if (nextMatch) signals.resultNext = normalizeContent(nextMatch[1]);
      }
    }

    if (/workOrderDecision=/.test(line)) {
      if (!signals.resultDecision) {
        const match = line.match(/(?:decision_status|status)=([^/]+)/);
        if (match) signals.resultDecision = normalizeContent(match[1]);
      }
      if (!signals.resultNext) {
        const nextMatch = line.match(/next=([^/]+)/);
        if (nextMatch) signals.resultNext = normalizeContent(nextMatch[1]);
      }
      if (!signals.resultDecisionReason) {
        const reasonMatch = line.match(/reason=([^/]+)/);
        if (reasonMatch) signals.resultDecisionReason = normalizeContent(reasonMatch[1]);
      }
      if (!signals.resultDecisionHumanGate) {
        const gateMatch = line.match(/humanGate=([^/]+)/);
        if (gateMatch) signals.resultDecisionHumanGate = normalizeContent(gateMatch[1]);
      }
      if (!signals.resultDecisionCommit) {
        const commitMatch = line.match(/commitTagPush=([^/]+)/);
        if (commitMatch) signals.resultDecisionCommit = normalizeContent(commitMatch[1]);
      }
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

  if (signals.resultStatus || signals.resultDecision) {
    segments.push(`結果判定は${decisionLabel(signals.resultDecision || signals.resultStatus)}です。`);
    if (signals.resultSmoke || signals.resultVerify) {
      segments.push(`smoke は ${signals.resultSmoke || 'unknown'}、verify は ${signals.resultVerify || 'unknown'} です。`);
    }
    if (signals.resultNext) {
      segments.push(`次の判断は ${signals.resultNext} です。`);
    }
    if (signals.resultDecisionReason) {
      segments.push(`理由は ${signals.resultDecisionReason} です。`);
    }
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

  const decisionText = normalizeContent(signals.resultDecision || signals.resultNext);
  if (decisionText || signals.resultNext) {
    const readyCommit = decisionText === 'ready_for_commit';
    const readyReview = decisionText === 'ready_for_review';
    const requestFix = decisionText === 'request_fix';
    const stopInvestigate = decisionText === 'stop_and_investigate';
    const waitResult = decisionText === 'wait_for_result' || !decisionText;
    const lead = readyCommit
      ? '最新結果はPASSです。次はcommit前reviewまたはcommit準備です。人間承認待ちです。自動commitはしません。'
      : readyReview
        ? '最新結果はPASSですが、smoke/verify の確認がまだ必要です。'
        : requestFix
          ? '修正依頼が必要です。'
          : stopInvestigate
            ? 'failed または FAIL があるため、原因調査が必要です。'
            : waitResult
              ? 'まだ結果待ちです。'
              : `${signals.resultNext} が次の判断です。`;
    const tail = signals.resultDecisionReason ? ` 理由: ${signals.resultDecisionReason}` : '';
    return {
      reply: `${lead}${tail}`,
      suggested_action: readyCommit
        ? 'commit 前 review をして、人間承認を待つ。'
        : readyReview
          ? 'smoke と verify を確認して、必要なら再判定する。'
          : requestFix
            ? '修正内容を整理して再依頼する。'
            : stopInvestigate
              ? '原因調査と切り分けを進める。'
              : '次の判断を確認して、必要なら result を見直す。',
    };
  }

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

function detectWorkOrderIntent(message) {
  const text = normalizeContent(message);
  if (!text) return false;
  return WORK_ORDER_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}

function resolveWorkOrderTarget(input, snapshotSummary) {
  const haystack = [
    normalizeContent(input.project),
    normalizeContent(input.message),
    normalizeContent(input.context),
  ].filter(Boolean).join(' ');

  for (const target of WORK_ORDER_TARGETS) {
    if (target.hints.test(haystack)) {
      return target;
    }
  }

  return null;
}

function stripWorkOrderLead(text) {
  const value = normalizeContent(text);
  if (!value) return '';
  return value
    .replace(/^(Sales DX|KOSAME Console|Dev Orchestra|営業DX|transcriber)\s*/i, '')
    .replace(/^(の)?(作業票|次の作業票|次の作業)\s*(を|の)?\s*(作って|作成して|生成して|ください|お願い|お願いします)?$/i, '')
    .trim();
}

function buildWorkOrderTitle(input, target) {
  const message = normalizeContent(input.message);
  const lead = stripWorkOrderLead(message);
  const versionMatch = message.match(/v\d+\.\d+\.\d+(?:[-_A-Za-z0-9.]+)?/i);
  const parts = [];

  if (lead && !/^(作業票|次の作業票|次の作業|進めたい|進めてください|進めて)$/i.test(lead)) {
    parts.push(lead);
  }

  if (versionMatch) {
    parts.push(versionMatch[0]);
  } else if (target && target.label) {
    parts.push(target.label);
  }

  const title = parts.join(' ').trim() || `${target ? target.label : '作業票'}`
  return truncate(title.replace(/\s+/g, ' '), 80);
}

function buildWorkOrderPrompt(input, target, title, snapshotSummary) {
  const projectLabel = target ? target.label : truncate(input.project || '対象未指定', 40);
  const contextLines = [];
  if (normalizeContent(input.message)) contextLines.push(`ユーザー要望: ${normalizeContent(input.message)}`);
  if (normalizeContent(snapshotSummary)) contextLines.push(`参考コンテキスト: ${normalizeContent(snapshotSummary)}`);

  return [
    `cd ${target.repo}`,
    '',
    `${title} の作業票ドラフトです。`,
    `対象: ${projectLabel}`,
    contextLines.length ? contextLines.join('\n') : '',
    '',
    '安全条件:',
    '- commit/tag/pushは未実行で止める',
    '- git add . / git add -Aは禁止',
    '- Secret/.env/credentials/API keyを読まない',
    '- 外部APIを呼ばない',
    '- 対象repo以外を触らない',
    '',
    '報告項目:',
    '- 変更ファイル一覧',
    '- /api/chat の仕様',
    '- UI上の動き',
    '- work_order の内容',
    '- git status -sb',
  ].filter((line, index, array) => !(line === '' && array[index - 1] === '')).join('\n');
}

function buildWorkOrderReply(input, snapshotSummary) {
  const target = resolveWorkOrderTarget(input, snapshotSummary);
  if (!target) {
    return {
      reply: '対象repoが特定できませんでした。Sales DX か KOSAME Console のどちらかを教えてください。',
      suggested_action: '対象プロジェクトを1つ指定する。',
      human_gate_required: true,
    };
  }

  const title = buildWorkOrderTitle(input, target);
  const prompt = buildWorkOrderPrompt(input, target, title, snapshotSummary);

  return {
    reply: `${title} の作業票ドラフトを作りました。確認してから Codex に貼ってください☂️`,
    suggested_action: '内容を確認して、問題なければ Codexへ貼る',
    human_gate_required: true,
    work_order: {
      title,
      agent: 'Codex',
      target_repo: target.repo,
      risk_level: target.riskLevel,
      requires_human_confirmation: true,
      prompt,
    },
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

  if (detectWorkOrderIntent(message) || (intent === 'proceed' && resolveWorkOrderTarget(input, snapshotSummary))) {
    return buildWorkOrderReply(input, snapshotSummary);
  }

  if (intent === 'status') {
    return buildStatusReply(input, snapshotSummary);
  }

  if (intent === 'next_action') {
    return buildNextActionReply(input, snapshotSummary);
  }

  if (intent === 'proceed') {
    return buildWorkOrderReply(input, snapshotSummary);
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
    human_gate_required: !!replyPacket.human_gate_required,
    created_at: requestAt,
  };

  if (replyPacket.work_order) {
    result.work_order = replyPacket.work_order;
  }

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
  detectWorkOrderIntent,
  resolveWorkOrderTarget,
  appendChatEvent,
};
