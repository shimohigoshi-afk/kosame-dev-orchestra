#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { AUTO_YES_CONTRACT, COMPLETE_RUN_FIRST_POLICY, ZERO_CONFIRM_ROUTE_LOCKDOWN, assertNoZeroConfirmRequests } = require('./kosame-prompt-lint');
const { OFFICIAL_ROUTE, MANUAL_CODE_UI_ALLOWED } = require('./kosame-execution-host-guard');
const { buildOrchestraEvidence } = require('./kosame-orchestra-evidence');
const { buildCompleteRunInboxPlan } = require('./kosame-agent-router');
const { classifyPrompt } = require('./kosame-prompt-classifier');
const { assertPromptFirewall } = require('./kosame-forbidden-prompt-firewall');
const { saveHandoffInbox } = require('./kosame-codex-handoff-bridge-server');
const { callKosameGPT } = require('./kosame-chat-gpt');
const { appendPipelineStageEvent, formatPipelineStageEvent } = require('./kosame-pipeline-telemetry');
// Trigger Gemini key check at server startup (non-blocking)
require('./kosame-gemini');

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
const REPO_MAIN_FILES_CONTEXT = [
  '【repoのメインファイル一覧】',
  '- public/kosame-live-cockpit.html … コンソールUI / AGENT STREAM LOG / チャットUI',
  '- tools/kosame-live-cockpit-server.js … サーバー / SSE / /api/runner-dispatch / /api/runner-stream',
  '- tools/kosame-runner-queue.js … Runner / タスクキュー / processTicket',
  '- tools/kosame-cockpit-chat-server.js … チャットサーバー / /api/chat / buildLocalReply',
  '以下の指示を受けた場合は上記ファイルのいずれかを対象と判断して即実行すること。',
  '「どのファイルですか？」「どのスクリプトですか？」と逆質問しないこと。',
  'UI改善指示（AGENT STREAM LOG、RUNNERログ、ASL、PROGRESS、通知音、クリップボタン等）は public/kosame-live-cockpit.html を対象とすること。',
].join('\n');

const WORK_ORDER_TARGETS = [
  {
    label: 'Sales DX',
    repo: '/home/lavie/repos/kosame-sales-dx',
    legacyRepo: '/home/lavie/repos/transcriber',
    selectedProjectId: 'sales-dx',
    selectedProjectPath: '/home/lavie/repos/kosame-sales-dx',
    riskLevel: 'medium',
    hints: /sales dx|kosame-sales-dx|営業dx/i,
  },
  {
    label: 'KOSAME Console',
    repo: '/home/lavie/kosame-dev-orchestra',
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    riskLevel: 'low',
    hints: /kosame console|dev orchestra|kosame dev orchestra/i,
  },
];
const WORK_ORDER_REQUEST_PATTERNS = [
  /作業票.*(作って|作成|生成)/i,
  /作業票化/i,
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

  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  const attachments = rawAttachments.slice(0, 5).map((a) => ({
    attachmentId: String(a.attachmentId || a.id || '').slice(0, 80),
    name: String(a.name || '').slice(0, 200),
    displayName: String(a.displayName || a.name || '').slice(0, 200),
    ext: String(a.ext || '').slice(0, 10).toLowerCase(),
    size: Number.isFinite(Number(a.size)) ? Number(a.size) : 0,
    mimeType: String(a.mimeType || 'application/octet-stream').slice(0, 80),
    textContent: typeof a.textContent === 'string' ? a.textContent.slice(0, 6000) : null,
    base64DataUrl: typeof a.base64DataUrl === 'string' ? a.base64DataUrl.slice(0, 1200000) : null,
    kind: /image\//i.test(String(a.mimeType || '')) || ['.png', '.jpg', '.jpeg', '.webp'].includes(String(a.ext || '').toLowerCase())
      ? 'image'
      : typeof a.textContent === 'string'
        ? 'text'
        : 'binary',
  }));

  const rawDetectedUrls = Array.isArray(body.detectedUrls) ? body.detectedUrls : [];
  const detectedUrls = rawDetectedUrls.slice(0, 3).map((u) => String(u || '').slice(0, 300)).filter(Boolean);

  const sessionId = typeof body.sessionId === 'string'
    ? body.sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || null
    : null;

  return {
    messages: normalizedMessages,
    project: normalizeContent(body.project),
    context: normalizeContent(body.context).slice(0, MAX_CONTEXT_LENGTH),
    contextSummary: normalizeContent(body.contextSummary || body.snapshotSummary || body.consoleContextSummary || body.stateContext).slice(0, MAX_CONTEXT_LENGTH),
    confirmationContext: normalizeContent(body.confirmationContext),
    contextValues,
    attachments,
    detectedUrls,
    sessionId,
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
    // ── Task Vault signals (v113.8.0) ────────────────────────────────────────
    if (!signals.lastCompleted) {
      const lcMatch = line.match(/前回完了:\s*(.+?)\s*\(/);
      if (lcMatch) signals.lastCompleted = normalizeContent(lcMatch[1]);
    }
    if (!signals.currentLane) {
      const clMatch = line.match(/現在地:\s*lane=(\S+)\s*status=(\S+)/);
      if (clMatch) signals.currentLane = normalizeContent(clMatch[1]);
    }
    if (!signals.currentStatus) {
      const csMatch = line.match(/現在地:\s*lane=\S+\s*status=(\S+)/);
      if (csMatch) signals.currentStatus = normalizeContent(csMatch[1]);
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

  if (signals.lastCompleted) {
    segments.push(`前回は「${signals.lastCompleted}」を完了しましたっ。`);
  }
  if (signals.currentLane && signals.currentStatus) {
    segments.push(`現在地: ${signals.currentLane} (${signals.currentStatus})`);
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


function collectDirectDecisionSignals(input) {
  const source = input && typeof input === 'object' ? input : {};
  const latestDecision = source.latestWorkOrderDecision && typeof source.latestWorkOrderDecision === 'object'
    ? source.latestWorkOrderDecision
    : null;
  const latestResult = source.latestWorkOrderResult && typeof source.latestWorkOrderResult === 'object'
    ? source.latestWorkOrderResult
    : null;
  const resultQueue = Array.isArray(source.workOrderResultQueue) ? source.workOrderResultQueue : [];
  const queueResult = resultQueue.find((item) => item && typeof item === 'object') || null;

  const pick = (...values) => {
    for (const value of values) {
      const text = normalizeContent(value);
      if (text) return text;
    }
    return '';
  };

  const directStatus = pick(
    latestDecision && (latestDecision.decision_status || latestDecision.status || latestDecision.result_status),
    latestResult && (latestResult.decision_status || latestResult.result_status || latestResult.work_order_status),
    queueResult && (queueResult.decision_status || queueResult.result_status || queueResult.work_order_status),
  );

  return {
    resultStatus: pick(
      latestResult && (latestResult.result_status || latestResult.work_order_status),
      queueResult && (queueResult.result_status || queueResult.work_order_status),
      latestDecision && (latestDecision.result_status || latestDecision.decision_status || latestDecision.status),
    ),
    resultSmoke: pick(
      latestResult && latestResult.smoke_result,
      queueResult && queueResult.smoke_result,
      latestDecision && latestDecision.smoke_result,
    ),
    resultVerify: pick(
      latestResult && latestResult.verify_result,
      queueResult && queueResult.verify_result,
      latestDecision && latestDecision.verify_result,
    ),
    resultNext: pick(
      latestDecision && latestDecision.nextRecommendedAction,
      latestResult && latestResult.nextRecommendedAction,
      queueResult && queueResult.nextRecommendedAction,
      directStatus,
    ),
    resultDecision: pick(
      latestDecision && (latestDecision.decision_status || latestDecision.status || latestDecision.result_status),
      latestResult && latestResult.decision_status,
      queueResult && queueResult.decision_status,
    ),
    resultDecisionReason: pick(
      latestDecision && latestDecision.reason,
      latestResult && latestResult.reason,
      queueResult && queueResult.reason,
    ),
    resultDecisionHumanGate: pick(
      latestDecision && latestDecision.humanGate,
      latestDecision && latestDecision.human_gate_required,
      latestResult && latestResult.human_gate_required,
      queueResult && queueResult.human_gate_required,
    ),
    resultDecisionCommit: pick(
      latestDecision && latestDecision.commit_tag_push_allowed,
      latestResult && latestResult.commit_tag_push_allowed,
      queueResult && queueResult.commit_tag_push_allowed,
    ),
  };
}

function buildNextActionReply(input, snapshotSummary) {
  const directSignals = collectDirectDecisionSignals(input);
  const parsedSignals = parseSummarySignals(input.contextSummary || input.context || snapshotSummary);
  const signals = { ...parsedSignals };
  for (const key of [
    'resultStatus',
    'resultSmoke',
    'resultVerify',
    'resultNext',
    'resultDecision',
    'resultDecisionReason',
    'resultDecisionHumanGate',
    'resultDecisionCommit',
  ]) {
    if (normalizeContent(directSignals[key])) {
      signals[key] = directSignals[key];
    }
  }

  const versionLabel = signals.version ? `v${signals.version}` : 'いま';
  const parts = [];

  const inferredResultDecision = (() => {
    if (signals.resultDecision) return normalizeContent(signals.resultDecision);
    if (signals.resultStatus === 'success' && signals.resultSmoke === 'PASS' && signals.resultVerify === 'PASS') {
      return 'ready_for_commit';
    }
    if (signals.resultStatus === 'success' && (signals.resultSmoke === 'unknown' || signals.resultVerify === 'unknown')) {
      return 'ready_for_review';
    }
    if (signals.resultStatus === 'needs_fix') {
      return 'request_fix';
    }
    if (signals.resultStatus === 'failed' || signals.resultSmoke === 'FAIL' || signals.resultVerify === 'FAIL') {
      return 'stop_and_investigate';
    }
    if (signals.resultNext) {
      return normalizeContent(signals.resultNext);
    }
    return '';
  })();
  if (inferredResultDecision || signals.resultNext) {
    const readyCommit = inferredResultDecision === 'ready_for_commit';
    const readyReview = inferredResultDecision === 'ready_for_review';
    const requestFix = inferredResultDecision === 'request_fix';
    const stopInvestigate = inferredResultDecision === 'stop_and_investigate';
    const waitResult = inferredResultDecision === 'wait_for_result' || !inferredResultDecision;
    const lead = readyCommit
      ? 'ready_for_commit 判定です。最新結果はPASSです。commit候補です。次はcommit前reviewまたはcommit準備です。自動commitはしません。'
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

function buildGeneralReply(_input) {
  return {
    reply: 'ご依頼を受け取りました。AIが応答を生成しています…',
    suggested_action: '目的・対象・制約を短く送る。',
  };
}

function detectWorkOrderIntent(message) {
  const text = normalizeContent(message);
  if (!text) return false;
  return WORK_ORDER_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}

function resolveTargetFromSelection(input) {
  const selectedProjectPath = normalizeContent(input.selectedProjectPath || input.selected_project_path || input.target_repo || input.targetRepo);
  const selectedProjectId = normalizeContent(input.selectedProjectId || input.selected_project_id);
  const selectedProjectLabel = normalizeContent(input.selectedProjectLabel || input.selected_project_label || input.project);
  const selectionHint = [selectedProjectPath, selectedProjectId, selectedProjectLabel].filter(Boolean).join(' ').toLowerCase();

  if (/kosame-sales-dx|sales dx/i.test(selectionHint) || selectedProjectId === 'sales-dx' || selectedProjectPath === '/home/lavie/repos/kosame-sales-dx') {
    return WORK_ORDER_TARGETS[0];
  }
  if (/kosame-dev-orchestra|dev orchestra|kosame console/i.test(selectionHint) || selectedProjectId === 'dev-orchestra' || selectedProjectPath === '/home/lavie/kosame-dev-orchestra') {
    return WORK_ORDER_TARGETS[1];
  }
  return null;
}

function resolveWorkOrderTarget(input, snapshotSummary) {
  const selectedTarget = resolveTargetFromSelection(input);
  if (selectedTarget) return selectedTarget;

  const haystack = [
    normalizeContent(input.project),
    normalizeContent(input.message),
    normalizeContent(input.context),
  ].filter(Boolean).join(' ');

  for (const target of WORK_ORDER_TARGETS) {
    if (target.hints.test(haystack)) return target;
  }

  // Auto-detect Console UI keywords → KOSAME Console target
  if (/AGENT STREAM|ASL|RUNNERログ|PROGRESS|通知音|クリップ|Project Strip|Roadmap|Field Ops|Limit Break|Recovery|History|Next Action|chat-proceed|chat-sound|cockpit|コンソール|KOSAME Console|Dev Orchestra/i.test(haystack)) {
    return WORK_ORDER_TARGETS[1]; // KOSAME Console
  }

  return null;
}

function stripWorkOrderLead(text) {
  const value = normalizeContent(text);
  if (!value) return '';
  return value
    .replace(/^(Sales DX|KOSAME Console|Dev Orchestra|営業DX|transcriber)\s*/i, '')
    .replace(/^の/, '')
    .replace(/\s*(を|の|に)?(作業票化して|作業票化|作業票にして)\s*$/i, '')
    .replace(/\s*[をのに]\s*$/, '')
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

  if (versionMatch && !(lead && lead.includes(versionMatch[0]))) {
    parts.push(versionMatch[0]);
  } else if (!versionMatch && target && target.label && !(lead && lead.toLowerCase().includes((target.label || '').toLowerCase()))) {
    parts.push(target.label);
  }

  const title = parts.join(' ').trim() || `${target ? target.label : '作業票'}`
  return truncate(title.replace(/\s+/g, ' '), 80);
}

function buildWorkOrderPrompt(input, target, title, snapshotSummary) {
  const projectLabel = target ? target.label : truncate(input.project || '対象未指定', 40);
  const contextLines = [REPO_MAIN_FILES_CONTEXT];
  if (normalizeContent(input.message)) contextLines.push(`ユーザー要望: ${normalizeContent(input.message)}`);
  // Strip commit-message lines that mention .env to prevent false-positive secret detection in handoff logs
  const filteredSnapshot = normalizeContent(snapshotSummary)
    .split('\n')
    .filter(line => !/\.env\s+(?:path|fix|修正|パス|load|read)/i.test(line))
    .join('\n')
    .trim();
  if (filteredSnapshot) contextLines.push(`参考コンテキスト: ${filteredSnapshot}`);
  const orchestraEvidence = buildOrchestraEvidence({
    router_decision: 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first',
  });

  return [
    AUTO_YES_CONTRACT,
    COMPLETE_RUN_FIRST_POLICY,
    ZERO_CONFIRM_ROUTE_LOCKDOWN,
    '【Batch Execution Contract】',
    '- safe command は 1つずつ確認せず、まとめて実行する',
    '- エラーが出たら自分で再修正して再実行する',
    '- Safety Stop 条件に該当しない限り、ユーザーへYES確認しない',
    '- 追加の確認要求は出さない',
    '- 最終報告まで完走する',
    `cd ${target.repo}`,
    '',
    `${title} の作業票ドラフトです。`,
    `対象: ${projectLabel}`,
    contextLines.length ? contextLines.join('\n') : '',
    '',
    '安全条件:',
    '- commit/tag/pushは未実行で止める',
    '- git add . / git add -Aは禁止',
    '- 機密情報・環境変数ファイル・認証情報・APIキーは読まない',
    '- 外部APIを呼ばない',
    '- 対象repo以外を触らない',
    '',
    '保持項目:',
    '- executor / route / autoResponder / promptClassifier / policyKernel / promptFirewall / safetyStopDetector',
    '- routerDecision / assignedLanes / laneStatuses / orchestraEvidence',
    '- originalRequest / target / agent / risk / safetyConditions / reportItems / body',
    '- PM Lane / Implementation Lane / Safety Lane / Executor Policy Lane / Prompt Firewall Lane / Auto-Responder Lane / Audit Lane / Smoke Lane / Verify Lane / UI/Console Lane / Result Decision Lane / Release Lane',
    `- Orchestra証跡: ${orchestraEvidence.summary}`,
    '',
    '報告項目:',
    '- 変更ファイル一覧',
    '- /api/chat の仕様',
    '- UI上の動き',
    '- work_order の内容',
    '- git status -sb',
    '',
    '完了後に以下コマンドを実行してKOSAME Consoleへ自動報告:',
    'node ~/kosame-dev-orchestra/tools/kosame-codex-result-poster.js',
    '(実行不可の場合は以下フォーマットで標準出力)',
    'KOSAME_RESULT_BEGIN',
    '{"result_status":"success","smoke_result":"PASS","verify_result":"PASS","result_summary":"概要","changed_files":[]}',
    'KOSAME_RESULT_END',
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

  const draft = input.workOrderDraft && typeof input.workOrderDraft === 'object' ? input.workOrderDraft : null;
  const title = truncate(draft && draft.title ? draft.title : buildWorkOrderTitle(input, target), 80);
  const prompt = buildWorkOrderPrompt(input, target, title, snapshotSummary);
  const originalRequest = normalizeContent(
    draft && (draft.originalRequest || draft.original_request)
      ? (draft.originalRequest || draft.original_request)
      : input.message,
  );
  const body = normalizeContent(draft && (draft.body || draft.prompt) ? (draft.body || draft.prompt) : prompt) || prompt;
  const workOrderId = truncate(
    draft && (draft.id || draft.workOrderId || draft.work_order_id)
      ? (draft.id || draft.workOrderId || draft.work_order_id)
      : `${target.selectedProjectId || 'work-order'}-${Date.now()}`,
    80,
  );
  const selectedProjectPath = normalizeContent(
    draft && (draft.selectedProjectPath || draft.selected_project_path)
      ? (draft.selectedProjectPath || draft.selected_project_path)
      : input.selectedProjectPath || input.selected_project_path || target.repo,
  ) || target.repo;
  const selectedProjectId = normalizeContent(
    draft && (draft.selectedProjectId || draft.selected_project_id)
      ? (draft.selectedProjectId || draft.selected_project_id)
      : input.selectedProjectId || input.selected_project_id || target.selectedProjectId || '',
  ) || target.selectedProjectId || '';
  const selectedProjectLabel = truncate(
    draft && (draft.selectedProjectLabel || draft.selected_project_label)
      ? (draft.selectedProjectLabel || draft.selected_project_label)
      : input.selectedProjectLabel || input.selected_project_label || target.label || '',
    120,
  );
  const safetyConditions = Array.isArray(draft && (draft.safetyConditions || draft.safety_conditions))
    ? draft.safetyConditions || draft.safety_conditions
    : [];
  const reportItems = Array.isArray(draft && (draft.reportItems || draft.report_items))
    ? draft.reportItems || draft.report_items
    : [];
  const orchestraEvidence = buildOrchestraEvidence({
    router_decision: 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first',
    assigned_lanes: [
      'PM Lane',
      'Implementation Lane',
      'Safety Lane',
      'Executor Policy Lane',
      'Prompt Firewall Lane',
      'Auto-Responder Lane',
      'Audit Lane',
      'Smoke Lane',
      'Verify Lane',
      'UI/Console Lane',
      'Result Decision Lane',
      'Release Lane',
    ],
  });
  const completeRunPlan = buildCompleteRunInboxPlan({
    message: input.message || input.prompt || '',
    selectedProjectPath,
    selectedProjectId,
    selectedProjectLabel,
  }, { completionMode: 'complete-run-first' });

  return {
    reply: `${title} の作業票ドラフトを作りました。route: zero-confirm / KOSAME Runner / dispatch watcher が official route で自動実行します。Orchestra証跡を Run History / Result Decision / Operations Board に残します。`,
    suggested_action: '採用すると、KOSAME Runner / dispatch watcher が official route で zero-confirm 実行します。Orchestra証跡も記録されます。',
    human_gate_required: true,
    work_order: {
      id: workOrderId,
      work_order_id: workOrderId,
      approval_id: workOrderId,
      handoff_id: workOrderId,
      title,
      agent: 'Codex',
      executor: 'claude-zero-confirm',
      route: 'zero-confirm',
      autoResponder: 'active',
      autoResponderMode: 'blocklist-only',
      promptClassifier: 'active',
      policyKernel: 'active',
      promptFirewall: 'active',
      safetyStopDetector: 'active',
      completionMode: 'complete-run-first',
      executionMode: completeRunPlan.executionMode,
      noHumanWait: true,
      noManualPaste: true,
      resultPOSTRequired: true,
      runHistoryRequired: true,
      resultDecisionRequired: true,
      operationsBoardRequired: true,
      executionCommand: 'claude --dangerously-skip-permissions -p',
      executionHost: 'kosame-console',
      executionHostAllowed: true,
      interactiveHostBlocked: false,
      interactivePromptBlocked: false,
      noYesGateRuntime: true,
      safeSpawnActive: false,
      manualCodeUiAllowed: MANUAL_CODE_UI_ALLOWED,
      officialRoute: OFFICIAL_ROUTE,
      codexYesHellGuard: 'active',
      codexAutoApproveMode: 'active',
      userYesRequired: false,
      safetyStopGuard: 'active',
      executionSource: 'kosame-console',
      promptType: 'work_order_request',
      promptOrigin: 'kosame-console',
      userInputRequired: false,
      router_decision: orchestraEvidence.router_decision,
      routerDecision: orchestraEvidence.router_decision,
      assigned_lanes: orchestraEvidence.assigned_lanes,
      assignedLanes: orchestraEvidence.assigned_lanes,
      lane_statuses: orchestraEvidence.lane_statuses,
      laneStatuses: orchestraEvidence.lane_statuses,
      orchestra_evidence: orchestraEvidence,
      orchestraEvidence,
      agentRouter: completeRunPlan.agentRouter,
      commandInbox: {
        route: completeRunPlan.route,
        executor: completeRunPlan.executor,
        completionMode: completeRunPlan.completionMode,
        nextCommand: completeRunPlan.nextCommand,
      },
      completionMode: completeRunPlan.completionMode,
      target_repo: target.repo,
      risk_level: target.riskLevel,
      requires_human_confirmation: true,
      prompt: body,
      body,
      originalRequest,
      selectedProjectId,
      selectedProjectPath,
      selectedProjectLabel,
      safetyConditions,
      reportItems,
      target: {
        id: selectedProjectId,
        label: selectedProjectLabel || target.label,
        path: selectedProjectPath || target.repo,
      },
    },
  };
}

function formatSpecPipelineFailureReply(specResult) {
  const errorStage = String(specResult && (specResult.errorStage || specResult.stage || 'spec-to-tasks.pipeline')).trim() || 'spec-to-tasks.pipeline';
  const errorCode = String(specResult && (specResult.errorCode || 'SPEC_PIPELINE_FAILED')).trim() || 'SPEC_PIPELINE_FAILED';
  const errorMessage = String(specResult && (specResult.errorMessage || specResult.error || 'pipeline failed')).trim() || 'pipeline failed';
  const workOrderId = String(specResult && (specResult.workOrderId || specResult.work_order_id || '')).trim();
  const attachmentCount = Number.isFinite(Number(specResult && specResult.attachmentCount)) ? Number(specResult.attachmentCount) : 0;
  const attachmentIds = Array.isArray(specResult && specResult.attachmentIds) ? specResult.attachmentIds.filter(Boolean).join(', ') : '';
  const manifestPath = String(specResult && (specResult.manifestPath || specResult.attachmentManifestPath || '')).trim();
  const route = String(specResult && specResult.route || 'spec-to-tasks').trim() || 'spec-to-tasks';
  const lines = [
    '設計書の処理に失敗しました:',
    `stage=${errorStage}`,
    `code=${errorCode}`,
    `message=${errorMessage}`,
    workOrderId ? `workOrderId=${workOrderId}` : null,
    `attachmentCount=${attachmentCount}`,
    attachmentIds ? `attachmentIds=${attachmentIds}` : null,
    manifestPath ? `manifestPath=${manifestPath}` : null,
    `route=${route}`,
  ].filter(Boolean);
  return {
    reply: lines.join('\n'),
    error_details: {
      errorStage,
      errorCode,
      errorMessage,
      workOrderId,
      attachmentCount,
      attachmentIds: Array.isArray(specResult && specResult.attachmentIds) ? specResult.attachmentIds : [],
      manifestPath,
      route,
      timestamp: String(specResult && specResult.timestamp || new Date().toISOString()),
      stageHistory: Array.isArray(specResult && specResult.stageHistory) ? specResult.stageHistory : [],
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
  const message = normalizeContent(input.message);

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
    selectedProjectId: normalizeContent(source.selectedProjectId || source.selected_project_id),
    selectedProjectPath: normalizeContent(source.selectedProjectPath || source.selected_project_path),
    selectedProjectLabel: normalizeContent(source.selectedProjectLabel || source.selected_project_label),
    workOrderDraft: source.workOrderDraft && typeof source.workOrderDraft === 'object' ? source.workOrderDraft : null,
    attachments: normalized.attachments,
    detectedUrls: normalized.detectedUrls,
    sessionId: normalized.sessionId || null,
  };
}

async function handleChatRequest(body) {
  const requestAt = new Date().toISOString();
  const source = body && typeof body === 'object' ? body : {};
  const normalized = normalizeChatRequest(source);
  // Allow empty message when file is attached — synthesize a default
  const rawMessage = normalizeContent(normalized.message);
  const hasAttachments = (normalized.attachments || []).length > 0;
  const message = rawMessage || (hasAttachments ? '添付ファイルを解析してください。' : '');
  const project = normalizeContent(normalized.project);
  const context = normalizeContent(normalized.context);
  const contextSummary = normalizeContent(source.contextSummary || source.context || normalized.contextSummary);
  const directText = [message, project].filter(Boolean).join(' ');
  const attachmentIds = (normalized.attachments || []).map((att) => String(att && (att.attachmentId || att.id || att.name || '')).trim()).filter(Boolean);
  const { detectSpecIntent } = require('./kosame-spec-to-tasks');
  const telemetrySpecIntent = detectSpecIntent(message, normalized.attachments || []);
  if (telemetrySpecIntent.isSpec) {
    appendPipelineStageEvent({
      stage: 'chat.received',
      status: 'running',
      workOrderId: '',
      attachmentCount: attachmentIds.length,
      attachmentIds,
      route: 'chat',
      timestamp: requestAt,
      message: `KOSAME: 受信した入力を受け付けました☂️`,
    }, { agent: 'KOSAME', task: 'chat.received' });
    if (attachmentIds.length) {
      appendPipelineStageEvent({
        stage: 'attachments.received',
        status: 'running',
        workOrderId: '',
        attachmentCount: attachmentIds.length,
        attachmentIds,
        route: 'chat',
        timestamp: requestAt,
        message: `KOSAME: 添付${attachmentIds.length}件を受け取りました☂️`,
      }, { agent: 'KOSAME', task: 'attachments.received' });
    }
  }

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
    latestWorkOrderResult: source.latestWorkOrderResult || null,
    workOrderResultQueue: Array.isArray(source.workOrderResultQueue) ? source.workOrderResultQueue : [],
    latestWorkOrderDecision: source.latestWorkOrderDecision || null,
    workOrderDecisionQueue: Array.isArray(source.workOrderDecisionQueue) ? source.workOrderDecisionQueue : [],
    latestApprovedWorkOrder: source.latestApprovedWorkOrder || null,
    latestHandoffWorkOrder: source.latestHandoffWorkOrder || null,
    workOrderDraft: source.workOrderDraft || null,
    selectedProjectId: normalized.selectedProjectId || '',
    selectedProjectPath: normalized.selectedProjectPath || '',
    selectedProjectLabel: normalized.selectedProjectLabel || '',
  }, contextSummary);

  if (replyPacket.reply) {
    assertNoZeroConfirmRequests(replyPacket.reply, 'chat reply', { allowNegatedContext: true });
  }
  if (replyPacket.work_order) {
    assertNoZeroConfirmRequests(replyPacket.work_order.prompt || '', 'work order prompt', { allowNegatedContext: true });
    assertNoZeroConfirmRequests(replyPacket.work_order.body || '', 'work order body', { allowNegatedContext: true });
    const promptClassification = classifyPrompt(replyPacket.work_order.body || replyPacket.work_order.prompt || '', 'work_order');
    replyPacket.work_order.promptType = promptClassification.promptType;
    const handoffDir = source.handoffDir || source.handoff_dir || normalized.handoffDir || '';
    if (handoffDir) {
      try {
        appendPipelineStageEvent({
          stage: 'handoff.save.started',
          status: 'running',
          workOrderId: replyPacket.work_order.id || replyPacket.work_order.work_order_id || replyPacket.work_order.title || '',
          attachmentCount: attachmentIds.length,
          attachmentIds,
          route: replyPacket.work_order.route || 'zero-confirm',
          timestamp: requestAt,
          message: 'Runner: handoff save を開始します☂️',
        }, { agent: 'Runner', task: 'handoff.save.started' });
        const saved = saveHandoffInbox(replyPacket.work_order, { handoffDir });
        replyPacket.work_order.handoff = saved;
        replyPacket.work_order.handoffDir = saved.handoffDir;
        replyPacket.work_order.queuePath = saved.queuePath;
        replyPacket.work_order.latestPath = saved.latestPath;
        replyPacket.work_order.attachmentManifestPath = saved.attachmentManifestPath;
        appendPipelineStageEvent({
          stage: 'handoff.save.completed',
          status: 'success',
          workOrderId: replyPacket.work_order.id || replyPacket.work_order.work_order_id || replyPacket.work_order.title || '',
          attachmentCount: attachmentIds.length,
          attachmentIds,
          manifestPath: saved.attachmentManifestPath || '',
          route: replyPacket.work_order.route || 'zero-confirm',
          timestamp: requestAt,
          message: 'Runner: handoff save を完了しました☂️',
        }, { agent: 'Runner', task: 'handoff.save.completed' });
      } catch (handoffErr) {
        appendPipelineStageEvent({
          stage: 'handoff.save.failed',
          status: 'failed',
          errorStage: 'handoff.save',
          errorCode: 'HANDOFF_SAVE_FAILED',
          errorMessage: handoffErr && handoffErr.message ? handoffErr.message : String(handoffErr),
          workOrderId: replyPacket.work_order.id || replyPacket.work_order.work_order_id || replyPacket.work_order.title || '',
          attachmentCount: attachmentIds.length,
          attachmentIds,
          route: replyPacket.work_order.route || 'zero-confirm',
          timestamp: requestAt,
          message: 'Runner: handoff save で失敗しました',
        }, { agent: 'Runner', task: 'handoff.save.failed' });
      }
    }
  }

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

  // Try live GPT call with こさめ persona — falls back to local reply if unavailable
  let gptResult = null;
  try {
    const { isLiveEnabled, isKeyPresent } = require('./kosame-chat-gpt');
    const keyPresent = isKeyPresent();
    const liveFlag = process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED;
    process.stderr.write(`[chat-gpt] keyPresent=${keyPresent} LIVE_CALLS_ENABLED=${liveFlag} isLive=${isLiveEnabled()}\n`);

    // Build augmented messages with attachment content
    const attachments = normalized.attachments || [];
    const detectedUrls = normalized.detectedUrls || [];
    const sessionId = normalized.sessionId || null;
    let augmentedMessage = message;
    // Inject repo main files context so GPT never asks "which file?"
    if (/直して|書き換え|修正して|追加して|変えて|実装して|開いて|確認して|教えて|なに|何|どこ|AGENT STREAM|コンソール|ASL|RUNNER|PROGRESS|通知音|クリップ|Project Strip|Roadmap|Field Ops|Limit Break|Recovery|History|Next Action|チャット|chat-proceed|chat-sound|cockpit/i.test(message)) {
      augmentedMessage += `\n\n${REPO_MAIN_FILES_CONTEXT}`;
    }
    const imageParts = [];

    const IMAGE_EXTS_SET = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
    for (const att of attachments) {
      if (att.base64DataUrl && IMAGE_EXTS_SET.has(att.ext)) {
        // Try Gemini Vision first; fall back to GPT imageParts if unavailable
        try {
          const { analyzeImageWithGemini, isKeyPresent: geminiKeyPresent } = require('./kosame-gemini');
          if (geminiKeyPresent()) {
            const imgResult = await analyzeImageWithGemini(att.base64DataUrl, att.name);
            if (imgResult.text) {
              augmentedMessage += `\n\n--- 添付画像: ${att.displayName || att.name} (Gemini解析) ---\n${imgResult.text.slice(0, 3000)}\n---`;
              process.stderr.write(`[chat-img] Gemini analyzed ${att.name} (${imgResult.text.length} chars)\n`);
            } else {
              imageParts.push({ type: 'image_url', image_url: { url: att.base64DataUrl } });
              process.stderr.write(`[chat-img] Gemini failed for ${att.name}: ${imgResult.error} — using GPT Vision\n`);
            }
          } else {
            imageParts.push({ type: 'image_url', image_url: { url: att.base64DataUrl } });
            process.stderr.write(`[chat-img] no Gemini key — using GPT Vision for ${att.name}\n`);
          }
        } catch (imgErr) {
          imageParts.push({ type: 'image_url', image_url: { url: att.base64DataUrl } });
          process.stderr.write(`[chat-img] error: ${imgErr.message} — using GPT Vision for ${att.name}\n`);
        }
      } else if (att.textContent) {
        augmentedMessage += `\n\n--- 添付ファイル: ${att.displayName || att.name} ---\n${att.textContent.slice(0, 4000)}\n---\nこのファイルを元に実装してください。`;
      } else {
        augmentedMessage += `\n\n[添付: ${att.displayName || att.name} (${att.ext}・${att.size}バイト) — バイナリ形式のため内容を直接解析できません]`;
      }
    }
    // Fetch URL content — YouTube via Gemini, other pages via html scrape
    if (detectedUrls.length) {
      try {
        const { isYouTubeUrl } = require('./kosame-url-fetcher');
        if (isYouTubeUrl(detectedUrls[0])) {
          const { askGeminiAboutYouTube } = require('./kosame-gemini');
          const geminiResult = await askGeminiAboutYouTube(detectedUrls[0]);
          if (geminiResult.text) {
            augmentedMessage += `\n\n[YouTube動画: ${detectedUrls[0]}]\n--- Gemini解析結果 ---\n${geminiResult.text.slice(0, 4000)}\n---\nこの動画の内容を元に対応してください。`;
          } else {
            augmentedMessage += `\n\n[YouTube動画: ${detectedUrls[0]}]\nGeminiによる動画解析に失敗しました。URLを元に推測して対応してください。`;
          }
          process.stderr.write(`[url-fetch] ${detectedUrls[0]} isYouTube=true gemini=${!!geminiResult.text}\n`);
        } else {
          const { analyzeUrl } = require('./kosame-url-fetcher');
          const urlResult = await analyzeUrl(detectedUrls[0]);
          if (urlResult.loginRequired) {
            augmentedMessage += `\n\n[${urlResult.url}]\nログインが必要なページは取得できません。`;
          } else if (urlResult.text) {
            const titlePart = urlResult.title ? `タイトル: ${urlResult.title}\n` : '';
            augmentedMessage += `\n\n[ページ内容: ${urlResult.url}]\n${titlePart}--- ページテキスト ---\n${urlResult.text}\n---\nこのページをクローンして実装してください。`;
          } else if (urlResult.error) {
            augmentedMessage += `\n\n[URL取得失敗: ${urlResult.url}] ${urlResult.error}`;
          } else {
            augmentedMessage += `\n\n[URL: ${urlResult.url}]\nこのページを参考に実装してください。`;
          }
          process.stderr.write(`[url-fetch] ${urlResult.url} loginRequired=${urlResult.loginRequired} isYouTube=false hasText=${!!urlResult.text}\n`);
        }
      } catch (urlErr) {
        augmentedMessage += `\n\n[URL取得エラー: ${detectedUrls[0]}] ${urlErr && urlErr.message ? urlErr.message : String(urlErr)}`;
      }
    }

    // Load session history (last 19 messages) and prepend to GPT messages
    let sessionHistory = [];
    if (sessionId) {
      try {
        const { getSessionForGPT } = require('./kosame-chat-sessions');
        sessionHistory = getSessionForGPT(sessionId, 19);
      } catch (sessErr) {
        process.stderr.write(`[sessions] load error: ${sessErr.message}\n`);
      }
    }

    let gptMessages;
    if (imageParts.length) {
      const textPart = { type: 'text', text: augmentedMessage };
      const userContent = [textPart, ...imageParts];
      gptMessages = [...sessionHistory, { role: 'user', content: userContent }];
    } else {
      gptMessages = [...sessionHistory, { role: 'user', content: augmentedMessage }];
    }

    // Spec-to-Tasks: detect design doc intent and auto-generate work tickets
    try {
      const { processSpec } = require('./kosame-spec-to-tasks');
      const specIntent = telemetrySpecIntent;
      if (specIntent.isSpec) {
        process.stderr.write(`[spec-to-tasks] spec detected — running pipeline\n`);
        appendPipelineStageEvent({
          stage: 'spec-to-tasks.started',
          status: 'running',
          workOrderId: '',
          attachmentCount: attachmentIds.length,
          attachmentIds,
          route: 'spec-to-tasks',
          timestamp: requestAt,
          message: 'DIRECTOR: 作業票化を開始します☂️',
        }, { agent: 'DIRECTOR', task: 'spec-to-tasks.started' });
        const specResult = await processSpec({
          message,
          attachments,
          projectPath: normalized.selectedProjectPath || '/home/lavie/kosame-dev-orchestra',
          handoffDir: source.handoffDir || source.handoff_dir || '',
        });
        if (specResult.ok) {
          const stageHistory = Array.isArray(specResult.stageHistory) ? specResult.stageHistory : [];
          const taskTitles = specResult.tasks.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join('\n');
          result.reply = `設計書を受け付けました。作業票 ${specResult.savedCount} 件を生成してHandoff Inboxに保存しました。Runnerが自動実行します。\n\n生成された作業票:\n${taskTitles}${specResult.tasks.length > 5 ? `\n...他 ${specResult.tasks.length - 5} 件` : ''}\n\n完了したらAGENT STREAM LOGに「完成しました」と表示されます。`;
          result.error_details = null;
          result.pipeline_trace = stageHistory;
          process.stderr.write(`[spec-to-tasks] pipeline ok — ${specResult.savedCount} tickets saved\n`);
          appendPipelineStageEvent({
            stage: 'result.decision.updated',
            status: 'success',
            workOrderId: specResult.workOrderId || specResult.tasks?.[0]?.id || '',
            attachmentCount: Number.isFinite(Number(specResult.attachmentCount)) ? Number(specResult.attachmentCount) : attachmentIds.length,
            attachmentIds: Array.isArray(specResult.attachmentIds) ? specResult.attachmentIds : attachmentIds,
            manifestPath: specResult.manifestPath || '',
            route: specResult.route || 'spec-to-tasks',
            timestamp: new Date().toISOString(),
            message: 'Result Decision Panel へ更新できる状態です',
          }, { agent: 'Runner', task: 'result.decision.updated' });
        } else {
          const failure = formatSpecPipelineFailureReply(specResult);
          result.ok = false;
          result.reply = failure.reply;
          result.error = `設計書の処理に失敗しました: ${failure.error_details.errorCode}`;
          result.suggested_action = 'エラーを修正してください';
          result.human_gate_required = true;
          result.error_details = failure.error_details;
          result.pipeline_trace = Array.isArray(specResult.stageHistory) ? specResult.stageHistory : [];
          process.stderr.write(`[spec-to-tasks] pipeline failed: ${failure.error_details.errorStage} / ${failure.error_details.errorCode} / ${failure.error_details.errorMessage}\n`);
          appendPipelineStageEvent({
            stage: failure.error_details.errorStage,
            status: 'failed',
            errorStage: failure.error_details.errorStage,
            errorCode: failure.error_details.errorCode,
            errorMessage: failure.error_details.errorMessage,
            workOrderId: failure.error_details.workOrderId,
            attachmentCount: failure.error_details.attachmentCount,
            attachmentIds: failure.error_details.attachmentIds,
            manifestPath: failure.error_details.manifestPath,
            route: failure.error_details.route,
            timestamp: failure.error_details.timestamp,
            message: failure.error_details.errorMessage,
          }, { agent: 'Runner', task: failure.error_details.errorStage });
        }
        return result;
      }
    } catch (specErr) {
      process.stderr.write(`[spec-to-tasks] ERROR: ${specErr && specErr.message ? specErr.message : String(specErr)}\n`);
    }

    console.log('[GPT] calling... isLive=' + isLiveEnabled());
    gptResult = await callKosameGPT(gptMessages, {
      contextSummary: contextSummary.slice(0, 400),
      project,
      selectedProjectId: normalized.selectedProjectId || '',
      selectedProjectPath: normalized.selectedProjectPath || '',
      selectedProjectLabel: normalized.selectedProjectLabel || '',
    });
    process.stderr.write(`[chat-gpt] ok=${gptResult.ok} dryRun=${gptResult.dryRun} reason=${gptResult.reason || 'none'}\n`);
    if (gptResult.ok && gptResult.reply) {
      const zeroConfirmRouteLine = `route: ${replyPacket.work_order && replyPacket.work_order.route ? replyPacket.work_order.route : 'zero-confirm'}`;
      result.reply = String(gptResult.reply).includes(zeroConfirmRouteLine)
        ? gptResult.reply
        : `${gptResult.reply}\n\n${zeroConfirmRouteLine}`;
      result.gptProvider = 'openai';
      process.stderr.write('[chat-gpt] GPT reply used\n');
      if (sessionId) {
        try {
          const { appendToSession } = require('./kosame-chat-sessions');
          appendToSession(sessionId, [
            { role: 'user', content: message },
            { role: 'assistant', content: result.reply },
          ]);
        } catch (sessErr) {
          process.stderr.write(`[sessions] save error: ${sessErr.message}\n`);
        }
        try {
          const { appendChatHistory } = require('./kosame-chat-history');
          appendChatHistory({ role: 'user', content: message });
          appendChatHistory({ role: 'assistant', content: result.reply });
        } catch (histErr) {
          process.stderr.write(`[chat-history] save error: ${histErr.message}\n`);
        }
      }
    } else {
      process.stderr.write('[chat-gpt] fallback to local reply\n');
    }
  } catch (err) {
    process.stderr.write(`[chat-gpt] ERROR: ${err && err.message ? err.message : String(err)}\n`);
    // fall through to local reply
  }

  // Save local reply to chat history when GPT didn't already save
  if (!gptResult || !gptResult.ok || !gptResult.reply) {
    try {
      const { appendChatHistory } = require('./kosame-chat-history');
      appendChatHistory({ role: 'user', content: message });
      appendChatHistory({ role: 'assistant', content: result.reply });
    } catch (histErr) {
      process.stderr.write(`[chat-history] save error: ${histErr.message}\n`);
    }
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
