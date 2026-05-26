# cloud-run/ — Cloud Run Launch Pack (v2.0.0)

## 概要

v0.7.0 Cloud Run Launch Pack MAX の Cloud Run 関連設定ファイル置き場。

**v2.0.0 は Local Operator Console Complete を達成。** 次フェーズ v2.1.x で Cloud Run UI が加わる予定。

---

## v0.4.7 - v0.7.0 Runtime & Operator Packs

| ファイル | 役割 |
|---|---|
| `docs/ai-dev-team/pm-agent-runtime-monitoring-v0.4.7.md` | 運用監視設計 |
| `docs/ai-dev-team/cost-control-routing-extension-v0.4.8.md` | コスト制御設計 |
| `docs/ai-dev-team/release-governance-v0.4.9.md` | リリースガバナンス設計 |
| `docs/ai-dev-team/dev-orchestra-operator-console-foundation-v0.5.0.md` | オペレーターコンソール基盤設計 |
| `docs/ai-dev-team/operator-command-packet-v0.5.1.md` | オペレーターコマンドパケット定義 |
| `docs/ai-dev-team/agent-dispatch-queue-v0.5.2.md` | エージェントディスパッチキュー設計 |
| `docs/ai-dev-team/operator-runbook-v0.6.0.md` | オペレーターランブック正本 |
| `docs/ai-dev-team/operator-command-foundation-complete-v0.7.0.md` | 基盤土台完成宣言 |
| `docs/ai-dev-team/operator-console-api-contract-v0.9.0.md` | コンソール API 契約 |
| `docs/ai-dev-team/operator-console-security-boundary-v0.9.0.md` | API セキュリティ境界 |
| `docs/ai-dev-team/operator-console-mvp-foundation-complete-v1.0.0.md` | MVP 基礎完成宣言 |
| `docs/ai-dev-team/operator-console-practical-mvp-complete-v1.2.0.md` | Practical MVP 完成宣言 |
| `docs/ai-dev-team/operator-local-console-complete-v1.4.0.md` | Local Console Complete 宣言 |
| `docs/ai-dev-team/kosame-dev-orchestra-local-operator-complete-v2.0.0.md` | v2.0.0 リリース宣言 |
| `docs/ai-dev-team/operator-console-cloud-run-ui-entry-v1.5.0.md` | Cloud Run UI 設計（v2.1.x 予定） |

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
