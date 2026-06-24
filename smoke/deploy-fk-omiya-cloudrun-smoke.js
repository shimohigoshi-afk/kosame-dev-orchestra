#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('=== deploy-fk-omiya Cloud Run config smoke ===');

  // ① deploy script: PORT を --set-env-vars に含まない
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy-fk-omiya.sh'), 'utf8');
  assert.ok(!script.includes('PORT=8080'), 'deploy script must NOT set PORT=8080 in env vars (Cloud Run reserved)');
  assert.ok(script.includes('NODE_ENV=production'), 'deploy script must still set NODE_ENV');
  assert.ok(script.includes('--port=8080'), 'deploy script must keep --port=8080 flag for Cloud Run listener');
  assert.ok(script.includes('DEPLOY_APPROVED'), 'deploy script must have approval gate');
  assert.ok(script.includes('DEPLOY'), 'deploy script must require DEPLOY confirmation');
  console.log('  PASS ① deploy script: PORTをenv-varsから除外、approval gate存在');

  // ② Dockerfile.fk-omiya-console: ENV PORT なし
  const consoleDockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile.fk-omiya-console'), 'utf8');
  assert.ok(!consoleDockerfile.includes('ENV PORT'), 'Dockerfile.fk-omiya-console must NOT set ENV PORT');
  assert.ok(consoleDockerfile.includes('ENV NODE_ENV=production'), 'must still set NODE_ENV');
  assert.ok(consoleDockerfile.includes('EXPOSE 8080'), 'must still EXPOSE 8080');
  console.log('  PASS ② Dockerfile.fk-omiya-console: ENV PORT削除済み');

  // ③ Dockerfile.fk-omiya-line-bot: ENV PORT なし
  const botDockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile.fk-omiya-line-bot'), 'utf8');
  assert.ok(!botDockerfile.includes('ENV PORT'), 'Dockerfile.fk-omiya-line-bot must NOT set ENV PORT');
  assert.ok(botDockerfile.includes('ENV NODE_ENV=production'), 'must still set NODE_ENV');
  assert.ok(botDockerfile.includes('EXPOSE 8080'), 'must still EXPOSE 8080');
  console.log('  PASS ③ Dockerfile.fk-omiya-line-bot: ENV PORT削除済み');

  // ④ LINE Bot サーバーが process.env.PORT を使う
  const botSrc = fs.readFileSync(path.join(ROOT, 'tools', 'kosame-line-bot.js'), 'utf8');
  assert.ok(botSrc.includes('process.env.PORT'), 'line bot must read process.env.PORT for Cloud Run');
  console.log('  PASS ④ LINE Bot: process.env.PORT で Cloud Run ポートを受け取る');

  // ⑤ cloud-run yaml にも ENV PORT 残余なし（コメント行以外）
  for (const yaml of ['fk-omiya-console-service.yaml', 'fk-omiya-line-bot-service.yaml']) {
    const y = fs.readFileSync(path.join(ROOT, 'cloud-run', yaml), 'utf8');
    const nonCommentLines = y.split('\n').filter(l => !l.trim().startsWith('#'));
    const hasPortEnv = nonCommentLines.some(l => l.includes('name: PORT'));
    assert.ok(!hasPortEnv, `${yaml} must not set PORT as env var (Cloud Run reserved)`);
  }
  console.log('  PASS ⑤ cloud-run yaml: PORT env var なし');

  console.log('\n✅ deploy-fk-omiya Cloud Run config smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
