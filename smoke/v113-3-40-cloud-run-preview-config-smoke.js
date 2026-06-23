#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('=== v113.3.40 Cloud Run Preview Config smoke ===');

  // Dockerfile.fk-omiya-preview
  const dockerfilePath = path.join(ROOT, 'Dockerfile.fk-omiya-preview');
  assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile.fk-omiya-preview must exist');
  const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
  assert.ok(dockerfile.includes('kosame-fk-omiya-preview-server.js'), 'Dockerfile must reference preview server');
  assert.ok(dockerfile.includes('EXPOSE 8080') || dockerfile.includes('ENV PORT=8080'), 'Dockerfile must expose PORT 8080');
  assert.ok(!dockerfile.includes('COPY .env'), 'Dockerfile must not COPY .env');
  assert.ok(!dockerfile.includes('OPENAI_API_KEY'), 'Dockerfile must not reference OPENAI_API_KEY');
  assert.ok(!dockerfile.includes('GROQ_API_KEY'), 'Dockerfile must not reference GROQ_API_KEY');
  assert.ok(!dockerfile.includes('SECRET'), 'Dockerfile must not reference SECRET');
  console.log('  PASS Dockerfile.fk-omiya-preview: exists, PORT ok, no secrets');

  // cloudrun/fk-omiya-preview.yaml
  const yamlPath = path.join(ROOT, 'cloudrun', 'fk-omiya-preview.yaml');
  assert.ok(fs.existsSync(yamlPath), 'cloudrun/fk-omiya-preview.yaml must exist');
  const yaml = fs.readFileSync(yamlPath, 'utf8');
  assert.ok(yaml.includes('name: fk-omiya-preview'), 'yaml must name the service fk-omiya-preview');
  assert.ok(yaml.includes('containerPort: 8080') || yaml.includes('PORT'), 'yaml must configure PORT 8080');
  assert.ok(yaml.includes('ingress: all'), 'yaml must allow all ingress (unauthenticated demo)');
  assert.ok(!yaml.includes('OPENAI_API_KEY'), 'yaml must not reference OPENAI_API_KEY');
  assert.ok(!yaml.includes('GROQ_API_KEY'), 'yaml must not reference GROQ_API_KEY');
  console.log('  PASS cloudrun/fk-omiya-preview.yaml: exists, ingress:all, no secrets');

  // scripts/deploy-fk-omiya-preview.sh
  const deployPath = path.join(ROOT, 'scripts', 'deploy-fk-omiya-preview.sh');
  assert.ok(fs.existsSync(deployPath), 'scripts/deploy-fk-omiya-preview.sh must exist');
  const deploy = fs.readFileSync(deployPath, 'utf8');
  assert.ok(deploy.includes('--allow-unauthenticated'), 'deploy script must include --allow-unauthenticated');
  assert.ok(deploy.includes('Dockerfile.fk-omiya-preview'), 'deploy script must reference Dockerfile.fk-omiya-preview');
  assert.ok(deploy.includes('fk-omiya-preview'), 'deploy script must reference service name');
  assert.ok(!deploy.includes('OPENAI_API_KEY'), 'deploy script must not reference OPENAI_API_KEY');
  assert.ok(!deploy.includes('GROQ_API_KEY'), 'deploy script must not reference GROQ_API_KEY');
  // Must print the URL after deploy
  assert.ok(deploy.includes('status.url') || deploy.includes('URL'), 'deploy script must output the deployed URL');
  console.log('  PASS scripts/deploy-fk-omiya-preview.sh: exists, --allow-unauthenticated, no secrets, prints URL');

  // Dockerfile only copies public/ and preview server — not internal tools
  assert.ok(!dockerfile.includes('COPY tools/ ') && !dockerfile.includes('COPY tools .'), 'Dockerfile must not copy all of tools/');
  assert.ok(dockerfile.includes('COPY public/'), 'Dockerfile must copy public/ directory');
  console.log('  PASS Dockerfile scope: only public/ and preview server (not all tools/)');

  // package.json wiring
  const pkg = require('../package.json');
  assert.ok(pkg.scripts['preview:fk-omiya'], 'package.json must have preview:fk-omiya script');
  assert.ok(pkg.scripts['smoke:fk-omiya-preview'], 'package.json must have smoke:fk-omiya-preview script');
  assert.ok(pkg.scripts['deploy:fk-omiya-preview'], 'package.json must have deploy:fk-omiya-preview script');
  console.log('  PASS package.json Cloud Run scripts wired');

  console.log('\n✅ v113.3.40 Cloud Run Preview Config smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
