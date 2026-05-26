# cloud-run/ — Cloud Run Launch Pack (v0.2.3)

## 概要

v0.2.3 Cloud Run Launch Pack MAX の Cloud Run 関連設定ファイル置き場。

**v0.2.3 段階では deploy しない。** v0.3.0 で全準備が整い、v0.4.0 で Human Approval を経てじゅんやさんが deploy を実行する。

---

## ファイル一覧

| ファイル | 役割 |
|---|---|
| `pm-agent-service.template.yaml` | Cloud Run service 定義テンプレート |
| `README.md` | このファイル |

---

## pm-agent-service.template.yaml の使い方

1. テンプレートをコピーして実値に置き換える（Gitにコミットしない）
2. placeholder を確認する:
   - `SERVICE_NAME_PLACEHOLDER` → Cloud Run サービス名
   - `PROJECT_ID_PLACEHOLDER` → GCP プロジェクト ID
   - `IMAGE_PLACEHOLDER` → Container Registry / Artifact Registry のイメージ URL
   - `REGION_PLACEHOLDER` → デプロイリージョン（例: asia-northeast1）
3. Secret Manager 参照は `# Uncomment` セクションを人間が確認・有効化する

---

## deploy 前に必要な Human Approval 項目

以下はすべて **じゅんやさんの承認後** に実施する：

- [ ] GCP プロジェクトの確認・billing 有効化確認
- [ ] Secret Manager への API キー登録
- [ ] Container Registry / Artifact Registry の有効化
- [ ] `docker build` → push
- [ ] `gcloud run deploy`
- [ ] deploy 後: `node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL>` で確認

---

## Secret 値をここに書かない

- `.yaml` ファイルに API キーの実値を直接書いてはならない
- Secret Manager 参照 (`secretKeyRef`) のみ使用すること
- このファイルは Git 管理下に置くため、Secret 値は絶対に混入させない

---

## deploy 後の確認

```bash
# deploy 後の smoke 確認（Cloud Run URL を指定）
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL_PLACEHOLDER

# ローカルと同じ fixture を使って確認
node tools/pm-agent-http-client.js https://SERVICE_URL_PLACEHOLDER
```

`tools/pm-agent-http-client.js` に渡す baseUrl を Cloud Run URL に切り替えるだけで、
ローカルと同じ fixture・client を deploy 後の検証に再利用できる。

---

## v0.3.0 追加: Deploy Execution Pack

v0.3.0 で deploy 実行前の全準備が完了。v0.4.0 でじゅんやさんが Cloud Shell から実行する。

```bash
# 最終 readiness 確認
npm run pm-agent:deploy-readiness-final-check
# → readyForHumanDeploy: true

# v0.4.0 deploy コマンドパック（コマンド文字列生成のみ・実行しない）
node tools/pm-agent-first-deploy-command-pack.js
```

deploy 実行後は `node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL>` で確認し、
`docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` に結果を記録する。

---

## 参考ドキュメント

- `docs/ai-dev-team/cloud-run-launch-pack-max-v0.2.3.md` — Launch Pack 全体設計
- `docs/ai-dev-team/cloud-run-deploy-runbook-v0.2.3.md` — deploy 手順書
- `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` — rollback 方針
- `docs/ai-dev-team/cloud-run-human-approval-packet-v0.2.3.md` — 承認パケット
- `docs/ai-dev-team/cloud-run-release-checklist-v0.2.3.md` — release checklist
- `docs/ai-dev-team/cloud-run-deploy-execution-pack-v0.3.0.md` — v0.3.0 Deploy Execution Pack
- `docs/ai-dev-team/cloud-run-first-deploy-approval-v0.3.0.md` — 初回 deploy 承認チェックリスト
- `docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md` — v0.4.0 deploy 実行手順
- `docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md` — runtime 運用ガイド
- `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` — インシデント対応ガイド
- `docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md` — deploy 後 URL smoke 記録
- `docs/ai-dev-team/cloud-run-first-deploy-troubleshooting-v0.4.1.md` — トラブルシューティング
- `docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md` — n8n 初回接続
- `docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md` — 接続結果記録
- `docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md` — Secret Manager 準備
- `docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md` — 本番移行メモ
