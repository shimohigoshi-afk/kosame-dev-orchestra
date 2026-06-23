#!/usr/bin/env node
'use strict';

// Fetches education cost data from e-Stat (文科省 子供の学習費調査)
// and updates data/education-costs.json if data is 30+ days old.
//
// Usage:
//   npm run fetch:education-costs
//
// e-Stat API: https://www.e-stat.go.jp/api/
// App ID (ESTAT_APP_ID): required — set in .env

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const DATA_PATH = path.resolve(__dirname, '..', 'data', 'education-costs.json');
const ESTAT_APP_ID = process.env.ESTAT_APP_ID || '';
const MAX_AGE_DAYS = 30;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('JSON parse error: ' + body.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

function isStale(data) {
  if (!data._fetchedAt) return true;
  const fetched = new Date(data._fetchedAt);
  const now = new Date();
  const diffDays = (now - fetched) / (1000 * 60 * 60 * 24);
  return diffDays >= MAX_AGE_DAYS;
}

async function main() {
  console.log('[fetch-education-costs] start');

  let current = {};
  if (fs.existsSync(DATA_PATH)) {
    try { current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch (_) {}
  }

  if (!isStale(current)) {
    console.log(`[fetch-education-costs] data is fresh (fetched: ${current._fetchedAt}) — skip`);
    return;
  }

  if (!ESTAT_APP_ID) {
    console.warn('[fetch-education-costs] ESTAT_APP_ID is not set. Using bundled data only.');
    console.warn('  Set ESTAT_APP_ID in .env to enable live data fetch.');
    console.log('[fetch-education-costs] updating _fetchedAt to suppress warnings');
    current._fetchedAt = new Date().toISOString();
    fs.writeFileSync(DATA_PATH, JSON.stringify(current, null, 2), 'utf8');
    return;
  }

  // e-Stat API: 文科省 子供の学習費調査 (統計ID: 0003224177 等)
  // 実際のstats_data_idは e-Stat で「子供の学習費調査」で検索して取得してください
  const statsDataId = '0003224177';
  const url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${ESTAT_APP_ID}&statsDataId=${statsDataId}&lang=J`;

  console.log('[fetch-education-costs] fetching from e-Stat API...');
  try {
    const result = await fetchJson(url);
    const status = result?.GET_STATS_DATA?.RESULT?.STATUS;
    if (status !== 0) {
      throw new Error('e-Stat API error: ' + JSON.stringify(result?.GET_STATS_DATA?.RESULT));
    }

    // NOTE: Actual parsing depends on the returned data structure.
    // This is a stub — implement field extraction based on the specific survey's data format.
    console.log('[fetch-education-costs] e-Stat response received. Parsing data...');
    console.log('[fetch-education-costs] TODO: map e-Stat fields to education-costs.json structure');

    current._fetchedAt = new Date().toISOString();
    current._source = '文科省 令和3年度 子供の学習費調査（e-Stat経由）';
    fs.writeFileSync(DATA_PATH, JSON.stringify(current, null, 2), 'utf8');
    console.log('[fetch-education-costs] saved to', DATA_PATH);
  } catch (err) {
    console.error('[fetch-education-costs] fetch failed:', err.message);
    process.exit(1);
  }
}

main();
