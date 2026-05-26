# Cloud Run Release Checklist — v0.3.0 deploy 候補

**このチェックリストは v0.3.0 Cloud Run deploy 実施時に使用する。v0.2.3 では実行しない。**

---

## Before Deploy

### コード・CI

- [ ] `npm run verify` → 全 smoke PASS
- [ ] `npm run pm-agent:cloud-run-preflight` → `launchReady: true`
- [ ] GitHub Actions `pm-agent-launch-readiness.yml` → success
- [ ] GitHub `main` の最新 commit が CI green
- [ ] `git status` が clean（uncommitted changes なし）

### Dockerfile・image

- [ ] `Dockerfile` に `EXPOSE 8080` がある
- [ ] `Dockerfile` に `CMD ["npm", "run", "pm-agent:http-dry-run"]` がある
- [ ] `Dockerfile` に Secret / API キーが含まれていない
- [ ] `.dockerignore` に `.env` / `node_modules` / `.git` が含まれている
- [ ] `cloud-run/pm-agent-service.template.yaml` の PLACEHOLDER を全て実値に置き換えた（Gitにコミットしない）

### Secret・billing

- [ ] billing enabled & 予算アラート設定済み
- [ ] Secret Manager に必要な API キーが登録済み（使用する場合）
- [ ] Cloud Run Service Account に適切な権限を付与済み

### Human Approval

- [ ] `docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md` の全項目を確認
- [ ] じゅんやさんが「deploy OK」を承認

---

## Deploy

- [ ] image build（Cloud Build または local docker build）
- [ ] image push to Artifact Registry / Container Registry
- [ ] `gcloud run deploy SERVICE_NAME ...` 実行
- [ ] deploy コマンドの exit code が 0
- [ ] Cloud Run コンソールで revision が healthy を確認

---

## After Deploy

### Smoke

- [ ] `node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL` → 全 PASS
- [ ] `GET /health` → `{ status: "ok" }`
- [ ] `GET /info` → `{ dryRunOnly: true }`
- [ ] `POST /dry-run-task` (implementation) → `recommendedOwner: claude_code`, `blocked: false`
- [ ] `POST /dry-run-task` (critical deploy) → `blocked: true`, `humanApprovalRequired: true`

### billing

- [ ] deploy 後 10 分以内に Cloud Run コンソールでリクエスト数を確認
- [ ] 予期しない課金が発生していないこと

---

## Rollback 準備

- [ ] deploy 前の revision ID を記録済み
- [ ] rollback コマンドを手元に準備済み
- [ ] smoke FAIL 時は即 rollback する合意がある

---

## Documentation

- [ ] deploy 日時・image tag・revision ID を記録
- [ ] smoke 結果を記録
- [ ] `docs/ai-dev-team/` にリリースノートを追記（任意）

---

## No Secret Exposure

- [ ] Secret 値がログ・ドキュメント・コンソール出力に含まれていないことを確認
- [ ] `printenv` / `env` コマンドの出力をスクリーンショット等に含めていないこと
- [ ] deploy 後の環境変数一覧を外部共有していないこと

---

## No Unexpected Billing

- [ ] Cloud Run の無料枠を確認済み（月間 200 万リクエストまで無料）
- [ ] `--max-instances 1` 設定で起動していること
- [ ] min-instances が 0 であること（常時稼働課金を避ける）
- [ ] 想定外のトラフィックが来ていないことを確認
