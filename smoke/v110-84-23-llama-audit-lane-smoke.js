#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const PROVIDER_CONFIG_PATH = path.join(ROOT, 'providers', 'provider-config.js');
const SNAPSHOT_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-snapshot.js');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-llama-audit-'));
const { isVersionAtLeast } = require('./version-compare');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function resetModuleCache() {
  for (const mod of [PROVIDER_CONFIG_PATH, SNAPSHOT_PATH]) {
    delete require.cache[require.resolve(mod)];
  }
}

function expectNoLeak(text, secret, label) {
  assert.ok(!String(text).includes(secret), `${label} must not leak sentinel value`);
}

async function main() {
  console.log('=== v110.84.23 llama audit lane smoke ===');
  assert.ok(pkg.scripts['smoke:v110-84-23'], 'smoke:v110-84-23 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-23'), 'verify must include smoke:v110-84-23');
  assert.ok(isVersionAtLeast(pkg.version, '110.84.23'), `package version must be 110.84.23-compatible (got ${pkg.version})`);
  console.log('  PASS: package wiring');

  const providerConfigSource = read(PROVIDER_CONFIG_PATH);
  assert.ok(providerConfigSource.includes('LLAMA_API_KEY'), 'provider-config must check LLAMA_API_KEY presence');
  assert.ok(providerConfigSource.includes('llamaAuditLane'), 'provider-config must expose llamaAuditLane');
  assert.ok(providerConfigSource.includes('audit/review'), 'provider-config must mark audit/review role');
  assert.ok(providerConfigSource.includes('sanitized diff'), 'provider-config must include allowed use list');
  assert.ok(providerConfigSource.includes('Secret'), 'provider-config must include forbidden use list');
  assert.ok(!providerConfigSource.includes('console.log(process.env.LLAMA_API_KEY'), 'provider-config must not log LLAMA_API_KEY');
  assert.ok(!providerConfigSource.includes("readFileSync('.env')"), 'provider-config must not read .env');
  assert.ok(!providerConfigSource.includes('readFileSync(".env")'), 'provider-config must not read .env');
  console.log('  PASS: provider-config source safety');

  const html = read(HTML_PATH);
  // Badge element exists in static HTML
  assert.ok(html.includes('id="chat-llama-audit-badge"'), 'HTML must include chat-llama-audit-badge element by id');
  assert.ok(html.includes('Llama audit'), 'HTML must label the lane as Llama audit');
  assert.ok(html.includes('Llama audit: missing'), 'HTML badge must initialize with "Llama audit: missing" (not a loose substring match)');
  // Render path: badge is wired to setStatusBadge, not just present in DOM
  assert.ok(
    html.includes("setStatusBadge('chat-llama-audit-badge'"),
    'render path must connect chat-llama-audit-badge via setStatusBadge'
  );
  // Render path: chatStatus.llamaAudit from snapshot drives the badge
  assert.ok(html.includes('chat.llamaAudit'), 'render path must read llamaAudit from snapshot chatStatus');
  assert.ok(html.includes('chatStatusState.llamaAudit'), 'render path must track chatStatusState.llamaAudit');
  // "configured"/"missing" values scoped to the badge update call, not loose HTML presence
  assert.ok(
    html.includes("chatStatusState.llamaAudit === 'configured' ? 'OK' : 'missing'"),
    "badge update call must map llamaAudit to 'OK'/'missing' when configured — prevents false-positive on unrelated text"
  );
  console.log('  PASS: HTML wiring (scoped to badge element and render path)');

  const sentinel = `llama-audit-sentinel-${Date.now()}`;
  const savedEnv = process.env.LLAMA_API_KEY;
  process.env.LLAMA_API_KEY = sentinel;
  resetModuleCache();
  const providerConfig = freshRequire(PROVIDER_CONFIG_PATH);
  const snapshotMod = freshRequire(SNAPSHOT_PATH);
  const config = providerConfig.getConfig();
  assert.equal(config.llamaKeyPresent, true, 'LLAMA_API_KEY presence must be detected');
  assert.equal(config.llamaAuditLane.key, 'llama_audit', 'llama audit lane key must be llama_audit');
  assert.equal(config.llamaAuditLane.role, 'audit/review', 'llama audit lane role must be audit/review');
  assert.equal(config.llamaAuditLane.status, 'configured', 'llama audit lane status must be configured');
  assert.ok(Array.isArray(config.llamaAuditLane.allowedUses), 'llama audit lane allowedUses must be an array');
  assert.ok(config.llamaAuditLane.allowedUses.includes('sanitized diff'), 'allowed uses must include sanitized diff');
  assert.ok(config.llamaAuditLane.allowedUses.includes('smoke review'), 'allowed uses must include smoke review');
  assert.ok(config.llamaAuditLane.allowedUses.includes('docs review'), 'allowed uses must include docs review');
  assert.ok(config.llamaAuditLane.allowedUses.includes('security review'), 'allowed uses must include security review');
  assert.ok(Array.isArray(config.llamaAuditLane.forbiddenUses), 'llama audit lane forbiddenUses must be an array');
  assert.ok(config.llamaAuditLane.forbiddenUses.includes('Secret'), 'forbidden uses must include Secret');
  assert.ok(config.llamaAuditLane.forbiddenUses.includes('Sales DX'), 'forbidden uses must include Sales DX');
  assert.ok(config.llamaAuditLane.forbiddenUses.includes('transcriber'), 'forbidden uses must include transcriber');
  assert.ok(config.llamaAuditLane.forbiddenUses.includes('保険ロジック'), 'forbidden uses must include 保険ロジック');
  expectNoLeak(JSON.stringify(config), sentinel, 'provider config JSON');

  const snapshot = snapshotMod.collectLiveCockpitSnapshot({
    taskVaultDir: TEMP_ROOT,
    workOrderApprovalLogPath: path.join(TEMP_ROOT, 'work-orders.jsonl'),
    shellAgentActivityLogPath: path.join(TEMP_ROOT, 'shell-agent-activity.jsonl'),
    activityEventLogPath: path.join(TEMP_ROOT, 'activity-events.jsonl'),
  });
  assert.equal(snapshot.chatStatus.llamaAudit, 'configured', 'snapshot must surface configured llama audit lane');
  expectNoLeak(JSON.stringify(snapshot), sentinel, 'snapshot JSON');
  console.log('  PASS: configured runtime snapshot');

  delete process.env.LLAMA_API_KEY;
  resetModuleCache();
  const missingConfig = freshRequire(PROVIDER_CONFIG_PATH).getConfig();
  assert.equal(missingConfig.llamaKeyPresent, false, 'missing LLAMA_API_KEY must be detected');
  assert.equal(missingConfig.llamaAuditLane.status, 'missing', 'missing lane status must be missing');
  const missingSnapshot = freshRequire(SNAPSHOT_PATH).collectLiveCockpitSnapshot({
    taskVaultDir: TEMP_ROOT,
    workOrderApprovalLogPath: path.join(TEMP_ROOT, 'work-orders.jsonl'),
    shellAgentActivityLogPath: path.join(TEMP_ROOT, 'shell-agent-activity.jsonl'),
    activityEventLogPath: path.join(TEMP_ROOT, 'activity-events.jsonl'),
  });
  assert.equal(missingSnapshot.chatStatus.llamaAudit, 'missing', 'snapshot must surface missing llama audit lane');
  console.log('  PASS: missing runtime snapshot');

  if (typeof savedEnv === 'string') {
    process.env.LLAMA_API_KEY = savedEnv;
  } else {
    delete process.env.LLAMA_API_KEY;
  }

  console.log('✅ v110.84.23 llama audit lane smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
