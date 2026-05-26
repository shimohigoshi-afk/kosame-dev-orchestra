# Operator Console Bundle Schema v1.2.2

## スキーマ定義

```json
{
  "version": "1.2.2",
  "timestamp": "<ISO8601>",
  "bundleType": "operator-console",
  "state": {
    "workflowStatus": "Idle | Running | Blocked | Complete",
    "riskLevel": "Low | Medium | High"
  },
  "snapshot": "<dashboard snapshot or null>",
  "approvalPending": ["<approval item>"],
  "lastVerify": "<verify result or null>",
  "lastActions": "<GHA result or null>",
  "dryRun": true
}
```

## バリデーションルール
- `version` は必須
- `bundleType` は `"operator-console"` 固定
- `dryRun` は常に `true`（本番操作禁止）
- `approvalPending` が空でない場合、Human Approval Gate を発動する
