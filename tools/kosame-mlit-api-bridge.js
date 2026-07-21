#!/usr/bin/env node
'use strict';

/**
 * Kosame MLIT API Bridge
 * 国土交通省 不動産情報ライブラリ API のローカルプロキシサーバー
 *
 * Usage:
 *   REINFOLIB_API_KEY=your_key node tools/kosame-mlit-api-bridge.js
 *
 * Endpoints:
 *   GET /api/health
 *   GET /api/realestate?city=11103&years=2023,2024,2025
 */

const http = require('node:http');
const https = require('node:https');
const url = require('node:url');
const zlib = require('node:zlib');

const PORT = parseInt(process.env.PORT || process.env.MLIT_BRIDGE_PORT || '3002', 10);
const MLIT_API_KEY = process.env.REINFOLIB_API_KEY || process.env.MLIT_API_KEY || '';
const MLIT_BASE = 'https://www.reinfolib.mlit.go.jp/ex-api/external';

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

function decompressBody(rawBuffer, encoding) {
  if (!encoding || encoding === 'identity') return rawBuffer;
  if (encoding === 'gzip' || encoding === 'x-gzip') return zlib.gunzipSync(rawBuffer);
  if (encoding === 'deflate') return zlib.inflateSync(rawBuffer);
  if (encoding === 'br') return zlib.brotliDecompressSync(rawBuffer);
  return rawBuffer;
}

// 汎用GeoJSON取得（XPT001/XPT002共通・モジュールスコープ）
function mlitGeoFetch(apiCode, params, apiKey) {
  return new Promise((resolve, reject) => {
    if (apiCode !== 'XPT001' && apiCode !== 'XPT002') { reject(new Error('MLIT_INVALID_API_CODE:'+apiCode)); return; }
    var urlStr = MLIT_BASE + '/' + apiCode;
    var parts = [];
    Object.keys(params).forEach(function(k) { var v = params[k]; if (v !== undefined && v !== null && v !== '') parts.push(encodeURIComponent(k)+'='+encodeURIComponent(String(v))); });
    if (parts.length) urlStr += '?' + parts.join('&');
    var opts = { headers: { 'X-API-KEY': apiKey, 'Ocp-Apim-Subscription-Key': apiKey, 'Accept-Encoding': 'gzip, deflate, br' }, timeout: 15000 };
    var chunks = [];
    var req = https.get(urlStr, opts, function(upstreamRes) {
      upstreamRes.on('data', function(c) { chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c)); });
      upstreamRes.on('end', function() {
        var buf = Buffer.concat(chunks), sc = upstreamRes.statusCode;
        var ce = String(upstreamRes.headers['content-encoding']||'').toLowerCase();
        if (sc !== 200) { var ep = buf.toString('utf8').substring(0,300).replace(/[\x00-\x1f]/g,''); console.error('[MLIT Bridge] '+apiCode+' error:',sc,'body:',ep); reject(new Error('MLIT_UPSTREAM_'+sc)); return; }
        var db; try { db = decompressBody(buf, ce); } catch(e) { reject(new Error('MLIT_DECOMPRESS_ERROR')); return; }
        var t = db.toString('utf8').replace(/^\uFEFF/,'').trim();
        try { resolve(JSON.parse(t)); } catch(e) { reject(new Error('MLIT_JSON_PARSE_ERROR')); }
      });
    });
    req.on('timeout', function() { req.destroy(); reject(new Error('MLIT_API_TIMEOUT')); });
    req.on('error', reject);
  });
}

function mlitFetch(params, apiKey, cityCode, year) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const reqUrl = `${MLIT_BASE}/XIT001?${query}`;
    const opts = {
      headers: {
        'X-API-KEY': apiKey,
        'Ocp-Apim-Subscription-Key': apiKey,
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 15000,
    };
    const chunks = [];
    const req = https.get(reqUrl, opts, (upstreamRes) => {
      upstreamRes.on('data', chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      upstreamRes.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const statusCode = upstreamRes.statusCode;
        const contentType = String(upstreamRes.headers['content-type'] || '').toLowerCase();
        const contentEncoding = String(upstreamRes.headers['content-encoding'] || '').toLowerCase();

        // 診断ログ（APIキーを含まない）
        console.error('[MLIT Bridge] upstream {',
          'city:', cityCode, 'year:', year,
          'status:', statusCode,
          'contentType:', contentType,
          'contentEncoding:', contentEncoding || 'none',
          'bytes:', rawBuffer.length, '}');

        // 上流HTTPエラーの区別
        if (statusCode === 401 || statusCode === 403) {
          reject(new Error('MLIT_API_AUTH_ERROR:' + statusCode));
          return;
        }
        if (statusCode === 429) {
          reject(new Error('MLIT_API_RATE_LIMIT:' + statusCode));
          return;
        }
        if (statusCode >= 500) {
          reject(new Error('MLIT_UPSTREAM_ERROR:' + statusCode));
          return;
        }
        if (statusCode !== 200) {
          reject(new Error('MLIT_UPSTREAM_HTTP_' + statusCode));
          return;
        }

        // 圧縮解凍（指定encodingがあればそれを使い、失敗時・未指定時は全方式を試行）
        let decodedText = null;
        const encodingsToTry = [];
        if (contentEncoding) {
          encodingsToTry.push(contentEncoding);
        }
        encodingsToTry.push('gzip', 'deflate', 'br', 'identity');

        for (const enc of encodingsToTry) {
          try {
            const buf = enc === 'identity' ? rawBuffer : decompressBody(rawBuffer, enc);
            let text = buf.toString('utf8');
            text = text.replace(/^\uFEFF/, '').trim();
            if (text.startsWith('{') || text.startsWith('[')) {
              try {
                const parsed = JSON.parse(text);
                if (enc !== (contentEncoding || 'identity')) {
                  console.error('[MLIT Bridge] actual encoding:', enc, '(header said:', contentEncoding || 'none', ')');
                }
                resolve(parsed);
                return;
              } catch (_) { /* このencodingではparseできず */ }
            }
          } catch (_) { /* 解凍失敗 */ }
        }
        reject(new Error('MLIT_JSON_PARSE_ERROR'));
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('MLIT_API_TIMEOUT')); });
    req.on('error', reject);
  });
}

// 安全なフィールド取得: 複数キー名を順に試行
function pickField(item, primaryKey, fallbackKey) {
  var v = item[primaryKey];
  if (v !== undefined && v !== null && v !== '') return v;
  v = item[fallbackKey];
  if (v !== undefined && v !== null && v !== '') return v;
  return '';
}
// 種類フィールド専用: 複数の可能性を試行
function pickTypeField(item) {
  var keys = ['Type', '種類', '取引の種類等', '不動産の種類', '取引種別', 'PropertyType', 'TransactionType'];
  for (var i = 0; i < keys.length; i++) {
    var v = item[keys[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}
// 種類名を全角括弧へ正規化（API実値: 宅地(土地) → 宅地（土地））
function normalizePropertyType(value) {
  return String(value == null ? '' : value).trim().replace(/\(/g, '（').replace(/\)/g, '）');
}

// XIT001 実レスポンスから宅地（土地）のみを採用
var _normalizeLoggedTypes = false;
var _normalizeLoggedKeys = false;
function normalizeMLIT(raw, area, propertyType) {
  if (!raw || !Array.isArray(raw.data)) return [];
  // 初回のみ実際のフィールド名をログ出力
  if (!_normalizeLoggedKeys && raw.data.length > 0) {
    _normalizeLoggedKeys = true;
    var sampleKeys = Object.keys(raw.data[0]);
    console.error('[MLIT Bridge] actual API field names: ' + JSON.stringify(sampleKeys));
  }
  var all = raw.data.map(function(item) {
    var kind = normalizePropertyType(pickTypeField(item));
    var tradePriceRaw = pickField(item, 'TradePrice', '取引価格（総額）');
    var totalPrice = parseInt((tradePriceRaw || '0').replace(/[^\d]/g, ''), 10) / 10000;
    var areaM2 = parseFloat(pickField(item, 'Area', '面積（㎡）') || '0');
    var pricePer = areaM2 > 0 ? Math.round(totalPrice / (areaM2 / 3.3058)) : 0;
    return {
      type: kind,
      area: area || pickField(item, 'Prefecture', '都道府県名') + pickField(item, 'Municipality', '市区町村名'),
      districtName: pickField(item, 'DistrictName', '地区名'),
      location: pickField(item, 'DistrictName', '地区名') + (pickField(item, 'NearestStation', '最寄駅：名称') ? ' ' + pickField(item, 'NearestStation', '最寄駅：名称') + '駅' : ''),
      pricePer: pricePer,
      size: areaM2,
      totalPrice: Math.round(totalPrice),
      year: parseInt(pickField(item, 'Period', '取引時点') || '2023', 10),
      note: pickField(item, 'Structure', '建物の構造') || pickField(item, 'Use', '用途'),
      floorPlan: pickField(item, 'FloorPlan', '間取り'),
      buildingYear: pickField(item, 'BuildingYear', '建築年'),
      renovation: pickField(item, 'Renovation', '改装'),
    };
  });
  // 診断: 実タイプ一覧をログ出力
  if (!_normalizeLoggedTypes && all.length > 0) {
    _normalizeLoggedTypes = true;
    var tc = {}; all.forEach(function(r) { tc[r.type] = (tc[r.type] || 0) + 1; });
    console.error('[MLIT Bridge] record types: ' + JSON.stringify(tc));
  }
  var filtered;
  if (propertyType === 'condo') {
    filtered = all.filter(function(r) { return r.totalPrice > 0 && r.size > 0 && r.type === '中古マンション等'; });
  } else {
    filtered = all.filter(function(r) { return r.totalPrice > 0 && r.size > 0 && r.type === '宅地（土地）'; });
  }
  return filtered;
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
      version: '0.3.0',
      mlitKeyConfigured: !!MLIT_API_KEY,
      port: PORT,
    });
    return;
  }

  if (pathname === '/api/realestate') {
    const q = parsed.query;
    const apiKey = q.apiKey || MLIT_API_KEY;

    if (!apiKey) {
      sendJSON(res, 503, { ok: false, code: 'LAND_API_NOT_CONFIGURED', message: '土地取引情報APIが設定されていません' });
      return;
    }

    const cityCode = q.city || '';
    const yearsStr = q.years || '';
    const propertyType = q.propertyType || 'land';
    const priceClassification = q.priceClassification || '01'; // 01=取引価格, 02=成約価格

    // cityCode 入力検証: 5桁数字
    if (!/^\d{5}$/.test(cityCode)) {
      sendJSON(res, 400, { ok: false, code: 'INVALID_CITY_CODE', message: '市区町村コードは5桁の数字で指定してください' });
      return;
    }

    // years 解析: カンマ区切り
    const years = [];
    if (yearsStr) {
      yearsStr.split(',').forEach(function(y) {
        var n = parseInt(y, 10);
        if (n >= 2000 && n <= 2100 && years.indexOf(n) < 0) years.push(n);
      });
    }
    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    // 各年を個別取得し統合。成功/失敗を年単位で追跡
    const promises = years.map(function(year) {
      const params = { year: year.toString(), city: cityCode, priceClassification: priceClassification };
      return mlitFetch(params, apiKey, cityCode, year).then(function(raw) {
        return { year: year, ok: true, data: normalizeMLIT(raw, '', propertyType) };
      }).catch(function(err) {
        console.error('[MLIT Bridge] year ' + year + ' fetch error:', err.message);
        return { year: year, ok: false, error: err.message };
      });
    });

    Promise.all(promises).then(function(results) {
      var succeeded = results.filter(function(r) { return r.ok; });
      var failed = results.filter(function(r) { return !r.ok; });

      // 全年度失敗: APIエラーとして扱う
      if (succeeded.length === 0 && failed.length > 0) {
        var firstErr = failed[0].error || 'MLIT API error';
        sendJSON(res, 502, { ok: false, error: firstErr, source: 'mlit-live' });
        return;
      }

      // 成功年度のデータを統合
      var all = []; succeeded.forEach(function(r) { all = all.concat(r.data); });
      // 重複除去
      var seen = {};
      var deduped = all.filter(function(r) {
        var key = r.type + '|' + r.totalPrice + '|' + r.size + '|' + r.districtName;
        if (seen[key]) return false; seen[key] = true; return true;
      });

      sendJSON(res, 200, {
        ok: true,
        count: deduped.length,
        data: deduped,
        requestedYears: years,
        succeededYears: succeeded.map(function(r) { return r.year; }),
        failedYears: failed.map(function(r) { return r.year; }),
        partial: failed.length > 0 && succeeded.length > 0,
        source: 'mlit-live'
      });
    }).catch(function(err) {
      console.error('[MLIT Bridge] fetch error:', err.message);
      sendJSON(res, 502, { error: err.message, source: 'mlit-live' });
    });
    return;
  }

  // XPT002: 地価公示・都道府県地価調査（標準地・基準地）3×3タイル取得
  if (pathname === '/api/land-value') {
    const q = parsed.query;
    const apiKey = q.apiKey || MLIT_API_KEY;
    if (!apiKey) {
      sendJSON(res, 503, { ok: false, code: 'LAND_API_NOT_CONFIGURED', message: '土地取引情報APIが設定されていません' });
      return;
    }
    var lat = parseFloat(q.lat) || 0, lng = parseFloat(q.lng) || 0;
    var year = q.year || '2024';
    if (!lat || !lng) { sendJSON(res, 400, { ok: false, error: 'lat/lng required' }); return; }
    function toTileX(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
    function toTileY(lat, z) { var r = Math.tan(lat * Math.PI / 180); return Math.floor((1 - Math.log(r + 1/Math.cos(lat * Math.PI / 180)) / Math.PI) * Math.pow(2, z - 1)); }
    function haversineM(lat1, lng1, lat2, lng2) {
      var R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
      var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    var z = 15, cx = toTileX(lng, z), cy = toTileY(lat, z);
    var tileReqs = [];
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
      tileReqs.push({ x: cx+dx, y: cy+dy, z: z, response_format: 'geojson', year: year });
    }
    var rawFeatureCount = 0, invalidPrice = 0, invalidGeom = 0, dupPointId = 0, dupStandard = 0;
    var seenPointIds = {}, seenStdNums = {};
    var succeededTiles = 0, failedTiles = 0;
    Promise.allSettled(tileReqs.map(function(t) {
      return mlitGeoFetch('XPT002', t, apiKey).then(function(raw) { succeededTiles++; return raw; }).catch(function(e) { failedTiles++; console.error('[MLIT Bridge] XPT002 tile failed:', e.message); return null; });
    })).then(function(results) {
      var points = [];
      results.forEach(function(r) {
        if (!r || r.status !== 'fulfilled' || !r.value) return;
        var raw = r.value;
        var features = raw.features || [];
        if (!Array.isArray(features)) return;
        features.forEach(function(feature) {
          rawFeatureCount++;
          var p = feature.properties || {};
          if (!p) { invalidPrice++; return; }
          /* 価格: "152,000(円/㎡)"形式 */
          var priceRaw = String(p['u_current_years_price_ja'] || '');
          function parseYenPerM2(v) { var s = String(v||'').replace(/,/g,'').replace(/[^0-9.]/g,''); var n = parseFloat(s); return isNaN(n) ? 0 : n; }
          var priceYenPerM2 = parseYenPerM2(priceRaw);
          if (priceYenPerM2 <= 0) { invalidPrice++; return; }
          /* 座標: feature.geometry.coordinates */
          var geom = feature.geometry || {};
          var coords = geom.coordinates;
          var lngVal = Array.isArray(coords) ? Number(coords[0]) : 0;
          var latVal = Array.isArray(coords) ? Number(coords[1]) : 0;
          if (!lngVal || !latVal) { invalidGeom++; return; }
          /* point_id重複排除 */
          var pid = p['point_id'] || '';
          if (pid && seenPointIds[pid]) { dupPointId++; return; }
          if (pid) seenPointIds[pid] = true;
          else {
            var sn = p['standard_lot_number_ja'] || '';
            if (sn && seenStdNums[sn]) { dupStandard++; return; }
            if (sn) seenStdNums[sn] = true;
          }
          var dist = haversineM(lat, lng, latVal, lngVal);
          var priceManPerM2 = priceYenPerM2 / 10000;
          points.push({
            source: 'XPT002',
            pointId: pid,
            standardNumber: p['standard_lot_number_ja'] || '',
            location: p['location'] || [p['prefecture_name_ja'], p['city_county_name_ja'], p['ward_town_village_name_ja'], p['location_number_ja']].filter(Boolean).join(''),
            residenceDisplay: p['residence_display_name_ja'] || '',
            cityCode: p['city_code'] || '',
            use: p['use_category_name_ja'] || '',
            regulationUse: p['regulations_use_category_name_ja'] || '',
            priceYenPerM2: priceYenPerM2,
            priceManPerM2: priceManPerM2,
            lastYearPriceYenPerM2: Number(p['last_years_price']) || 0,
            targetDate: p['target_year_name_ja'] || '',
            yearOnYearChangeRate: parseFloat(p['year_on_year_change_rate']) || 0,
            nearestStation: p['nearest_station_name_ja'] || '',
            stationDistance: p['u_road_distance_to_nearest_station_name_ja'] || '',
            frontRoadCondition: p['front_road_condition'] || '',
            frontRoadWidth: (Number(p['front_road_width']) || 0) / 10,
            buildingCoverageRatio: parseFloat(String(p['u_regulations_building_coverage_ratio_ja']||'').replace(/[^0-9.]/g,'')) || 0,
            floorAreaRatio: parseFloat(String(p['u_regulations_floor_area_ratio_ja']||'').replace(/[^0-9.]/g,'')) || 0,
            surroundingUse: p['current_usage_status_of_surrounding_land_name_ja'] || '',
            landPriceType: Number(p['land_price_type']) || 0,
            landPriceTypeName: Number(p['land_price_type']) === 0 ? '地価公示' : Number(p['land_price_type']) === 1 ? '都道府県地価調査' : '地価公示等',
            lat: latVal, lng: lngVal, distanceMeters: Math.round(dist),
          });
        });
      });
      points.sort(function(a,b){ return (a.distanceMeters||999999) - (b.distanceMeters||999999); });
      var stats = { raw: rawFeatureCount, invalidPrice: invalidPrice, invalidGeom: invalidGeom, dupPointId: dupPointId, dupStandard: dupStandard, normalized: points.length };
      sendJSON(res, 200, { ok: true, count: points.length, rawFeatureCount: rawFeatureCount, normalizationStats: stats, successfulTiles: succeededTiles, failedTiles: failedTiles, partial: failedTiles > 0, data: points, source: 'XPT002' });
    }).catch(function(err) { sendJSON(res, 502, { error: err.message, source: 'XPT002' }); });
    return;
  }

  // XPT001: 不動産取引価格情報（3×3タイル取得・駅単位集約用）
  if (pathname === '/api/land-cases') {
    const q = parsed.query;
    const apiKey = q.apiKey || MLIT_API_KEY;
    if (!apiKey) { sendJSON(res, 503, { ok: false, code: 'LAND_API_NOT_CONFIGURED', message: '土地取引情報APIが設定されていません' }); return; }
    var lat = parseFloat(q.lat) || 0, lng = parseFloat(q.lng) || 0;
    var from = q.from || '20211', to = q.to || '20254';
    var pc = q.priceClassification || '01', ltc = q.landTypeCode || '01';
    if (!lat || !lng) { sendJSON(res, 400, { ok: false, error: 'lat/lng required' }); return; }
    function toTileX(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
    function toTileY(lat, z) { var r = Math.tan(lat * Math.PI / 180); return Math.floor((1 - Math.log(r + 1/Math.cos(lat * Math.PI / 180)) / Math.PI) * Math.pow(2, z - 1)); }
    function haversineM(lat1, lng1, lat2, lng2) {
      var R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
      var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    var z = 15, cx = toTileX(lng, z), cy = toTileY(lat, z);
    var tileReqs = [];
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
      tileReqs.push({ z: z, x: cx+dx, y: cy+dy, response_format: 'geojson', from: from, to: to, priceClassification: pc, landTypeCode: ltc });
    }
    var succeededTiles = 0, failedTiles = 0;
    Promise.allSettled(tileReqs.map(function(t) {
      return mlitGeoFetch('XPT001', t, apiKey).then(function(raw) { succeededTiles++; return raw; }).catch(function(e) { failedTiles++; console.error('[MLIT Bridge] XPT001 tile ' + t.x + ',' + t.y + ' failed:', e.message); return null; });
    })).then(function(results) {
      var allRecords = [], seen = {}, totalRawFeatures = 0;
      results.forEach(function(r) {
        if (!r || r.status !== 'fulfilled' || !r.value) return;
        var raw = r.value;
        var features = raw.features || raw.data || [];
        if (Array.isArray(features)) {
          totalRawFeatures += features.length;
          features.forEach(function(feature) {
            var props = feature.properties || feature;
            var geom = feature.geometry || {};
            /* XPT001実キー: 日本語snake_case。valueは単位付き文字列（"12,000万円"形式） */
            /* 金額専用パーサー: "240万円"→240, "2400000円"→240 */
            function parseMoneyManYen(v) { if (v == null || v === '') return 0; var s = String(v).replace(/,/g,'').replace(/[\s\u3000]/g,''); if (s.includes('万円')) return parseFloat(s.replace('万円','')) || 0; if (s.endsWith('円')) { var y = parseFloat(s.replace('円','')) || 0; return y / 10000; } return parseFloat(s) || 0; }
            function parseJPNum(v) { if (v == null || v === '') return null; var s = String(v).replace(/[,\s\u3000]/g,'').replace(/万円|万|円|㎡|m|%|（|）|\(|\)/g,'').trim(); var n = parseFloat(s); return isNaN(n) ? null : n; }
            var tp = parseMoneyManYen(props['u_transaction_price_total_ja'] || props['TradePrice'] || props['取引価格（総額）']);
            var sz = parseFloat(props['u_area_ja'] || props['Area'] || props['面積（㎡）'] || '0');
            /* 面積が単位付き文字列の場合（"400㎡"） */
            if (isNaN(sz) && typeof (props['u_area_ja']||props['Area']) === 'string') sz = parseJPNum(props['u_area_ja']||props['Area']) || 0;
            var glat = 0, glng = 0;
            if (geom.coordinates) { glng = geom.coordinates[0] || 0; glat = geom.coordinates[1] || 0; }
            allRecords.push({
              source: 'XPT001',
              pointInTime: props['point_in_time_name_ja'] || '',
              landType: props['land_type_name_ja'] || '',
              priceClassification: props['price_information_category_name_ja'] || '01',
              cityCode: props['city_code'] || props['CityCode'] || '',
              cityName: props['city_name_ja'] || props['CityName'] || '',
              districtCode: props['district_code'] || props['DistrictCode'] || '',
              districtName: props['district_name_ja'] || props['DistrictName'] || '',
              useCategory: props['use_category_name_ja'] || '',
              totalPrice: Math.round(tp) || 0,
              areaM2: sz || 0,
              unitPriceM2: props['u_transaction_price_unit_price_square_meter_ja'] ? parseJPNum(props['u_transaction_price_unit_price_square_meter_ja']) : (sz > 0 && tp !== null ? Math.round(tp / sz) : 0),
              unitPriceTsubo: props['u_unit_price_per_tsubo_ja'] ? parseJPNum(props['u_unit_price_per_tsubo_ja']) : 0,
              landShape: props['land_shape_name_ja'] || '',
              frontage: props['u_land_frontage_ja'] ? parseJPNum(props['u_land_frontage_ja']) : null,
              frontRoadDirection: props['front_road_azimuth_name_ja'] || '',
              frontRoadWidth: props['u_front_road_width_ja'] ? parseJPNum(props['u_front_road_width_ja']) : null,
              frontRoadType: props['front_road_type_name_ja'] || '',
              landUse: props['land_use_name_ja'] || '',
              buildingCoverageRatio: props['u_building_coverage_ratio_ja'] ? parseJPNum(props['u_building_coverage_ratio_ja']) : null,
              floorAreaRatio: props['u_floor_area_ratio_ja'] ? parseJPNum(props['u_floor_area_ratio_ja']) : null,
              remarks: props['remark_name_ja'] || '',
              futureUse: props['future_use_purpose_name_ja'] || '',
              stationLat: glat || null, stationLng: glng || null,
            });
          });
        }
      });
      var stationMap = {}, stats = { raw: totalRawFeatures, normalized: allRecords.length };
      allRecords.forEach(function(r) {
        if (!r.stationLat || !r.stationLng) return;
        var key = r.stationLat.toFixed(4) + ',' + r.stationLng.toFixed(4);
        if (!stationMap[key]) stationMap[key] = { lat: r.stationLat, lng: r.stationLng, records: [], stationName: '' };
        stationMap[key].records.push(r);
        if (!stationMap[key].stationName && r.districtName) stationMap[key].stationName = r.districtName;
      });
      var stations = Object.values(stationMap);
      if (succeededTiles === 0 && failedTiles > 0) {
        sendJSON(res, 502, { ok: false, error: 'XPT001 upstream request failed', failedTiles: failedTiles, source: 'XPT001' });
      } else {
        sendJSON(res, 200, { ok: true, count: allRecords.length, rawFeatureCount: totalRawFeatures, normalizationStats: stats, stationCount: stations.length, successfulTiles: succeededTiles, failedTiles: failedTiles, partial: failedTiles > 0, stations: stations.map(function(s){return{lat:s.lat,lng:s.lng,count:s.records.length,stationName:s.stationName}}), data: allRecords, source: 'XPT001' });
      }
    }).catch(function(err) { sendJSON(res, 502, { error: err.message, source: 'XPT001' }); });
    return;
  }

  sendJSON(res, 404, { error: 'Not found', paths: ['/api/health', '/api/realestate', '/api/land-value', '/api/land-cases'] });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[MLIT Bridge] Listening on http://localhost:' + PORT);
  console.log('[MLIT Bridge] API key:', MLIT_API_KEY ? 'configured' : 'not set');
  console.log('[MLIT Bridge] Health: http://localhost:' + PORT + '/api/health');
});

server.on('error', (err) => {
  console.error('[MLIT Bridge] Server error:', err.message);
  process.exit(1);
});
