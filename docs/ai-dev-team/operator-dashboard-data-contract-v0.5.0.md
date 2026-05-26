# Operator Dashboard Data Contract — v0.5.0

## 概要

オペレータコンソールのダッシュボードが表示するデータのスキーマ定義。

---

## データ構造

### DashboardSummary
```json
{
  "timestamp": "ISO-8601-String",
  "orchestraName": "KOSAME Dev Orchestra",
  "version": "0.5.0",
  "globalStatus": "HEALTHY | WARNING | CRITICAL",
  "totalCost": {
    "amount": number,
    "currency": "JPY",
    "budgetUsage": number (percentage)
  },
  "agents": [AgentStatus]
}
```

### AgentStatus
```json
{
  "id": "string",
  "name": "string",
  "status": "ONLINE | OFFLINE | BUSY",
  "lastSmokeResult": "PASS | FAIL",
  "currentModel": "string",
  "version": "string"
}
```

---

## データ収集サイクル

1. **Active Pull**: コンソール起動時に各エージェントの `/health` および `/info` エンドポイントを叩く。
2. **Log Subscription**: Cloud Logging から特定のエラーシグナルをフィルタリングして表示。
3. **Billing API Integration**: (将来拡張) GCP Billing API からの実測値取得。

---

## 参考

- `docs/ai-dev-team/dev-orchestra-operator-console-foundation-v0.5.0.md`
- `apps/pm-agent/task-packet-schema.js`
