#!/usr/bin/env node
'use strict';

/**
 * Kosame MLIT API Bridge (Lite)
 * 国土交通省 不動産情報ライブラリ API のローカルプロキシサーバー
 *
 * Usage:
 *   MLIT_API_KEY=your_key node tools/kosame-mlit-api-bridge.js
 *
 * Endpoints:
 *   GET /api/health
 *   GET /api/realestate?prefecture=11&year=2024&type=Mansion&from=1&to=100
 */

const http = require('node:http');
const https = require('node:https');
const url = require('node:url');

const PORT = parseInt(process.env.PORT || process.env.MLIT_BRIDGE_PORT || '3002', 10);
const MLIT_API_KEY = process.env.MLIT_API_KEY || '';
const MLIT_BASE = 'https://www.reinfolib.mlit.go.jp/ex-api/external';

// 都道府県コードマップ（埼玉・東京中心）
const PREF_CODES = {
  '埼玉': '11', '東京': '13', '神奈川': '14', '千葉': '12',
  '11': '11', '13': '13', '14': '14', '12': '12',
};

// 種別コードマップ
const TYPE_CODES = {
  'マンション': '01', 'Mansion': '01', '01': '01',
  '戸建て': '02', 'House': '02', '02': '02',
  '土地': '03', 'Land': '03', '03': '03',
  '農地': '04', '04': '04', 'その他': '05', '05': '05',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...corsHeaders(), 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function mlitFetch(params, apiKey) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const reqUrl = `${MLIT_BASE}/XIT001?${query}`;
    const opts = {
      headers: { 'X-API-KEY': apiKey },
      timeout: 15000,
    };
    const req = https.get(reqUrl, opts, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`MLIT API returned ${res.statusCode}: ${raw.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON from MLIT API')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('MLIT API timeout')); });
    req.on('error', reject);
  });
}

// Normalize MLIT API response to RE_DATA-compatible structure
function normalizeMLIT(raw, area) {
  if (!raw || !Array.isArray(raw.data)) return [];
  return raw.data.map(item => {
    const totalPrice = parseInt((item['取引価格（総額）'] || '0').replace(/[^\d]/g, ''), 10) / 10000;
    const areaM2 = parseFloat(item['面積（㎡）'] || '0');
    const pricePer = areaM2 > 0 ? Math.round(totalPrice / (areaM2 / 3.3058)) : 0;
    const typeMap = { '中古マンション等': 'マンション', '宅地（土地）': '土地', '宅地（土地と建物）': '戸建て' };
    return {
      type: typeMap[item['種類']] || item['種類'] || '不明',
      area: area || item['都道府県名'] + (item['市区町村名'] || ''),
      location: (item['地区名'] || '') + (item['最寄駅：名称'] ? ` ${item['最寄駅：名称']}駅` : ''),
      pricePer,
      size: areaM2,
      totalPrice: Math.round(totalPrice),
      year: parseInt(item['取引時点'] || '2023', 10),
      note: item['建物の構造'] || item['用途'] || '',
    };
  }).filter(r => r.totalPrice > 0 && r.pricePer > 0);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    sendJSON(res, 200, {
      status: 'ok',
      service: 'kosame-mlit-api-bridge',
      version: '0.1.0',
      mlitKeyConfigured: !!MLIT_API_KEY,
      port: PORT,
    });
    return;
  }

  if (pathname === '/api/realestate') {
    const q = parsed.query;
    const apiKey = q.apiKey || MLIT_API_KEY;

    if (!apiKey) {
      sendJSON(res, 401, { error: 'MLIT API key required. Set MLIT_API_KEY env or pass ?apiKey=...' });
      return;
    }

    const prefecture = PREF_CODES[q.prefecture || '埼玉'] || '11';
    const typeCode = TYPE_CODES[q.type || ''] || '';
    const year = q.year || new Date().getFullYear().toString();
    const from = parseInt(q.from || '1', 10);
    const to = parseInt(q.to || '100', 10);

    const params = { prefecture, year, from, to };
    if (typeCode) params.type = typeCode;

    mlitFetch(params, apiKey)
      .then(raw => {
        const normalized = normalizeMLIT(raw, q.areaLabel || '');
        sendJSON(res, 200, { ok: true, count: normalized.length, data: normalized, source: 'mlit-live' });
      })
      .catch(err => {
        console.error('[MLIT Bridge] fetch error:', err.message);
        sendJSON(res, 502, { error: err.message, source: 'mlit-live' });
      });
    return;
  }

  sendJSON(res, 404, { error: 'Not found', paths: ['/api/health', '/api/realestate'] });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[MLIT Bridge] Listening on http://localhost:${PORT}`);
  console.log(`[MLIT Bridge] API key: ${MLIT_API_KEY ? '✓ configured' : '✗ not set (pass ?apiKey=... or set MLIT_API_KEY)'}`);
  console.log(`[MLIT Bridge] Health: http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  console.error('[MLIT Bridge] Server error:', err.message);
  process.exit(1);
});
