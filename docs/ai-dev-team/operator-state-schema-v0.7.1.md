# Operator State Schema (v0.7.1)

## JSON Schema 定義（概念）
```json
{
  "type": "object",
  "properties": {
    "version": { "type": "string" },
    "state": {
      "type": "object",
      "properties": {
        "currentVersion": { "type": "string" },
        "currentPhase": { "type": "string" },
        "lastCommit": { "type": "string" },
        "workflowStatus": { "type": "string" },
        "pendingApproval": {
          "type": "array",
          "items": { "type": "string" }
        },
        "nextAction": { "type": "string" },
        "activeAgent": { "type": "string" },
        "riskLevel": { "type": "string" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["currentVersion", "workflowStatus", "nextAction", "updatedAt"]
    }
  }
}
```

## 制約
- `updatedAt` は ISO 8601 形式とする。
- `riskLevel` は `Low`, `Medium`, `High`, `Critical` のいずれか。
- `workflowStatus` は `Idle`, `Running`, `Success`, `Failure`, `ApprovalRequired` 等。
