#!/usr/bin/env node
'use strict';

// KOSAME LINE Bot Server — LINE Messaging API連携
//
// Usage: node tools/kosame-line-bot.js
//
// .env から自動読み込み:
//   LINE_CHANNEL_ID
//   LINE_CHANNEL_SECRET
//   LINE_CHANNEL_ACCESS_TOKEN
//
// データ保存先（.gitignore対象）:
//   data/customers.json       — LINE登録者情報
//   data/line-contents.json   — コンテンツライブラリ
//   data/line-schedules.json  — 配信スケジュール
//   data/line-analytics.json  — 配信分析データ

const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const PORT = parseInt(process.env.LINE_BOT_PORT || '3001');
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

/* ── .env 読み込み（dotenv不要） ── */
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
  return env;
}

function getLineConfig() {
  const env = loadEnv();
  return {
    channelId: env.LINE_CHANNEL_ID || process.env.LINE_CHANNEL_ID || '',
    secret: env.LINE_CHANNEL_SECRET || process.env.LINE_CHANNEL_SECRET || '',
    token: env.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  };
}

/* ── データ管理 ── */
const DATA_DEFAULTS = {
  customers: { customers: [] },
  'line-contents': { contents: [] },
  'line-schedules': { schedules: [] },
  'line-analytics': { deliveries: [], summary: {} },
};

function dataPath(key) { return path.join(DATA_DIR, key + '.json'); }

function readData(key) {
  const p = dataPath(key);
  if (!fs.existsSync(p)) return JSON.parse(JSON.stringify(DATA_DEFAULTS[key] || {}));
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(DATA_DEFAULTS[key] || {})); }
}

function writeData(key, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(dataPath(key), JSON.stringify(data, null, 2), 'utf8');
}

/* ── LINE API 通信 ── */
function lineApiCall(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const { token } = getLineConfig();
    const payload = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot' + endpoint,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function sendPushMessage(to, messages) {
  if (!Array.isArray(messages)) messages = [messages];
  const res = await lineApiCall('POST', '/message/push', { to, messages });
  recordDelivery({ to, messages, success: res.status === 200, sentAt: new Date().toISOString() });
  return res;
}

async function sendReplyMessage(replyToken, messages) {
  if (!Array.isArray(messages)) messages = [messages];
  return lineApiCall('POST', '/message/reply', { replyToken, messages });
}

/* ── 配信記録 ── */
function recordDelivery(entry) {
  const data = readData('line-analytics');
  data.deliveries.push(entry);
  // 月次サマリー更新
  const month = new Date().toISOString().slice(0, 7);
  if (!data.summary[month]) data.summary[month] = { sent: 0, success: 0, failed: 0 };
  data.summary[month].sent++;
  if (entry.success) data.summary[month].success++;
  else data.summary[month].failed++;
  writeData('line-analytics', data);
}

/* ── Webhook 署名検証 ── */
function verifySignature(rawBody, xLineSignature, secret) {
  if (!secret || !xLineSignature) return true; // 開発環境用
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  return hmac.digest('base64') === xLineSignature;
}

/* ── イベントハンドラ ── */
async function handleFollow(event) {
  const lineId = event.source.userId;
  const data = readData('customers');
  if (!data.customers.find(c => c.lineId === lineId)) {
    data.customers.push({
      lineId,
      displayName: '',
      name: '',
      age: null,
      family: '',
      segment: '未分類',
      birthday: '',
      renewalDate: '',
      memo: '',
      active: true,
      followedAt: new Date().toISOString(),
      lastInteraction: new Date().toISOString(),
    });
    writeData('customers', data);
    console.log('[LINE] New follower:', lineId);
    // ウェルカムメッセージ
    if (event.replyToken) {
      await sendReplyMessage(event.replyToken, [{
        type: 'text',
        text: 'ご登録ありがとうございます！\n大宮支店のコンサルタントです。\n保険・資産形成のご相談はお気軽にどうぞ。',
      }]).catch(e => console.warn('[WARN] Reply failed:', e.message));
    }
  } else {
    const c = data.customers.find(x => x.lineId === lineId);
    c.active = true;
    writeData('customers', data);
  }
}

function handleUnfollow(event) {
  const lineId = event.source.userId;
  const data = readData('customers');
  const c = data.customers.find(x => x.lineId === lineId);
  if (c) { c.active = false; c.unfollowedAt = new Date().toISOString(); }
  writeData('customers', data);
  console.log('[LINE] Unfollow:', lineId);
}

async function handleMessage(event) {
  const lineId = event.source.userId;
  const data = readData('customers');
  const c = data.customers.find(x => x.lineId === lineId);
  if (c) { c.lastInteraction = new Date().toISOString(); writeData('customers', data); }
  if (event.message?.type === 'text') {
    console.log('[LINE] Message:', lineId, '—', event.message.text.slice(0, 60));
  }
}

/* ── コンテンツ → LINEメッセージ変換 ── */
function buildMessages(content) {
  if (content.type === 'image') {
    return [{ type: 'image', originalContentUrl: content.url, previewImageUrl: content.thumbnailUrl || content.url }];
  }
  if (content.type === 'video') {
    return [{ type: 'text', text: '【' + content.title + '】\n' + (content.body || '') + '\n▶ ' + content.url }];
  }
  return [{ type: 'text', text: content.title + '\n\n' + (content.body || '') }];
}

/* ── スケジューラ ── */
async function runScheduler() {
  const now = new Date().toISOString();
  const schedData = readData('line-schedules');
  const pending = schedData.schedules.filter(s => s.status === 'pending' && s.scheduledAt <= now);
  if (pending.length === 0) return;

  console.log('[SCHEDULER] Processing', pending.length, 'pending schedule(s)');
  const contentsData = readData('line-contents');
  const custData = readData('customers');

  for (const sched of pending) {
    try {
      let messages;
      if (sched.type === 'birthday') {
        messages = [{ type: 'text', text: sched.birthdayMessage || 'お誕生日おめでとうございます！🎂' }];
      } else if (sched.type === 'renewal') {
        messages = [{ type: 'text', text: sched.renewalMessage || '契約更新のお時間が近づいています。ご確認ください。' }];
      } else {
        const content = contentsData.contents.find(c => c.id === sched.contentId);
        if (!content) { sched.status = 'failed'; sched.errorMsg = 'Content not found'; continue; }
        messages = buildMessages(content);
      }

      let targets;
      if (sched.targetLineId) {
        targets = custData.customers.filter(c => c.lineId === sched.targetLineId && c.active);
      } else {
        targets = custData.customers.filter(c => c.active);
        if (sched.targetSegment && sched.targetSegment !== 'all') {
          targets = targets.filter(c => c.segment === sched.targetSegment);
        }
      }

      let sentCount = 0;
      for (const cust of targets) {
        try { await sendPushMessage(cust.lineId, messages); sentCount++; }
        catch (e) { console.warn('[SCHEDULER] Send failed for', cust.lineId, ':', e.message); }
        // Rate limiting: LINE allows 200 msgs/min on free plan
        if (sentCount % 10 === 0) await new Promise(r => setTimeout(r, 500));
      }
      sched.status = 'sent';
      sched.sentAt = new Date().toISOString();
      sched.sentCount = sentCount;
      console.log('[SCHEDULER] Schedule', sched.id, '→ sent to', sentCount, 'users');
    } catch (e) {
      sched.status = 'failed';
      sched.errorMsg = e.message;
      console.error('[SCHEDULER] Error on', sched.id, ':', e.message);
    }
  }
  writeData('line-schedules', schedData);
}

function checkBirthdayAndRenewal() {
  const custData = readData('customers');
  const schedData = readData('line-schedules');
  const today = new Date();

  custData.customers.filter(c => c.active).forEach(c => {
    // 誕生日フォロー（7日前に自動スケジュール）
    if (c.birthday) {
      const bdayMD = c.birthday.slice(5); // MM-DD
      const target = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
      if (target.toISOString().slice(5, 10) === bdayMD) {
        const schedDay = target.toISOString().slice(0, 10) + 'T09:00:00.000Z';
        const existing = schedData.schedules.find(s =>
          s.type === 'birthday' && s.targetLineId === c.lineId && s.scheduledAt === schedDay
        );
        if (!existing) {
          schedData.schedules.push({
            id: 'bday-' + c.lineId + '-' + today.getTime(),
            type: 'birthday', targetLineId: c.lineId, targetSegment: null,
            scheduledAt: schedDay, status: 'pending',
            birthdayMessage: 'お誕生日おめでとうございます！🎂\n日頃のご愛顧に感謝いたします。',
            createdAt: new Date().toISOString(),
          });
          console.log('[BIRTHDAY] Auto-scheduled for', c.lineId);
        }
      }
    }
    // 契約更新リマインド（30日前）
    if (c.renewalDate) {
      const renewal = new Date(c.renewalDate);
      const diffDays = Math.round((renewal - today) / 86400000);
      if (diffDays === 30) {
        const schedDay = new Date(today.getTime() + 86400000).toISOString().slice(0, 10) + 'T10:00:00.000Z';
        const existing = schedData.schedules.find(s =>
          s.type === 'renewal' && s.targetLineId === c.lineId && s.scheduledAt.startsWith(schedDay.slice(0, 10))
        );
        if (!existing) {
          schedData.schedules.push({
            id: 'renewal-' + c.lineId + '-' + today.getTime(),
            type: 'renewal', targetLineId: c.lineId, targetSegment: null,
            scheduledAt: schedDay, status: 'pending',
            renewalMessage: '契約更新まで30日となりました。\n内容のご確認・ご相談はお気軽にどうぞ。',
            createdAt: new Date().toISOString(),
          });
          console.log('[RENEWAL] Auto-scheduled for', c.lineId);
        }
      }
    }
  });
  writeData('line-schedules', schedData);
}

/* ── HTTP レスポンスヘルパー ── */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function jsonRes(res, status, data) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/* ── ルーティング ── */
async function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // LINE Webhook
  if (pathname === '/webhook' && req.method === 'POST') {
    const raw = await readBody(req);
    const sig = req.headers['x-line-signature'];
    if (!verifySignature(raw, sig, getLineConfig().secret)) {
      jsonRes(res, 401, { error: 'Invalid signature' }); return;
    }
    const { events = [] } = JSON.parse(raw.toString());
    for (const ev of events) {
      if (ev.type === 'follow') await handleFollow(ev);
      else if (ev.type === 'unfollow') handleUnfollow(ev);
      else if (ev.type === 'message') await handleMessage(ev);
    }
    jsonRes(res, 200, { status: 'ok' });
    return;
  }

  // /api/health
  if (pathname === '/api/health') {
    jsonRes(res, 200, { ok: true, service: 'kosame-line-bot', port: PORT, version: '1.2.0' });
    return;
  }

  // /api/test — LINE接続確認
  if (pathname === '/api/test' && req.method === 'GET') {
    const { token } = getLineConfig();
    if (!token) { jsonRes(res, 400, { ok: false, error: 'No token configured' }); return; }
    try {
      const r = await lineApiCall('GET', '/info', null);
      jsonRes(res, 200, { ok: r.status === 200, status: r.status, body: r.body });
    } catch (e) { jsonRes(res, 500, { ok: false, error: e.message }); }
    return;
  }

  // /api/customers
  if (pathname === '/api/customers') {
    if (req.method === 'GET') { jsonRes(res, 200, readData('customers')); return; }
    if (req.method === 'PUT') {
      const body = JSON.parse((await readBody(req)).toString());
      const d = readData('customers');
      const idx = d.customers.findIndex(c => c.lineId === body.lineId);
      if (idx >= 0) Object.assign(d.customers[idx], body);
      else d.customers.push({ ...body, followedAt: new Date().toISOString() });
      writeData('customers', d);
      jsonRes(res, 200, { ok: true });
      return;
    }
  }

  // /api/contents
  if (pathname === '/api/contents' || pathname.startsWith('/api/contents/')) {
    if (req.method === 'GET') { jsonRes(res, 200, readData('line-contents')); return; }
    if (req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString());
      const d = readData('line-contents');
      body.id = body.id || 'c' + Date.now();
      body.createdAt = body.createdAt || new Date().toISOString();
      const idx = d.contents.findIndex(c => c.id === body.id);
      if (idx >= 0) d.contents[idx] = body; else d.contents.unshift(body);
      writeData('line-contents', d);
      jsonRes(res, 200, { ok: true, id: body.id });
      return;
    }
    if (req.method === 'DELETE') {
      const id = pathname.split('/')[3];
      const d = readData('line-contents');
      d.contents = d.contents.filter(c => c.id !== id);
      writeData('line-contents', d);
      jsonRes(res, 200, { ok: true });
      return;
    }
  }

  // /api/schedules
  if (pathname === '/api/schedules' || pathname.startsWith('/api/schedules/')) {
    if (req.method === 'GET') { jsonRes(res, 200, readData('line-schedules')); return; }
    if (req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString());
      const d = readData('line-schedules');
      body.id = body.id || 's' + Date.now();
      body.status = 'pending';
      body.createdAt = new Date().toISOString();
      d.schedules.unshift(body);
      writeData('line-schedules', d);
      jsonRes(res, 200, { ok: true, id: body.id });
      return;
    }
    if (req.method === 'PUT') {
      const body = JSON.parse((await readBody(req)).toString());
      const d = readData('line-schedules');
      const idx = d.schedules.findIndex(s => s.id === body.id);
      if (idx >= 0) Object.assign(d.schedules[idx], body);
      writeData('line-schedules', d);
      jsonRes(res, 200, { ok: true });
      return;
    }
  }

  // /api/analytics
  if (pathname === '/api/analytics' && req.method === 'GET') {
    jsonRes(res, 200, readData('line-analytics'));
    return;
  }

  // /api/send — 手動送信
  if (pathname === '/api/send' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString());
    const result = await sendPushMessage(body.to, body.messages);
    jsonRes(res, 200, result);
    return;
  }

  jsonRes(res, 404, { error: 'Not found', path: pathname });
}

/* ── 起動 ── */
const server = http.createServer(async (req, res) => {
  try { await handleRequest(req, res); }
  catch (e) { console.error('[ERROR]', e.message); jsonRes(res, 500, { error: e.message }); }
});

server.listen(PORT, () => {
  const cfg = getLineConfig();
  console.log('');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│  KOSAME LINE Bot Server  v1.2.0          │');
  console.log('└─────────────────────────────────────────┘');
  console.log('  Port      :', PORT);
  console.log('  Webhook   : https://your-domain.com/webhook');
  console.log('  API       : http://localhost:' + PORT + '/api/');
  console.log('  Channel ID:', cfg.channelId || '(未設定)');
  console.log('  Token     :', cfg.token ? cfg.token.slice(0, 12) + '...' : '(未設定)');
  console.log('  Secret    :', cfg.secret ? '***' : '(未設定)');
  console.log('');

  // スケジューラ: 1分ごと実行
  setInterval(runScheduler, 60000);
  setInterval(checkBirthdayAndRenewal, 60 * 60 * 1000); // 1時間ごと
  runScheduler();
  checkBirthdayAndRenewal();
});

module.exports = { server, sendPushMessage, readData, writeData };
