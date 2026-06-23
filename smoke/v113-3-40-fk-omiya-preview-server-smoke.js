#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const { createPreviewServer } = require('../tools/kosame-fk-omiya-preview-server');

const TEST_PORT = 18081;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  console.log('=== v113.3.40 FK Omiya Preview Server smoke ===');

  // Preview server file exists
  const serverPath = path.join(ROOT, 'tools', 'kosame-fk-omiya-preview-server.js');
  assert.ok(fs.existsSync(serverPath), 'tools/kosame-fk-omiya-preview-server.js must exist');
  console.log('  PASS server file exists');

  // Preview server exports createPreviewServer
  assert.ok(typeof createPreviewServer === 'function', 'must export createPreviewServer');
  console.log('  PASS createPreviewServer exported');

  // Security: server source must not load .env or secrets
  const serverSrc = fs.readFileSync(serverPath, 'utf8');
  assert.ok(!serverSrc.includes('OPENAI_API_KEY'), 'server must not reference OPENAI_API_KEY');
  assert.ok(!serverSrc.includes('GROQ_API_KEY'), 'server must not reference GROQ_API_KEY');
  assert.ok(!serverSrc.includes("require('dotenv')"), 'server must not require dotenv');
  assert.ok(serverSrc.includes("BLOCKED_FILENAMES"), 'server must have BLOCKED_FILENAMES guard');
  assert.ok(serverSrc.includes('path.relative(PUBLIC_DIR'), 'server must use path.relative for traversal check');
  console.log('  PASS server source security checks');

  // Start the preview server on test port
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`  server started on port ${TEST_PORT}`);

  try {
    // /healthz returns ok:true
    const health = await httpGet(`http://127.0.0.1:${TEST_PORT}/healthz`);
    assert.equal(health.status, 200, '/healthz must return 200');
    const healthBody = JSON.parse(health.body);
    assert.equal(healthBody.ok, true, '/healthz body.ok must be true');
    assert.equal(healthBody.service, 'fk-omiya-preview', '/healthz body.service must be fk-omiya-preview');
    console.log('  PASS /healthz returns {ok:true}');

    // / redirects to /fk-omiya-console.html
    const root = await httpGet(`http://127.0.0.1:${TEST_PORT}/`);
    assert.equal(root.status, 302, '/ must return 302 redirect');
    assert.ok(root.headers.location && root.headers.location.includes('fk-omiya-console.html'), '/ must redirect to /fk-omiya-console.html');
    console.log('  PASS / redirects to /fk-omiya-console.html');

    // /fk-omiya-console.html serves the demo page
    const page = await httpGet(`http://127.0.0.1:${TEST_PORT}/fk-omiya-console.html`);
    assert.equal(page.status, 200, '/fk-omiya-console.html must return 200');
    assert.ok(page.headers['content-type'] && page.headers['content-type'].includes('text/html'), 'content-type must be text/html');
    assert.ok(page.body.includes('FK Console'), '/fk-omiya-console.html must contain "FK Console"');
    console.log('  PASS /fk-omiya-console.html served correctly');

    // Security: directory traversal must be blocked
    const traversal = await httpGet(`http://127.0.0.1:${TEST_PORT}/../package.json`);
    assert.equal(traversal.status, 404, 'directory traversal must return 404');
    console.log('  PASS directory traversal blocked');

    // Security: .env must not be served
    const dotenv = await httpGet(`http://127.0.0.1:${TEST_PORT}/.env`);
    assert.equal(dotenv.status, 404, '.env must return 404');
    console.log('  PASS .env not served');

    // Unknown paths return 404
    const notFound = await httpGet(`http://127.0.0.1:${TEST_PORT}/nonexistent-file.html`);
    assert.equal(notFound.status, 404, 'unknown paths must return 404');
    console.log('  PASS unknown paths return 404');

  } finally {
    server.close();
  }

  console.log('\n✅ v113.3.40 FK Omiya Preview Server smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
