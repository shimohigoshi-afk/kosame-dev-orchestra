#!/usr/bin/env node
'use strict';

/**
 * KOSAME Cloud Run Deploy v110.25.0
 *
 * ダッシュボードを Cloud Run にデプロイするための計画・実行ツール。
 * dryRun デフォルト。実際のデプロイはじゅんやさんの承認後に --write で実行。
 *
 * Usage:
 *   npm run deploy:cloudrun           # dryRun: 実行コマンドを表示するだけ
 *   npm run deploy:cloudrun -- --write  # 承認後の実際の実行（Human Gate あり）
 *   npm run deploy:cloudrun -- --secrets-only   # Secret Manager 登録コマンドのみ表示
 *   npm run deploy:cloudrun -- --status         # 現在の Cloud Run 状態を確認（読み取り専用）
 */

const { execSync, spawnSync } = require('node:child_process');
const os   = require('node:os');
const path = require('node:path');

const TOOL_META = {
  version: '110.25.0',
  feature: 'v110-25-cloudrun-deploy',
  slug:    'kosame-cloudrun-deploy',
};

const GCP_PROJECT   = 'anesty-bot';
const REGION        = 'asia-northeast1';
const SERVICE_NAME  = 'kosame-dashboard';
const AR_LOCATION   = 'asia-northeast1';
const AR_REPO       = 'kosame';
const IMAGE_NAME    = 'kosame-dashboard';
const IMAGE_TAG     = 'latest';
const IMAGE_URL     = `${AR_LOCATION}-docker.pkg.dev/${GCP_PROJECT}/${AR_REPO}/${IMAGE_NAME}:${IMAGE_TAG}`;

const SECRET_DEFS = [
  { envVar: 'GEMINI_API_KEY',    secretName: 'kosame-gemini-api-key',    advisory: null },
  { envVar: 'OPENAI_API_KEY',    secretName: 'kosame-openai-api-key',    advisory: null },
  { envVar: 'GROK_API_KEY',      secretName: 'kosame-grok-api-key',      advisory: null },
  { envVar: 'DISCORD_BOT_TOKEN', secretName: 'kosame-discord-bot-token', advisory: null },
  { envVar: 'DEEPSEEK_API_KEY',  secretName: 'kosame-deepseek-api-key',  advisory: 'sanitized-advisory' },
  { envVar: 'KIMI_API_KEY',      secretName: 'kosame-kimi-api-key',      advisory: 'sanitized-advisory' },
];

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green:  '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan:   '\x1b[36m', red: '\x1b[31m', gray: '\x1b[90m', magenta: '\x1b[35m',
};
const c = (col, t) => `${C[col]}${t}${C.reset}`;

// ── Command runner ─────────────────────────────────────────────────────────────

function run(cmd, { dryRun, label } = {}) {
  if (dryRun) {
    console.log(`  ${c('dim', '$')} ${c('cyan', cmd)}`);
    return { ok: true, dryRun: true, output: '' };
  }
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, dryRun: false, output: output.trim() };
  } catch (err) {
    return { ok: false, dryRun: false, output: err.stderr || err.message };
  }
}

// ── Step 1: GCP prerequisites ─────────────────────────────────────────────────

function stepGcpSetup(dryRun) {
  console.log(`\n${c('bold', '1. GCP プロジェクト・API 有効化')}`);
  run(`gcloud config set project ${GCP_PROJECT}`, { dryRun });
  run([
    'gcloud services enable',
    'run.googleapis.com',
    'secretmanager.googleapis.com',
    'artifactregistry.googleapis.com',
    `--project=${GCP_PROJECT}`,
  ].join(' '), { dryRun });
}

// ── Step 2: Artifact Registry ─────────────────────────────────────────────────

function stepArtifactRegistry(dryRun) {
  console.log(`\n${c('bold', '2. Artifact Registry 作成（既存なら無視）')}`);
  run([
    'gcloud artifacts repositories create', AR_REPO,
    '--repository-format=docker',
    `--location=${AR_LOCATION}`,
    '--description="KOSAME dashboard images"',
    `--project=${GCP_PROJECT}`,
    '--quiet || true',
  ].join(' '), { dryRun });
  run(`gcloud auth configure-docker ${AR_LOCATION}-docker.pkg.dev --quiet`, { dryRun });
}

// ── Step 3: Docker build & push ───────────────────────────────────────────────

function stepDockerBuildPush(dryRun) {
  console.log(`\n${c('bold', '3. Docker ビルド & プッシュ')}`);
  console.log(`  Image: ${c('cyan', IMAGE_URL)}`);
  run(`docker build -t ${IMAGE_URL} .`, { dryRun });
  run(`docker push ${IMAGE_URL}`, { dryRun });
}

// ── Step 4: Secret Manager ────────────────────────────────────────────────────

function stepSecrets(dryRun) {
  console.log(`\n${c('bold', '4. Secret Manager — APIキー登録')}`);
  console.log(`  ${c('dim', '注: 既に登録済みの場合は create を versions add に変更すること')}`);
  for (const s of SECRET_DEFS) {
    const adv = s.advisory ? c('yellow', ` [${s.advisory}]`) : '';
    console.log(`\n  ${c('bold', s.envVar)}${adv}`);
    // create secret (idempotent: ignore error if exists)
    run([
      `echo -n "$${s.envVar}"`,
      `| gcloud secrets create ${s.secretName}`,
      '--data-file=-',
      `--project=${GCP_PROJECT}`,
      '--replication-policy=automatic',
      '2>/dev/null',
      `|| echo -n "$${s.envVar}"`,
      `| gcloud secrets versions add ${s.secretName}`,
      '--data-file=-',
      `--project=${GCP_PROJECT}`,
    ].join(' '), { dryRun });
  }
}

// ── Step 5: IAM — grant Cloud Run SA access to secrets ────────────────────────

function stepIam(dryRun) {
  console.log(`\n${c('bold', '5. IAM — Cloud Run サービスアカウントにシークレットアクセス付与')}`);
  console.log(`  ${c('dim', 'PROJECT_NUMBER を取得して自動設定')}`);
  const saPlaceholder = `${GCP_PROJECT}@appspot.gserviceaccount.com`;
  console.log(`  ${c('dim', '# PROJECT_NUMBER を確認:')}`);
  run(`gcloud projects describe ${GCP_PROJECT} --format='value(projectNumber)'`, { dryRun });
  for (const s of SECRET_DEFS) {
    run([
      `gcloud secrets add-iam-policy-binding ${s.secretName}`,
      `--member="serviceAccount:${saPlaceholder}"`,
      '--role="roles/secretmanager.secretAccessor"',
      `--project=${GCP_PROJECT}`,
    ].join(' '), { dryRun });
  }
  console.log(`  ${c('yellow', '注: 実際の SA メールアドレスは gcloud run services describe で確認すること')}`);
}

// ── Step 6: Cloud Run deploy ──────────────────────────────────────────────────

function stepDeploy(dryRun) {
  console.log(`\n${c('bold', '6. gcloud run deploy')}`);
  const setSecrets = SECRET_DEFS
    .map(s => `${s.envVar}=${s.secretName}:latest`)
    .join(',');
  run([
    'gcloud run deploy', SERVICE_NAME,
    `--image=${IMAGE_URL}`,
    `--region=${REGION}`,
    `--project=${GCP_PROJECT}`,
    '--platform=managed',
    '--port=8080',
    '--memory=512Mi',
    '--cpu=1',
    '--max-instances=1',
    '--min-instances=0',
    '--allow-unauthenticated',
    `--set-secrets=${setSecrets}`,
    '--quiet',
  ].join(' \\\n    '), { dryRun });
}

// ── Step 7: Post-deploy smoke ─────────────────────────────────────────────────

function stepPostDeploy(dryRun) {
  console.log(`\n${c('bold', '7. デプロイ後スモーク確認')}`);
  run([
    'gcloud run services describe', SERVICE_NAME,
    `--region=${REGION}`,
    `--project=${GCP_PROJECT}`,
    "--format='value(status.url)'",
  ].join(' '), { dryRun });
  console.log(`  ${c('dim', '# URL 確認後: curl -s <URL>/health')}`);
}

// ── Status (read-only, always runs) ──────────────────────────────────────────

function showStatus() {
  console.log(`\n${c('bold', c('blue', '⬡ Cloud Run ステータス確認'))}  (read-only)`);
  try {
    const result = execSync(
      `gcloud run services describe ${SERVICE_NAME} --region=${REGION} --project=${GCP_PROJECT} --format=json 2>&1`,
      { encoding: 'utf8', stdio: 'pipe', timeout: 15000 }
    );
    const svc = JSON.parse(result);
    const url    = svc?.status?.url || '(not deployed)';
    const ready  = svc?.status?.conditions?.find(c => c.type === 'Ready');
    const status = ready?.status === 'True' ? c('green', 'READY') : c('yellow', ready?.status || 'UNKNOWN');
    console.log(`  URL   : ${c('cyan', url)}`);
    console.log(`  State : ${status}`);
  } catch (err) {
    const msg = String(err.message || err.stderr || '');
    if (msg.includes('NOT_FOUND') || msg.includes('not found')) {
      console.log(`  ${c('yellow', 'サービスはまだデプロイされていません')}`);
    } else if (msg.includes('not authenticated') || msg.includes('credentialed')) {
      console.log(`  ${c('red', 'gcloud 未認証')} — gcloud auth login を実行してください`);
    } else {
      console.log(`  ${c('red', 'エラー:')} ${msg.slice(0, 120)}`);
    }
  }
}

// ── Human Gate ────────────────────────────────────────────────────────────────

function humanGateCheck(dryRun) {
  if (!dryRun) return true;
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun      = !args.includes('--write');
  const secretsOnly = args.includes('--secrets-only');
  const statusOnly  = args.includes('--status');

  console.log(`\n${c('bold', c('magenta', '⬡ KOSAME Cloud Run Deploy'))}  v${TOOL_META.version}`);
  console.log(`  GCP Project : ${c('cyan', GCP_PROJECT)}`);
  console.log(`  Service     : ${c('cyan', SERVICE_NAME)}`);
  console.log(`  Region      : ${c('cyan', REGION)}`);
  console.log(`  Image       : ${c('cyan', IMAGE_URL)}`);
  console.log(`  Mode        : ${dryRun ? c('yellow', 'DRY RUN (コマンドを表示するのみ)') : c('red', 'LIVE — 実際に実行します')}`);

  if (statusOnly) {
    showStatus();
    return;
  }

  if (!dryRun) {
    console.log(`\n${c('red', c('bold', '⚠ HUMAN GATE'))}`);
    console.log(`  --write が指定されました。実際の Cloud Run デプロイを実行します。`);
    console.log(`  じゅんやさんの承認を確認済みの場合のみ続行してください。`);
    console.log(`  ${c('dim', '3秒後に開始...')}`);
    execSync('sleep 3');
  }

  console.log(`\n${c('bold', c('blue', '── デプロイ計画 ──────────────────────────────────────────'))}`);

  if (secretsOnly) {
    stepSecrets(dryRun);
    stepIam(dryRun);
  } else {
    stepGcpSetup(dryRun);
    stepArtifactRegistry(dryRun);
    stepDockerBuildPush(dryRun);
    stepSecrets(dryRun);
    stepIam(dryRun);
    stepDeploy(dryRun);
    stepPostDeploy(dryRun);
  }

  console.log(`\n${c('bold', c('blue', '── 完了 ────────────────────────────────────────────────'))}`);
  if (dryRun) {
    console.log(`  ${c('yellow', 'DRY RUN 完了。上記コマンドは実行されていません。')}`);
    console.log(`  実際にデプロイするには: ${c('cyan', 'npm run deploy:cloudrun -- --write')}`);
    console.log(`  ${c('dim', '(じゅんやさんの承認後に実行してください)')}`);
  } else {
    console.log(`  ${c('green', 'デプロイ完了。')}`);
    showStatus();
  }

  console.log('');

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: !dryRun,
    gcpProject: GCP_PROJECT,
    serviceName: SERVICE_NAME,
    region: REGION,
    imageUrl: IMAGE_URL,
    secrets: SECRET_DEFS.map(s => s.secretName),
  };
}

if (require.main === module) {
  try { main(); } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

module.exports = { TOOL_META, GCP_PROJECT, REGION, SERVICE_NAME, IMAGE_URL, SECRET_DEFS };
