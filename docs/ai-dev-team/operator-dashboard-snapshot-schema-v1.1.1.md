# Operator Dashboard Snapshot Schema v1.1.1

## JSON Schema (Simplified)

```json
{
  "version": "string",
  "timestamp": "ISO8601 string",
  "cards": {
    "status": { "phase": "string", "version": "string" },
    "verification": { "result": "string", "timestamp": "string" },
    "actions": { "status": "string", "runId": "string" },
    "governance": { "pendingApprovals": "number", "riskLevel": "string" },
    "execution": { "nextAction": "string", "agent": "string" }
  }
}
```
