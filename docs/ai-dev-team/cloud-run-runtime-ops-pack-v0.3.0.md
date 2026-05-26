# Cloud Run Runtime Ops Pack — v0.3.0

## 概要

v0.4.0 Cloud Run deploy 後の runtime 運用ガイド。
モニタリング・スケーリング・billing 管理・ログ確認の基本操作をまとめる。

**Human Approval のもと deploy 実行後に使用する。v0.3.0 では実行しない。**

---

## runtime ツール

```bash
# 運用パケット生成（コマンド文字列生成のみ・実行しない）
node tools/pm-agent-runtime-ops-packet.js
```

---

## ヘルス確認

```bash
# health チェック
curl -s https://SERVICE_URL/health | jq .

# Cloud Run コンソールで確認
gcloud run services describe pm-agent --region asia-northeast1 --project PROJECT_ID
```

---

## ログ確認

```bash
# Cloud Run ログ確認
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=pm-agent" \
  --project PROJECT_ID \
  --limit 50 \
  --format json
```

---

## スケーリング操作

v0.4.0 初回は `max-instances: 1` で運用。
スケールアップは Human Approval 後に実施。

```bash
# スケールアップ（承認後）
gcloud run services update pm-agent \
  --region asia-northeast1 \
  --project PROJECT_ID \
  --max-instances 3
```

---

## billing 管理

| 項目 | 推奨設定 |
|---|---|
| 予算アラート | ¥500/月（初回段階） |
| min-instances | 0（コールドスタート許容） |
| max-instances | 1（v0.4.0 初回） |
| billing 確認頻度 | deploy 後 24h は毎日確認 |

---

## サービス停止（billing スパイク時）

```bash
# スケールゼロ（リクエストを受け付けない）
gcloud run services update pm-agent \
  --region asia-northeast1 \
  --project PROJECT_ID \
  --max-instances 0

# 完全削除（最終手段）
gcloud run services delete pm-agent \
  --region asia-northeast1 \
  --project PROJECT_ID
```

**上記操作は Human Approval 後のみ実行すること。**

---

## revision 管理

```bash
# revision 一覧
gcloud run revisions list \
  --service pm-agent \
  --region asia-northeast1 \
  --project PROJECT_ID

# traffic 切り替え（rollback）
gcloud run services update-traffic pm-agent \
  --to-revisions REVISION_NAME=100 \
  --region asia-northeast1 \
  --project PROJECT_ID
```

---

## モニタリングチェックリスト（deploy 後 24h）

- [ ] Cloud Run console: revision healthy
- [ ] GET /health → 200
- [ ] Billing: 予想範囲内
- [ ] Error rate: 0%
- [ ] Latency p99: 5s 以内
- [ ] Cold start latency: 許容範囲内

---

## 参考

- `tools/pm-agent-runtime-ops-packet.js` — 運用コマンドパック生成
- `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` — 障害対応
- `docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md` — 再 deploy 判断
