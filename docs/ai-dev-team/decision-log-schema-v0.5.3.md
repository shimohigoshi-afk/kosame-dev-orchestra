# Decision Log Schema (v0.5.3)

## スキーマ定義
```json
{
  "decisionId": "DEC-20260526-001",
  "commandId": "CMD-20260526-001",
  "decision": "approved / rejected / needs_repair / escalated",
  "rationale": "なぜその判断をしたかの理由（自然言語）",
  "reviewer": "Kosame PM",
  "evidence": {
    "verifyResult": "passed",
    "diffSnippet": "...",
    "riskLevel": "low"
  },
  "nextAction": "git commit / claude repair / human review",
  "timestamp": "2026-05-26T11:00:00Z"
}
```

## フィールド解説
- `rationale`: 後の監査で最も重要な項目。具体的に記載する。
- `evidence`: 判断の根拠となった検証結果や差分のスニペット。
