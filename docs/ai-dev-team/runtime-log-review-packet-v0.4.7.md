# Runtime Log Review Packet — v0.4.7

## 概要

トラブルシューティング時に、Cloud Logging から効率的に情報を抽出するためのクエリ集。

---

## ログ抽出クエリ

### 全般エラー確認
```sql
resource.type="cloud_run_revision"
severity>=ERROR
```

### タイムアウト調査
```sql
resource.type="cloud_run_revision"
textPayload:"timeout" OR textPayload:"deadline"
```

### モデル API 呼び出し失敗
```sql
resource.type="cloud_run_revision"
textPayload:"GoogleGenerativeAIError" OR textPayload:"OpenAIError"
```

### 特定のトレース ID による追跡
```sql
resource.type="cloud_run_revision"
logging.googleapis.com/trace="[TRACE_ID]"
```

---

## ログ確認チェックリスト

- [ ] エラーメッセージに API Key が含まれていないか？
- [ ] スタックトレースから根本原因が特定できるか？
- [ ] 発生頻度は増加傾向にあるか？
- [ ] 特定の入力パターンで発生しているか？

---

## 参考

- `docs/ai-dev-team/pm-agent-runtime-monitoring-v0.4.7.md`
- `docs/ai-dev-team/runtime-health-signal-guide-v0.4.7.md`


## Query Examples

This packet keeps Cloud Logging Query examples as dry-run references only.
These Query examples are for human review and must not execute gcloud commands automatically.
