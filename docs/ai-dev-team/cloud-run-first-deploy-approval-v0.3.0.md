# Cloud Run First Deploy Approval — v0.3.0

**承認者: じゅんやさん**

v0.4.0 Cloud Run 初回 deploy 実行前に、じゅんやさんが確認・承認するためのドキュメント。

**AI はこのドキュメントを確認した後も、じゅんやさんの明示的な Human Approval なしに deploy しません。**

---

## deploy 前確認チェックリスト

### 1. コード・CI 確認

- [ ] `npm run verify` → 全 smoke PASS
- [ ] `npm run pm-agent:deploy-readiness-final-check` → `readyForHumanDeploy: true`
- [ ] GitHub Actions `pm-agent-launch-readiness.yml` → success
- [ ] GitHub `main` ブランチの最新 commit が CI green

### 2. billing 確認

- [ ] GCP コンソール → 課金 → billing enabled を確認
- [ ] Cloud Run の予算アラートを設定（月額上限を設定すること）
- [ ] 想定コスト見積もりを確認（Cloud Run: リクエストベース課金）
- [ ] 意図しない課金が発生した場合の停止手順を把握している

### 3. Secret Manager 確認（API キーを使う場合）

- [ ] Secret Manager に API キーが登録済み
- [ ] Cloud Run Service Account に `Secret Manager Secret Accessor` 権限あり
- [ ] `cloud-run/pm-agent-service.template.yaml` の secretKeyRef が正しく設定済み

### 4. インフラ確認

- [ ] GCP プロジェクト ID が確定済み
- [ ] リージョンが確定済み（asia-northeast1 推奨）
- [ ] Artifact Registry または Container Registry が有効化済み
- [ ] Cloud Run API が有効化済み
- [ ] Cloud Build API が有効化済み

### 5. コマンド確認

- [ ] `node tools/pm-agent-first-deploy-command-pack.js` を実行して deploy コマンドを確認済み
- [ ] SERVICE_NAME / PROJECT_ID / REGION / IMAGE_TAG が全て実値に置き換え可能
- [ ] rollback コマンドを把握済み

---

## deploy 実行後の確認項目

- [ ] `node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL>` → 全 PASS
- [ ] Cloud Run console で revision が healthy
- [ ] billing: 課金が予期した範囲内
- [ ] v0.4.1 で deploy 結果を記録する

---

## 承認フォーム

```
承認日時: YYYY-MM-DD HH:MM
承認者: じゅんやさん
確認事項: 上記チェックリスト全項目確認済み
deploy先: Cloud Run / asia-northeast1
```

---

## 参考ドキュメント

- `tools/pm-agent-deploy-approval-packet.js` — 承認パケット JSON 生成
- `tools/pm-agent-first-deploy-command-pack.js` — deploy コマンドパック
- `docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md` — deploy 実行手順
- `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` — rollback 手順
