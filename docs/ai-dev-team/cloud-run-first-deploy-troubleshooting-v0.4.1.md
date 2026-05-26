# Cloud Run First Deploy Troubleshooting — v0.4.1

## 概要

v0.4.0 初回 deploy 時のトラブルシューティングガイド。

**troubleshooting は Human Approval 後にじゅんやさんが実施する。**
**問題が発生したら smoke 再確認 → rollback 判断 → 原因調査の順で対応する。**

---

## トラブル分類

### 1. Cloud Build 失敗

**症状:** `gcloud builds submit` が失敗する

```bash
# ログ確認
gcloud builds list --limit=5 --project PROJECT_ID
gcloud builds log BUILD_ID --project PROJECT_ID
```

**確認ポイント:**
- [ ] Artifact Registry / Container Registry が有効化済みか
- [ ] Dockerfile の構文エラー
- [ ] node_modules が .dockerignore に含まれているか
- [ ] billing が有効か

---

### 2. Cloud Run deploy 失敗

**症状:** `gcloud run deploy` がエラーを返す

```bash
# サービス状態確認
gcloud run services describe pm-agent --region asia-northeast1 --project PROJECT_ID
# revision 一覧確認
gcloud run revisions list --service pm-agent --region asia-northeast1 --project PROJECT_ID
```

**確認ポイント:**
- [ ] image URL が正しいか
- [ ] PORT=8080 が設定されているか
- [ ] max-instances が設定されているか
- [ ] 権限 (Cloud Run Admin role) があるか

---

### 3. smoke 失敗

**症状:** `node tools/pm-agent-post-deploy-smoke.js` が fail を返す

smoke 失敗は即時 rollback 検討。Human Approval 後に rollback を実行する。

```bash
# health check 手動確認
curl -s https://SERVICE_URL/health

# ログ確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pm-agent" \
  --limit=50 \
  --project PROJECT_ID
```

**確認ポイント:**
- [ ] `/health` が 200 を返すか
- [ ] `dryRunOnly: true` が返るか（`/info`）
- [ ] アプリが PORT 8080 で listen しているか

---

### 4. rollback 手順

rollback は Human Approval 後にじゅんやさんが実施する。

```bash
# revision 一覧確認（実行可能）
gcloud run revisions list --service pm-agent --region asia-northeast1 --project PROJECT_ID

# 旧 revision へ traffic 切り替え（Human Approval 後）
gcloud run services update-traffic pm-agent \
  --to-revisions PREVIOUS_REVISION=100 \
  --region asia-northeast1 \
  --project PROJECT_ID

# rollback 後 smoke 再確認
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL
```

rollback 詳細: `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` 参照

---

### 5. billing スパイク

**症状:** 予期しない料金が発生している

- Cloud Run コンソール → billing コンソールで確認
- 問題がある場合はサービス停止も検討:

```bash
# サービス停止（最終手段 — Human Approval 後）
gcloud run services delete pm-agent --region asia-northeast1 --project PROJECT_ID
```

---

### 6. Secret Manager 接続エラー

**症状:** Secret を参照する env var が取得できない

- GCP Console → Secret Manager で secret 名を確認
- Cloud Run SA に Secret Manager Secret Accessor ロールがあるか確認
- `cloud-run/pm-agent-service.template.yaml` の secretKeyRef が正しく設定されているか確認

詳細: `docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md` 参照

---

## トラブルシューティング記録テンプレート

```json
{
  "incidentAt": "YYYY-MM-DD HH:MM:SS",
  "symptom": "SYMPTOM_PLACEHOLDER",
  "smokeResult": "PENDING (pass / fail)",
  "rootCause": "PENDING",
  "actionTaken": "PENDING",
  "rollbackExecuted": "PENDING (no / yes)",
  "resolution": "PENDING (resolved / ongoing)",
  "nextAction": "PENDING"
}
```

---

## 参考

- `tools/pm-agent-cloud-run-url-smoke-pack.js` — smoke コマンド生成
- `tools/pm-agent-production-cutover-pack.js` — rollback window plan
- `docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md` — smoke 記録
- `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` — インシデント対応
- `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` — rollback 手順
