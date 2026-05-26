# Cloud Run Incident Response — v0.3.0

## 概要

v0.4.0 Cloud Run deploy 後のインシデント対応ガイド。
deploy 後に問題が発生した場合の対応手順と rollback 判断基準を定義する。

**Human Approval のもと deploy 実行後に参照する。v0.3.0 では実行しない。**

---

## インシデントレベル定義

| レベル | 条件 | 対応優先度 |
|---|---|---|
| P1 | サービス停止 / 課金異常 / smoke 全失敗 | 即時対応 |
| P2 | smoke 一部失敗 / /health 200 以外 / エラーレート急上昇 | 30分以内 |
| P3 | レイテンシ増加 / エラーレート微増 | 翌日対応 |

---

## P1 対応手順（即時）

```bash
# 1. 状態確認
gcloud run services describe pm-agent --region asia-northeast1 --project PROJECT_ID

# 2. rollback 実行（旧 revision へ traffic 切り替え）
gcloud run services update-traffic pm-agent \
  --to-revisions PREVIOUS_REVISION=100 \
  --region asia-northeast1 \
  --project PROJECT_ID

# 3. rollback 後 smoke 確認
node tools/pm-agent-post-deploy-smoke.js <PREVIOUS_URL>

# 4. billing 異常の場合はサービス停止
gcloud run services update pm-agent --max-instances 0 --region asia-northeast1 --project PROJECT_ID
```

**全操作は Human Approval 後のみ実行すること。**

---

## P2 対応手順

```bash
# smoke 実行（失敗箇所の特定）
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL

# ログ確認
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=pm-agent" \
  --project PROJECT_ID --limit 50

# revision の状態確認
gcloud run revisions list --service pm-agent --region asia-northeast1 --project PROJECT_ID
```

---

## rollback 判断基準

| 状況 | 推奨アクション |
|---|---|
| smoke 全失敗 | 即時 rollback |
| /health 非 200 | 即時 rollback |
| blocking エラー多発 | rollback 検討 |
| billing スパイク | サービス停止・原因調査 |
| レイテンシのみ増加 | ログ確認・原因特定後に判断 |

---

## rollback コマンド

```bash
# rollback 候補コマンド生成（実行しない・確認用）
node tools/pm-agent-deploy-command-generator.js

# rollback 実行（Human Approval 後）
gcloud run services update-traffic pm-agent \
  --to-revisions PREVIOUS_REVISION=100 \
  --region asia-northeast1 \
  --project PROJECT_ID
```

---

## インシデント記録

問題発生時は `docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` に記録する。

```bash
# 記録テンプレート
node tools/pm-agent-first-deploy-result-template.js
```

---

## 参考

- `docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md` — 再 deploy 判断
- `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` — rollback 詳細手順
- `tools/pm-agent-runtime-ops-packet.js` — 運用コマンドパック
