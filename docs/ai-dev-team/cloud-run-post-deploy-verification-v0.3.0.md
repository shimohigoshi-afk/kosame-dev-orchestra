# Cloud Run Post-Deploy Verification — v0.3.0

## 概要

v0.4.0 Cloud Run deploy 実行後の確認手順。
smoke スクリプトと手動確認の両方を実施する。

**Human Approval のもと deploy 実行後に使用する。v0.3.0 では実施しない。**

---

## 自動確認（smoke）

```bash
# deploy 後に SERVICE_URL を指定して実行
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL

# 全チェックが PASS なら success: true が返る
```

### smoke で確認する項目

| チェック | 期待値 |
|---|---|
| `GET /health` | 200 / `{ status: "ok" }` |
| `GET /info` | 200 / `{ dryRunOnly: true }` |
| `POST /dry-run-task` (implementation) | 200 / `{ success: true, decision.recommendedOwner: "claude_code" }` |
| `POST /dry-run-task` (critical deploy) | 200 / `{ decision.blocked: true }` |

---

## 手動確認

```bash
# health チェック
curl -s https://SERVICE_URL/health | jq .

# info 確認
curl -s https://SERVICE_URL/info | jq .

# implementation タスク dry-run
curl -s -X POST https://SERVICE_URL/dry-run-task \
  -H "Content-Type: application/json" \
  -d '{"id":"VERIFY-001","title":"test","kind":"implementation","riskLevel":"low"}' | jq .
```

---

## Cloud Run コンソール確認

- [ ] revision が `SERVING` 状態
- [ ] request count が期待通り
- [ ] エラーレートが 0%
- [ ] レイテンシが許容範囲内（p99 < 5s）

---

## billing 確認

- [ ] Cloud Run の課金が発生していることを確認（想定範囲内か）
- [ ] 予期しない料金スパイクがないことを確認
- [ ] 予算アラートが正しく設定されていることを確認

---

## 確認失敗時の対応

smoke 失敗 → `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` 参照

```bash
# rollback コマンド生成
node tools/pm-agent-deploy-command-generator.js
# → rollbackChecklist.rollbackCommands を参照
```

---

## 結果記録

confirm 後、`docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` に記録する。

```bash
# テンプレート出力
node tools/pm-agent-first-deploy-result-template.js
```
