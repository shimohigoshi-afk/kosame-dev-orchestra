#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'kosame-sales-console.html'), 'utf8');
const bridge = fs.readFileSync(path.join(__dirname, '..', 'tools', 'kosame-mlit-api-bridge.js'), 'utf8');

assert.match(html, /function landCommitPoint\(/, 'explicit point commit pipeline exists');
assert.match(html, /new AbortController\(\)/, 'previous land request is abortable');
assert.match(html, /seq!==_landSeqId/, 'stale response guard exists');
assert.match(html, /_landCommittedKey/, 'duplicate point searches are suppressed');
assert.match(html, /\/api\/land-cases\?/, 'XPT001 bridge route is used');
assert.match(html, /\/api\/land-value\?/, 'XPT002 bridge route is used');
assert.doesNotMatch(html, /_landMap\.on\(['"](?:move|moveend|zoom|zoomend|drag)/, 'map browsing cannot start a search');
assert.match(html, /_landMapElement !== el/, 'detached workspace map is not reused');
assert.match(html, /APIエラー — MLIT Bridge/, 'API errors have an explicit state');
assert.match(html, /実データ0件/, 'zero-result state is explicit');
assert.match(bridge, /pathname === '\/api\/land-cases'/, 'bridge exposes XPT001 normalization');
assert.match(bridge, /pathname === '\/api\/land-value'/, 'bridge exposes XPT002 normalization');
assert.doesNotMatch(bridge, /(?:REINFOLIB_API_KEY|MLIT_API_KEY)\s*=\s*['"][^'"]{8,}/, 'no API credential is embedded');

console.log('land runtime stability smoke PASSED');
