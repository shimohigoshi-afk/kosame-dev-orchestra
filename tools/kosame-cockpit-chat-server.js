#!/usr/bin/env node
'use strict';

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const PERSONA_PATH = path.join(__dirname, '..', 'config', 'kosame-cockpit-chat-persona.md');
const OPENAI_MODEL = 'gpt-4o-mini';
const DIRECT_MESSAGE_KEYS = ['message', 'text', 'input', 'prompt', 'content'];
const CONTEXT_KEYS = ['contextSummary', 'snapshotSummary', 'consoleContextSummary', 'stateContext'];

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

function normalizeChatRequest(body) {
  const source = body && typeof body === 'object' ? body : {};
  const normalizedMessages = [];

  const pushMessage = (role, content) => {
    const text = normalizeContent(content);
    if (text) {
      normalizedMessages.push({ role, content: text });
    }
  };

  if (Array.isArray(source.messages)) {
    for (const message of source.messages) {
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
      const direct = normalizeContent(source[key]);
      if (direct) {
        normalizedMessages.push({ role: 'user', content: direct });
        break;
      }
    }
  }

  const confirmationContext = normalizeContent(source.confirmationContext);
  let contextSummary = '';
  for (const key of CONTEXT_KEYS) {
    const candidate = normalizeContent(source[key]);
    if (candidate) {
      contextSummary = candidate;
      break;
    }
  }
  const contextStatus = normalizeContent(source.contextStatus) || (contextSummary ? 'ok' : 'unavailable');
  return {
    messages: normalizedMessages,
    confirmationContext,
    contextSummary,
    contextStatus,
  };
}

function callOpenAI(apiKey, messages) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: 800,
      temperature: 0.5,
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.error) {
              resolve({ error: 'AI相談でエラーが発生しました。' });
            } else {
              const reply = data.choices?.[0]?.message?.content ?? '応答がありませんでした。';
              resolve({ reply });
            }
          } catch {
            resolve({ error: 'AI応答のパースに失敗しました。' });
          }
        });
      }
    );

    req.on('error', () => {
      resolve({ error: 'AI相談サービスへの接続に失敗しました。' });
    });

    req.write(body);
    req.end();
  });
}

async function handleChatRequest(body) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { reply: 'AI相談は未接続です（APIキー未設定）。', noKey: true };
  }

  const { messages, confirmationContext, contextSummary, contextStatus } = normalizeChatRequest(body);
  const persona = loadPersona();
  const systemMessage = { role: 'system', content: persona };
  const hasConfirmationContext = !!confirmationContext;

  if (!messages.length && !hasConfirmationContext) {
    return { reply: 'メッセージを入力してください。' };
  }

  const fullMessages = [systemMessage];

  if (!contextSummary && !hasConfirmationContext) {
    return {
      reply: '状態コンテキスト未取得です。',
      noContext: true,
      contextStatus: contextStatus || 'unavailable',
    };
  }

  if (contextSummary) {
    fullMessages.push({
      role: 'system',
      content: [
        'KOSAME Console の現在地を次の安全な要約から判断してください。',
        'APIキー未設定 と 状態コンテキスト未取得 を混同しないでください。',
        '現在地や状態を聞かれたら、この要約に基づいて3行以内で短く答えてください。',
        '要約にない秘密情報、.env、credentials、customer data、音声データ、sales-dxの内部プロンプト、transcriber機密、保険ロジック、価格戦略、温度判定詳細は推測しないでください。',
        '',
        contextSummary,
      ].join('\n'),
    });
  }

  if (confirmationContext && typeof confirmationContext === 'string') {
    fullMessages.push({
      role: 'user',
      content: `【Codex確認待ちコンテキスト】\n${confirmationContext}\n\n上記の確認内容を要約して、判断を教えてください。`,
    });
  }

  for (const msg of messages) {
    if (msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string' && msg.content.trim()) {
      fullMessages.push({ role: msg.role, content: msg.content.trim() });
    }
  }

  return callOpenAI(apiKey, fullMessages);
}

module.exports = {
  handleChatRequest,
  loadPersona,
  normalizeChatRequest,
  normalizeContent,
  DIRECT_MESSAGE_KEYS,
  CONTEXT_KEYS,
};
