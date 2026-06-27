#!/usr/bin/env node
'use strict';

/**
 * v113.3.63 codex-exec-instruction smoke test
 *
 * Claude Code 用の指示文が `codex exec` ベースに切り替わっていることを検証する。
 */

const assert = require('node:assert/strict');
const http   = require('node:http');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const {
  TOOL_META,
  generateClaudeCodeInstruction,
  routeTask,
  createDevOsServer,
} = require('../tools/kosame-dev-os-router');

function reqServer(server, urlPath, body, method) {
  method = method || (body ? 'POST' : 'GET');
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const port = server.address().port;
    const r = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        : {},
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }); }
        catch { reject(new Error(`JSON parse error: ${raw.slice(0, 80)}`)); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function withServer(createFn, fn) {
  return new Promise((resolve, reject) => {
    const server = createFn();
    server.listen(0, '127.0.0.1', async () => {
      try { resolve(await fn(server)); }
      catch (e) { reject(e); }
      finally { server.close(); }
    });
    server.once('error', reject);
  });
}

async function main() {
  console.log('=== v113.3.63 codex-exec-instruction smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.63'), `version must be >= 113.3.63 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-63'], 'smoke:v113-3-63 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-63'), 'verify must include smoke:v113-3-63');
  console.log('  PASS: package wiring');

  assert.ok(isVersionAtLeast(TOOL_META.version, '113.3.63'), `TOOL_META.version must be >= 113.3.63 (got ${TOOL_META.version})`);
  assert.strictEqual(TOOL_META.feature, 'v113-3-63-codex-exec-instruction', 'feature slug must match');
  console.log(`  PASS: TOOL_META.version >= 113.3.63 (${TOOL_META.version})`);

  const instr = generateClaudeCodeInstruction('テストタスク');
  assert.ok(instr.includes('codex exec'), 'instruction must use codex exec');
  assert.ok(!instr.includes('claude -p --dangerously-skip-permissions'), 'instruction must not use claude -p --dangerously-skip-permissions');
  assert.ok(instr.includes('git add -A禁止'), 'instruction must include git add -A禁止');
  assert.ok(instr.includes('テストタスク'), 'instruction must include task');
  console.log('  PASS: generateClaudeCodeInstruction uses codex exec');

  const routed = routeTask('温度感分析を改善して');
  assert.equal(routed.route, 'claude_code', 'implementation task must route to claude_code');
  assert.equal(routed.instructionFormat, 'bash_script', 'claude_code format must be bash_script');
  assert.ok(routed.instruction.includes('codex exec'), 'routeTask instruction must use codex exec');
  console.log('  PASS: routeTask implementation path');

  try {
    const httpRes = await withServer(createDevOsServer, (s) =>
      reqServer(s, '/api/dev-os', { task: '温度感分析を改善して' })
    );
    assert.equal(httpRes.status, 200, 'POST /api/dev-os must return 200');
    assert.equal(httpRes.body.route, 'claude_code', 'HTTP route must be claude_code');
    assert.equal(httpRes.body.instruction_format, 'bash_script', 'HTTP format must be bash_script');
    assert.ok(httpRes.body.instruction.includes('codex exec'), 'HTTP instruction must use codex exec');
    console.log('  PASS: POST /api/dev-os instruction uses codex exec');
  } catch (e) {
    if (e && e.code === 'EPERM') {
      console.log('  SKIP: HTTP listen EPERM in this environment');
    } else {
      throw e;
    }
  }

  console.log('\n✅ v113.3.63 codex-exec-instruction smoke PASSED');
}

main().catch((e) => {
  console.error(`\n✗ FAILED: ${e.message}`);
  process.exit(1);
});
