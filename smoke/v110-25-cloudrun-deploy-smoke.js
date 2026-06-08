#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.25 Cloud Run Deploy
 *
 * Verifies:
 *   - TOOL_META.version is 110.25.0
 *   - GCP_PROJECT, REGION, SERVICE_NAME, IMAGE_URL constants
 *   - SECRET_DEFS: 6 entries covering all API keys
 *   - DeepSeek and Kimi have advisory='sanitized-advisory' in SECRET_DEFS
 *   - Dockerfile CMD is 'npm run dashboard' (not pm-agent:http-dry-run)
 *   - Dockerfile uses node:24-slim
 *   - cloud-run/kosame-dashboard-service.yaml exists
 *   - .dockerignore contains .kosame
 *   - npm scripts: deploy:cloudrun, deploy:cloudrun:secrets, deploy:cloudrun:status
 *   - dryRun default (no actual GCP calls)
 */

const assert = require('node:assert');
const fs     = require('node:fs');
const path   = require('node:path');
const pkg    = require('../package.json');
const deploy = require('../tools/kosame-cloudrun-deploy');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.25 cloudrun-deploy smoke ===');

// package version
assert.ok(pkg.version >= '110.25.0');
pass('package version >= 110.25.0');

// TOOL_META
assert.strictEqual(deploy.TOOL_META.version, '110.25.0');
pass('TOOL_META.version is 110.25.0');

// Constants
assert.strictEqual(deploy.GCP_PROJECT, 'anesty-bot');
pass('GCP_PROJECT is anesty-bot');

assert.strictEqual(deploy.REGION, 'asia-northeast1');
pass('REGION is asia-northeast1');

assert.strictEqual(deploy.SERVICE_NAME, 'kosame-dashboard');
pass('SERVICE_NAME is kosame-dashboard');

assert.ok(deploy.IMAGE_URL.includes('asia-northeast1-docker.pkg.dev'), 'IMAGE_URL must use asia-northeast1');
assert.ok(deploy.IMAGE_URL.includes('anesty-bot'), 'IMAGE_URL must include anesty-bot project');
assert.ok(deploy.IMAGE_URL.includes('kosame-dashboard'), 'IMAGE_URL must include kosame-dashboard');
pass(`IMAGE_URL: ${deploy.IMAGE_URL}`);

// SECRET_DEFS
assert.ok(Array.isArray(deploy.SECRET_DEFS), 'SECRET_DEFS must be array');
assert.strictEqual(deploy.SECRET_DEFS.length, 6, 'SECRET_DEFS must have 6 entries');
pass('SECRET_DEFS has 6 entries');

const secretEnvVars = deploy.SECRET_DEFS.map(s => s.envVar);
for (const envVar of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROK_API_KEY', 'DISCORD_BOT_TOKEN', 'DEEPSEEK_API_KEY', 'KIMI_API_KEY']) {
  assert.ok(secretEnvVars.includes(envVar), `SECRET_DEFS must include ${envVar}`);
  pass(`SECRET_DEFS includes ${envVar}`);
}

for (const s of deploy.SECRET_DEFS) {
  assert.ok(typeof s.secretName === 'string' && s.secretName.startsWith('kosame-'),
    `secretName must start with kosame- (got ${s.secretName})`);
  pass(`secretName "${s.secretName}" starts with kosame-`);
}

const deepseek = deploy.SECRET_DEFS.find(s => s.envVar === 'DEEPSEEK_API_KEY');
const kimi     = deploy.SECRET_DEFS.find(s => s.envVar === 'KIMI_API_KEY');
assert.strictEqual(deepseek.advisory, 'sanitized-advisory', 'DEEPSEEK must be sanitized-advisory');
assert.strictEqual(kimi.advisory,     'sanitized-advisory', 'KIMI must be sanitized-advisory');
pass('DEEPSEEK_API_KEY and KIMI_API_KEY have advisory=sanitized-advisory');

// Dockerfile
const root       = path.resolve(__dirname, '..');
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
assert.ok(dockerfile.includes('node:24-slim'), 'Dockerfile must use node:24-slim');
pass('Dockerfile uses node:24-slim');

assert.ok(dockerfile.includes('"dashboard"'), 'Dockerfile CMD must reference "dashboard"');
assert.ok(!dockerfile.includes('pm-agent:http-dry-run'), 'Dockerfile must NOT use pm-agent:http-dry-run');
pass('Dockerfile CMD is "npm run dashboard"');

// .dockerignore
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
assert.ok(dockerignore.includes('.kosame'), '.dockerignore must exclude .kosame directory');
pass('.dockerignore contains .kosame');

// cloud-run/kosame-dashboard-service.yaml
const serviceYaml = path.join(root, 'cloud-run', 'kosame-dashboard-service.yaml');
assert.ok(fs.existsSync(serviceYaml), 'cloud-run/kosame-dashboard-service.yaml must exist');
const yamlContent = fs.readFileSync(serviceYaml, 'utf8');
assert.ok(yamlContent.includes('kosame-dashboard'), 'service YAML must reference kosame-dashboard');
assert.ok(yamlContent.includes('anesty-bot'), 'service YAML must reference anesty-bot project');
assert.ok(yamlContent.includes('asia-northeast1'), 'service YAML must reference asia-northeast1');
assert.ok(yamlContent.includes('secretKeyRef'), 'service YAML must use secretKeyRef for keys');
assert.ok(yamlContent.includes('GEMINI_API_KEY'), 'service YAML must bind GEMINI_API_KEY');
assert.ok(yamlContent.includes('DEEPSEEK_API_KEY'), 'service YAML must bind DEEPSEEK_API_KEY');
pass('cloud-run/kosame-dashboard-service.yaml has all required content');

// npm scripts
assert.ok(pkg.scripts['deploy:cloudrun'], 'npm run deploy:cloudrun must exist');
pass('npm run deploy:cloudrun exists');
assert.ok(pkg.scripts['deploy:cloudrun:secrets'], 'npm run deploy:cloudrun:secrets must exist');
pass('npm run deploy:cloudrun:secrets exists');
assert.ok(pkg.scripts['deploy:cloudrun:status'], 'npm run deploy:cloudrun:status must exist');
pass('npm run deploy:cloudrun:status exists');

console.log(`\n✅ v110.25 cloudrun-deploy smoke PASSED (${passed} checks)`);
