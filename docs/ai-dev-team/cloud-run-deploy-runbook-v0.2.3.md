# Cloud Run Deploy Runbook — v0.2.3

**重要: v0.2.3 段階では deploy を実行しない。このドキュメントは v0.3.0 Human Approval 後の実行手順書。**

---

## 前提条件

deploy を実行する前に以下をすべて完了すること。

### 1. GitHub Actions success 確認

```bash
# GitHub Actions pm-agent-launch-readiness.yml が success であること
# main ブランチの最新 commit が green であること
```

### 2. preflight 確認

```bash
npm run pm-agent:cloud-run-preflight
# → launchReady: true であること
# → deployReadyAfterHumanApproval: true であること
```

### 3. ローカル smoke 全通過確認

```bash
npm run verify
# → 全 smoke PASS であること
```

### 4. billing 確認（人間が目視）

- GCP コンソール → 課金 → 予算アラートが設定されているか確認
- Cloud Run の想定コストを確認
- 上限設定がない場合は設定してから deploy

### 5. Secret Manager 確認（使用する場合）

- API キーが Secret Manager に登録済みであること
- Cloud Run Service Account に Secret Manager アクセス権があること
- `cloud-run/pm-agent-service.template.yaml` の `secretKeyRef` を有効化済みであること

### 6. Human Approval（じゅんやさん承認）

上記 1〜5 完了後、じゅんやさんが「deploy OK」を口頭 / チャットで承認する。

---

## deploy コマンド生成

```bash
# deploy コマンドを生成して確認（実行しない）
npm run pm-agent:deploy-commands
```

実際に実行するコマンドは生成結果から取得し、PLACEHOLDER を実値に置き換えて実行する。

---

## deploy 手順（Human Approval 後）

### Step 1: image build & push

```bash
# Cloud Build を使う場合（推奨: ローカルに Docker 不要）
gcloud builds submit --tag gcr.io/PROJECT_ID/kosame-pm-agent:TAG --project PROJECT_ID

# またはローカル Docker を使う場合
docker build -t gcr.io/PROJECT_ID/kosame-pm-agent:TAG .
docker push gcr.io/PROJECT_ID/kosame-pm-agent:TAG
```

### Step 2: Cloud Run deploy

```bash
gcloud run deploy SERVICE_NAME \
  --image gcr.io/PROJECT_ID/kosame-pm-agent:TAG \
  --platform managed \
  --region REGION \
  --project PROJECT_ID \
  --port 8080 \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --max-instances 1 \
  --allow-unauthenticated
```

### Step 3: deploy 後 smoke 確認

```bash
# Cloud Run が返す SERVICE_URL を使用
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL

# または HTTP client で手動確認
node tools/pm-agent-http-client.js https://SERVICE_URL
```

---

## deploy 後チェックリスト

- [ ] `GET /health` → `{ status: "ok" }`
- [ ] `GET /info` → `{ dryRunOnly: true }`
- [ ] `POST /dry-run-task` (implementation) → `recommendedOwner: claude_code`
- [ ] `POST /dry-run-task` (critical deploy) → `blocked: true`
- [ ] Cloud Run コンソール: revision が healthy
- [ ] billing: 想定外の課金が発生していないこと

---

## 失敗時の切り戻し判断

smoke が 1 つでも FAIL した場合 → 即 rollback を検討する。

rollback 手順: `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` を参照。

---

## deploy 後の記録

deploy 完了後、以下を記録する:

- deploy 日時
- image tag
- Cloud Run revision ID
- smoke 結果
- 承認者: じゅんやさん

---

## 禁止事項

- Secret 値をコマンドライン引数や環境変数で直接渡さない
- `--allow-unauthenticated` を本番トラフィックに使う前に認証方針を確認する
- billing アラートなしで deploy しない
- Human Approval なしで deploy しない
