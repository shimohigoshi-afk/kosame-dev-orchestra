#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const SETTINGS_LOCAL = path.join(ROOT, '.claude', 'settings.local.json');
const DEPLOY_SCRIPT = path.join(ROOT, 'scripts', 'deploy-fk-omiya.sh');
const CONSOLE_SCRIPT = path.join(ROOT, 'scripts', 'deploy-fk-omiya-console.sh');

async function main() {
  console.log('=== v113.3.55 deploy approval smoke ===');

  // ── package wiring ───────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.55'), `version must be >= 113.3.55 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-55'], 'smoke:v113-3-55 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-55'), 'verify must include smoke:v113-3-55');
  assert.ok(pkg.scripts['deploy:fk-omiya:console'], 'deploy:fk-omiya:console npm script must exist');
  assert.ok(
    pkg.scripts['deploy:fk-omiya:console'].includes('deploy-fk-omiya-console.sh'),
    'deploy:fk-omiya:console must call deploy-fk-omiya-console.sh'
  );
  console.log('  PASS: package wiring');

  // ── .claude/settings.local.json: gcloud deploy must NOT be denied ────────────
  assert.ok(fs.existsSync(SETTINGS_LOCAL), '.claude/settings.local.json must exist');
  const settings = JSON.parse(fs.readFileSync(SETTINGS_LOCAL, 'utf8'));
  const denyList = settings?.permissions?.deny || [];

  assert.ok(
    !denyList.includes('Bash(gcloud run deploy*)'),
    'settings.local.json must NOT deny Bash(gcloud run deploy*) — this was the root cause of the permission block'
  );
  assert.ok(
    !denyList.includes('Bash(gcloud builds submit*)'),
    'settings.local.json must NOT deny Bash(gcloud builds submit*) — needed for Cloud Build'
  );

  // Safety Stop patterns that MUST remain in deny list
  assert.ok(
    denyList.some(r => r.includes('git push --force') || r.includes('git push -f')),
    'force push must remain in deny list'
  );
  assert.ok(
    denyList.some(r => r.includes('rm -rf')),
    'rm -rf must remain in deny list'
  );
  console.log('  PASS: gcloud deploy unblocked, safety stops remain');

  // ── deploy scripts exist and are executable ──────────────────────────────────
  assert.ok(fs.existsSync(DEPLOY_SCRIPT), 'scripts/deploy-fk-omiya.sh must exist');
  assert.ok(fs.existsSync(CONSOLE_SCRIPT), 'scripts/deploy-fk-omiya-console.sh must exist');

  // Full deploy script must support DEPLOY_APPROVED=yes bypass
  const deployScriptSrc = fs.readFileSync(DEPLOY_SCRIPT, 'utf8');
  assert.ok(
    deployScriptSrc.includes('DEPLOY_APPROVED'),
    'scripts/deploy-fk-omiya.sh must support DEPLOY_APPROVED env var bypass'
  );
  assert.ok(
    deployScriptSrc.includes('DEPLOY_APPROVED:-') || deployScriptSrc.includes('${DEPLOY_APPROVED}'),
    'DEPLOY_APPROVED must be used as a gate condition in deploy script'
  );

  // Console-only script must not require interactive input
  const consoleScriptSrc = fs.readFileSync(CONSOLE_SCRIPT, 'utf8');
  assert.ok(
    !consoleScriptSrc.includes('read -r'),
    'deploy-fk-omiya-console.sh must not use interactive read -r (non-interactive deploy)'
  );
  assert.ok(
    consoleScriptSrc.includes('gcloud builds submit'),
    'deploy-fk-omiya-console.sh must call gcloud builds submit'
  );
  assert.ok(
    consoleScriptSrc.includes('gcloud run deploy'),
    'deploy-fk-omiya-console.sh must call gcloud run deploy'
  );
  assert.ok(
    consoleScriptSrc.includes('fk-omiya-console'),
    'deploy-fk-omiya-console.sh must target fk-omiya-console service'
  );
  console.log('  PASS: deploy scripts exist and are properly configured');

  // ── deploy:fk-omiya (full) must use DEPLOY_APPROVED=yes ──────────────────────
  const fullDeployScript = pkg.scripts['deploy:fk-omiya'] || '';
  assert.ok(
    fullDeployScript.includes('DEPLOY_APPROVED=yes'),
    'deploy:fk-omiya npm script must set DEPLOY_APPROVED=yes to bypass interactive gate'
  );
  console.log('  PASS: deploy:fk-omiya uses DEPLOY_APPROVED=yes');

  console.log('\n✅ v113.3.55 deploy approval smoke PASSED');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
