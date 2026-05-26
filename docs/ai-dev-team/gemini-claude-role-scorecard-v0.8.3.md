# Gemini / Claude Role Scorecard (v0.8.3)

## Scorecard フォーマット
```json
{
  "agentId": "Gemini",
  "period": "v0.7.1-v1.0.0",
  "metrics": {
    "totalTasks": 12,
    "successRate": 0.95,
    "autoVerifyPassRate": 0.8,
    "humanApprovalRate": 1.0,
    "averageCorrectionTurns": 0.2
  },
  "feedback": "Strong in bulk implementation. Minor issues in file naming consistency."
}
```

## 役割別期待値
- **Gemini**: 80% 以上のタスクが初回の verify を通過すること。
- **Claude**: 100% の失敗タスクを、3ターン以内に解決すること。
- **こさめPM**: 90% 以上の判断が、じゅんやさんの最終YES/NOと一致すること。
