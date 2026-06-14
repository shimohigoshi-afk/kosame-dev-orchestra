#!/usr/bin/env node
'use strict';

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const PERSONA_PATH = path.join(__dirname, '..', 'config', 'kosame-cockpit-chat-persona.md');
const OPENAI_MODEL = 'gpt-4o-mini';

function loadPersona() {
  try {
    return fs.readFileSync(PERSONA_PATH, 'utf8').trim();
  } catch {
    return 'あなたはこさめです。じゅんやさんの相談AIです。危険操作は止めてください。';
  }
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

  const { messages = [], confirmationContext } = body || {};
  const persona = loadPersona();
  const systemMessage = { role: 'system', content: persona };

  const fullMessages = [systemMessage];

  if (confirmationContext && typeof confirmationContext === 'string') {
    fullMessages.push({
      role: 'user',
      content: `【Codex確認待ちコンテキスト】\n${confirmationContext}\n\n上記の確認内容を要約して、判断を教えてください。`,
    });
  }

  for (const msg of messages) {
    if (
      msg &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string' &&
      msg.content.trim()
    ) {
      fullMessages.push({ role: msg.role, content: msg.content });
    }
  }

  if (fullMessages.length === 1) {
    return { reply: 'メッセージを入力してください。' };
  }

  return callOpenAI(apiKey, fullMessages);
}

module.exports = { handleChatRequest, loadPersona };
