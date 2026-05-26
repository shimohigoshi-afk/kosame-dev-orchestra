# Cloud Run Human Approval Packet — v0.2.3

**承認者: じゅんやさん**

このドキュメントは v0.3.0 Cloud Run deploy 前に、じゅんやさんが確認・承認するためのパケットです。

**AI はこのパケットを確認した後も、じゅんやさんの明示的な承認なしに deploy しません。**

---

## deploy 前確認チェックリスト

### 1. コード・CI 確認

- [ ] `npm run verify` → 全 smoke PASS
- [ ] `npm run pm-agent:cloud-run-preflight` → `launchReady: true`
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
- [ ] `cloud-run/pm-agent-service.template.yaml` の `secretKeyRef` section を確認・有効化
- [ ] Secret の値は AI・Claude Code に表示していない

### 4. rollback 導線確認

- [ ] deploy 前の revision ID を記録する手順を把握
- [ ] `cloud-run/README.md` の rollback 手順を読んだ
- [ ] `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` を読んだ

### 5. 実行コマンド候補の確認

```bash
# deploy コマンド候補を確認（実行しない）
npm run pm-agent:deploy-commands
```

生成されたコマンドの PLACEHOLDER を実値に置き換えて実行する。

---

## 実行してよいコマンド候補（承認後）

```bash
# image build (Cloud Build)
gcloud builds submit --tag gcr.io/PROJECT_ID/kosame-pm-agent:TAG --project PROJECT_ID

# Cloud Run deploy
gcloud run deploy SERVICE_NAME \
  --image gcr.io/PROJECT_ID/kosame-pm-agent:TAG \
  --platform managed --region REGION --project PROJECT_ID \
  --port 8080 --set-env-vars NODE_ENV=production,PORT=8080 \
  --max-instances 1 --allow-unauthenticated

# deploy 後 smoke
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL
```

---

## 実行してはいけないコマンド候補

以下は AI・Claude Code が単独で実行してはいけない操作:

- `gcloud run deploy ...` （Human Approval 必須）
- `docker build ...` （Human Approval 必須）
- `gcloud secrets versions access ...` （Secret 値読み取り禁止）
- `gcloud projects list` + billing 操作（billing 確認は人間が目視）
- `git push` / `git tag` （Human Approval 必須）
- `printenv` / `env` / Secret 値の出力（禁止）

---

## 承認フォーム

じゅんやさんが以下を確認・承認した場合のみ v0.3.0 deploy を実施します:

```
[ ] 上記チェックリストを全て確認した
[ ] billing アラートを設定した
[ ] Secret Manager の状態を確認した
[ ] rollback 手順を把握した
[ ] v0.3.0 deploy を承認する

承認日: ____________________
承認者: じゅんやさん
```

---

## AI の制約確認

このパケットを受け取った AI (Claude Code) は以下を遵守します:

1. じゅんやさんの明示的な「deploy OK」なしに `gcloud run deploy` を実行しない
2. Secret Manager の値を読み取らない
3. `.env` / GitHub Secrets を読まない
4. docker build を実行しない
5. billing 操作をしない
6. git push / git tag を実行しない
