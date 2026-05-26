# Cloud Run Production Cutover Notes — v0.4.2

## 概要

v0.4.2 Cloud Run PM Agent 本番移行（production cutover）メモ。

**Human Approval なしに本番移行を実施しない。**
**cutover はじゅんやさんが Go/No-Go チェックリストを確認後に実施する。AIは実行しない。**
**rollback 手順と billing 監視を準備してから cutover を開始する。**

cutover pack 生成: `node tools/pm-agent-production-cutover-pack.js`

---

## Go/No-Go チェックリスト

以下の全条件が満たされた場合のみ production cutover を実施する:

- [ ] npm run verify → 全 smoke PASS
- [ ] npm run pm-agent:deploy-readiness-final-check → readyForHumanDeploy: true
- [ ] v0.4.0 deploy 完了 & Cloud Run URL 確定
- [ ] v0.4.1 smoke 全 PASS（health / info / dry-run-task）
- [ ] billing: 課金が想定範囲内
- [ ] Cloud Run console: revision healthy
- [ ] n8n 接続テスト PASS（v0.4.2）
- [ ] Secret Manager: 必要な Secret が登録済み
- [ ] rollback 手順を把握済み
- [ ] じゅんやさんの承認（Human Approval）

**No-Go 条件（1件でも該当したら実施しない）:**
- smoke 失敗が 1 件でもある
- billing スパイク（予算超過）
- Cloud Run revision が unhealthy
- n8n 接続テスト失敗
- Secret Manager 接続エラー
- Human Approval 未取得

---

## rollback ウィンドウ計画

production deploy 後 24h は rollback 準備を維持する。

**rollback トリガー:**
- smoke fail → 即時 rollback 検討
- billing スパイク → サービス停止・原因調査
- n8n 接続失敗 → Cloud Run 設定確認・rollback 検討
- 予期しないエラーレート上昇 → ログ確認・判断

```bash
# revision 一覧確認（Human Approval 後に実行）
gcloud run revisions list --service pm-agent --region asia-northeast1 --project PROJECT_ID

# 旧 revision へ traffic 切り替え（Human Approval 後に実行）
gcloud run services update-traffic pm-agent \
  --to-revisions PREVIOUS_REVISION=100 \
  --region asia-northeast1 \
  --project PROJECT_ID
```

rollback 判断権限: じゅんやさんのみ判断・実行

---

## 本番移行後の monitoring 計画

deploy 後 72h は集中監視を実施する:

| 監視項目 | 頻度 | 方法 |
|---|---|---|
| Health check | 1時間おき | curl -s SERVICE_URL/health |
| Error rate | Cloud Monitoring で自動 | Cloud Run コンソール |
| Latency p99 | Cloud Monitoring で自動 | Cloud Run コンソール |
| billing | 1日おき | GCP billing コンソール |
| n8n connection | 初回接続後 24h | n8n workflow 実行ログ |

**アラート閾値:**
- Error rate: 1% 超えたら調査
- Latency p99: 5s 超えたら調査
- billing: 想定超過で即確認

---

## production 移行順序

1. Go/No-Go チェックリスト全項目 ✓
2. じゅんやさんの承認（Human Approval）
3. rollback 手順を手元に用意
4. 72h 集中監視開始
5. billing アラート設定確認
6. 問題なければ next version（v0.5.0）へ

---

## production 運用時の billing 注意事項

production cutover 前後は billing を注視する:

- Cloud Run は production 相当。billing・security の監視を継続する。
- max-instances 1 → 需要に応じてじゅんやさんが判断して変更
- 予期しない料金スパイクは即調査・必要に応じてサービス停止

---

## v0.5.0 候補

- `dryRunOnly: false` 移行（実際の AI ルーティング実行）
- Secret Manager 本格接続（OPENAI_API_KEY / GEMINI_API_KEY）
- Cloud Run Invoker 認証追加（n8n → Cloud Run の認証強化）
- max-instances スケール設定見直し

---

## 参考

- `tools/pm-agent-production-cutover-pack.js` — cutover pack 生成
- `docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md` — smoke 記録
- `docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md` — n8n 接続
- `docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md` — Secret Manager 準備
- `docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md` — 接続結果記録
- `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` — rollback 手順
