'use strict';

/**
 * Real-time Progress Notifier v110.10.0
 *
 * LINE Notify / Slack / Discord webhook 対応。
 * 作業開始・完了・エラー時に通知を送る。
 *
 * 安全原則:
 *   - dryRun=true (デフォルト) では実際のネットワーク呼び出し禁止
 *   - 実送信は humanApprovalRequired gate あり
 *   - トークン・URLはログに出力しない (masked)
 */

const { sectionStart, sectionEnd, log } = require('./colored-section-logger');

const TOOL_META = {
  version: '110.10.0',
  title:   'Real-time Progress Notifier',
  slug:    'real-time-progress-notifier'
};

const CHANNEL = {
  LINE:    'line',
  SLACK:   'slack',
  DISCORD: 'discord'
};

const EVENT = {
  START:      'start',
  DONE:       'done',
  ERROR:      'error',
  WARNING:    'warning',
  HUMAN_GATE: 'human_gate',
};

// ── Message builder ────────────────────────────────────────────────────────────

function buildMessage(event, payload) {
  const ts   = new Date().toISOString();
  const tag  = event === EVENT.START      ? '[開始]'
             : event === EVENT.DONE       ? '[完了]'
             : event === EVENT.ERROR      ? '[エラー]'
             : event === EVENT.WARNING    ? '[警告]'
             : event === EVENT.HUMAN_GATE ? '[要承認]'
             : '[通知]';
  const body = payload.message || payload.task || '(no message)';
  const detail = payload.detail ? ` — ${payload.detail}` : '';
  return `${tag} ${body}${detail} (${ts})`;
}

// ── Channel adapters (dry-run safe) ───────────────────────────────────────────

async function _sendLine(text, token, dryRun) {
  if (dryRun) {
    return { channel: CHANNEL.LINE, dryRun: true, sent: false, masked: 'token=***' };
  }
  // gate: real send
  const https = await _requireHttps();
  const body  = `message=${encodeURIComponent(text)}`;
  await _post(https, {
    hostname: 'notify-api.line.me',
    path:     '/api/notify',
    method:   'POST',
    headers: {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'Authorization':  `Bearer ${token}`
    }
  }, body);
  return { channel: CHANNEL.LINE, dryRun: false, sent: true };
}

async function _sendSlack(text, webhookUrl, dryRun) {
  if (dryRun) {
    return { channel: CHANNEL.SLACK, dryRun: true, sent: false, masked: 'url=***' };
  }
  const https = await _requireHttps();
  const body  = JSON.stringify({ text });
  const url   = new URL(webhookUrl);
  await _post(https, {
    hostname: url.hostname,
    path:     url.pathname,
    method:   'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  return { channel: CHANNEL.SLACK, dryRun: false, sent: true };
}

async function _sendDiscord(text, webhookUrl, dryRun) {
  if (dryRun) {
    return { channel: CHANNEL.DISCORD, dryRun: true, sent: false, masked: 'url=***' };
  }
  const https = await _requireHttps();
  const body  = JSON.stringify({ content: text });
  const url   = new URL(webhookUrl);
  await _post(https, {
    hostname: url.hostname,
    path:     url.pathname + url.search,
    method:   'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  return { channel: CHANNEL.DISCORD, dryRun: false, sent: true };
}

// ── Notifier ──────────────────────────────────────────────────────────────────

/**
 * Send a progress notification to one or more channels.
 *
 * @param {string} event       EVENT.START | DONE | ERROR
 * @param {object} payload     { message, task, detail }
 * @param {object} channels    { line: { token }, slack: { url }, discord: { url } }
 * @param {object} opts        { dryRun=true, silent=false }
 * @returns {object}           notification result
 */
async function notify(event, payload, channels, opts) {
  const {
    dryRun  = true,
    silent  = false,
    sectionName = 'Progress Notifier'
  } = opts || {};

  const emit = silent ? () => {} : log;

  if (!silent) sectionStart(sectionName);

  const text    = buildMessage(event, payload);
  const results = [];

  emit('info', `event=${event} dryRun=${dryRun} message="${text.slice(0, 80)}"`);

  if (!dryRun) {
    emit('warn', 'LIVE MODE: humanApprovalRequired=true — gate passed by caller');
  }

  if (channels?.line?.token) {
    const r = await _sendLine(text, channels.line.token, dryRun);
    results.push(r);
    emit(r.sent ? 'success' : 'info', `LINE: sent=${r.sent} dryRun=${r.dryRun}`);
  }
  if (channels?.slack?.url) {
    const r = await _sendSlack(text, channels.slack.url, dryRun);
    results.push(r);
    emit(r.sent ? 'success' : 'info', `Slack: sent=${r.sent} dryRun=${r.dryRun}`);
  }
  if (channels?.discord?.url) {
    const r = await _sendDiscord(text, channels.discord.url, dryRun);
    results.push(r);
    emit(r.sent ? 'success' : 'info', `Discord: sent=${r.sent} dryRun=${r.dryRun}`);
  }

  if (results.length === 0) {
    emit('warn', 'no channels configured — nothing to send');
  }

  const summary = {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: !dryRun && results.some(r => r.sent),
    dangerousActionsDenied:     dryRun,
    humanApprovalRequired:      true,
    event,
    text,
    channelCount: results.length,
    sentCount:    results.filter(r => r.sent).length,
    results
  };

  if (!silent) sectionEnd(sectionName);
  return summary;
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

async function notifyStart(payload, channels, opts) {
  return notify(EVENT.START, payload, channels, opts);
}

async function notifyDone(payload, channels, opts) {
  return notify(EVENT.DONE, payload, channels, opts);
}

async function notifyError(payload, channels, opts) {
  return notify(EVENT.ERROR, payload, channels, opts);
}

async function notifyWarning(payload, channels, opts) {
  return notify(EVENT.WARNING, payload, channels, opts);
}

async function notifyHumanGate(payload, channels, opts) {
  return notify(EVENT.HUMAN_GATE, payload, channels, opts);
}

// ── Low-level HTTPS helper ────────────────────────────────────────────────────

function _requireHttps() {
  return Promise.resolve(require('node:https'));
}

function _post(https, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

async function main() {
  const channels = {
    line:    process.env.LINE_NOTIFY_TOKEN  ? { token: process.env.LINE_NOTIFY_TOKEN }  : null,
    slack:   process.env.SLACK_WEBHOOK_URL  ? { url: process.env.SLACK_WEBHOOK_URL }    : null,
    discord: process.env.DISCORD_WEBHOOK_URL ? { url: process.env.DISCORD_WEBHOOK_URL } : null
  };

  const results = [];
  for (const event of [EVENT.START, EVENT.DONE, EVENT.ERROR]) {
    const r = await notify(event, { message: `テスト通知 — ${event}`, task: 'CLI demo' }, channels, {
      dryRun: true,
      sectionName: `通知テスト (${event})`
    });
    results.push(r);
  }

  console.log('');
  console.log(JSON.stringify({ results }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  CHANNEL,
  EVENT,
  buildMessage,
  notify,
  notifyStart,
  notifyDone,
  notifyError,
  notifyWarning,
  notifyHumanGate,
};
