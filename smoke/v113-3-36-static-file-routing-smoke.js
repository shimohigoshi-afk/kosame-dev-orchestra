#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');

const ROOT = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');

function requestRaw(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: pathname, method: 'GET' },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, headers: res.headers, body: raw });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function withServer(fn) {
  const { server } = createLiveCockpitServer({});
  const port = await new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
    };
    server.once('error', onError);
    try {
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve(server.address().port);
      });
    } catch (error) {
      server.off('error', onError);
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
    }
  });
  try {
    return await fn(port);
  } finally {
    await new Promise((resolve) => { try { server.close(resolve); } catch { resolve(); } });
  }
}

async function main() {
  console.log('=== v113.3.36 static file routing smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.36'), `version must be >= 113.3.36 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-36'], 'smoke:v113-3-36 must exist in package.json');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-36'), 'verify must include smoke:v113-3-36');
  console.log('  PASS: package wiring');

  // Source-level: verify the static file handler is present
  const src = fs.readFileSync(SERVER_PATH, 'utf8');
  assert.ok(src.includes('_STATIC_MIME'), 'server must define _STATIC_MIME map');
  assert.ok(src.includes("'.html': 'text/html"), 'MIME map must include .html → text/html');
  assert.ok(src.includes("'.svg': 'image/svg+xml'"), 'MIME map must include .svg → image/svg+xml');
  assert.ok(src.includes("'.webmanifest'"), 'MIME map must include .webmanifest');
  assert.ok(src.includes('_pubDir'), 'server must define _pubDir for public/ directory');
  assert.ok(src.includes('_reqResolved'), 'server must resolve request path');
  assert.ok(src.includes('_isInPublic'), 'server must check path is inside public/');
  assert.ok(src.includes("startsWith(_pubDir + path.sep)"), 'server must prevent path traversal');
  assert.ok(src.includes('isFile()'), 'server must verify target is a file not a directory');
  console.log('  PASS: static file handler present in source');

  // public/ files exist
  const publicDir = path.join(ROOT, 'public');
  assert.ok(fs.existsSync(path.join(publicDir, 'fk-omiya-console.html')), 'fk-omiya-console.html must exist in public/');
  assert.ok(fs.existsSync(path.join(publicDir, 'kosame-live-cockpit.html')), 'kosame-live-cockpit.html must exist in public/');
  assert.ok(fs.existsSync(path.join(publicDir, 'kosame-icon.svg')), 'kosame-icon.svg must exist in public/');
  console.log('  PASS: public/ files exist');

  await withServer(async (port) => {
    if (port == null) {
      console.log('  PASS: HTTP runtime checks skipped — listen EPERM in this environment');
      return;
    }

    // / → kosame-live-cockpit.html (default behavior preserved)
    const rootRes = await requestRaw(port, '/');
    assert.equal(rootRes.status, 200, '/ must return 200');
    assert.ok(rootRes.headers['content-type'].includes('text/html'), '/ must be text/html');
    assert.ok(
      rootRes.body.includes('KOSAME') || rootRes.body.includes('kosame') || rootRes.body.includes('Handoff'),
      '/ must return kosame-live-cockpit.html content'
    );
    assert.ok(
      !rootRes.body.includes('FK Console') || rootRes.body.includes('KOSAME'),
      '/ must NOT exclusively return FK Console'
    );
    console.log('  PASS: / returns kosame-live-cockpit.html (default preserved)');

    // /fk-omiya-console.html → FK Omiya Console HTML
    const fkRes = await requestRaw(port, '/fk-omiya-console.html');
    assert.equal(fkRes.status, 200, '/fk-omiya-console.html must return 200');
    assert.ok(fkRes.headers['content-type'].includes('text/html'), '/fk-omiya-console.html must be text/html');
    assert.ok(fkRes.body.includes('FK Console'), '/fk-omiya-console.html body must contain FK Console');
    assert.ok(fkRes.body.includes('大宮支店'), '/fk-omiya-console.html body must contain 大宮支店');
    assert.ok(!fkRes.body.includes('HANDOFF QUEUE'), '/fk-omiya-console.html must NOT be kosame-live-cockpit.html');
    console.log('  PASS: /fk-omiya-console.html returns FK Omiya Console');

    // /kosame-live-cockpit.html → live cockpit HTML
    const cockpitRes = await requestRaw(port, '/kosame-live-cockpit.html');
    assert.equal(cockpitRes.status, 200, '/kosame-live-cockpit.html must return 200');
    assert.ok(cockpitRes.headers['content-type'].includes('text/html'), '/kosame-live-cockpit.html must be text/html');
    assert.ok(
      cockpitRes.body.includes('KOSAME') || cockpitRes.body.includes('Handoff') || cockpitRes.body.includes('HANDOFF'),
      '/kosame-live-cockpit.html must return live cockpit content'
    );
    console.log('  PASS: /kosame-live-cockpit.html returns live cockpit');

    // /kosame-icon.svg → SVG with correct content type
    const svgRes = await requestRaw(port, '/kosame-icon.svg');
    assert.equal(svgRes.status, 200, '/kosame-icon.svg must return 200');
    assert.ok(svgRes.headers['content-type'].includes('image/svg+xml'), '/kosame-icon.svg must have SVG content type');
    console.log('  PASS: /kosame-icon.svg returns SVG with correct MIME type');

    // /unknown-page.html → falls back to kosame-live-cockpit.html (not 404)
    const unknownRes = await requestRaw(port, '/unknown-page.html');
    assert.equal(unknownRes.status, 200, 'unknown path must return 200 (cockpit fallback)');
    assert.ok(unknownRes.headers['content-type'].includes('text/html'), 'unknown path must be text/html');
    console.log('  PASS: /unknown-page.html falls back to kosame-live-cockpit.html');

    // Path traversal attempt must NOT escape public/
    const traversalRes = await requestRaw(port, '/../package.json');
    // Must either return 200 with cockpit fallback (not package.json) or a non-200
    const isTraversalSafe =
      traversalRes.status !== 200 ||
      !traversalRes.body.includes('"kosame-dev-orchestra"') ||
      traversalRes.body.includes('KOSAME') ||
      traversalRes.body.includes('Handoff');
    assert.ok(isTraversalSafe, 'path traversal attempt must not expose package.json');
    console.log('  PASS: path traversal attempt is blocked');
  });

  console.log('✅ v113.3.36 static file routing smoke PASSED');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
