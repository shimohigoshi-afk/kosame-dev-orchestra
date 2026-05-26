# GitHub Actions Recorder Output v1.0.7

## Output Schema

```json
{
  "version": "1.0.7",
  "timestamp": "2026-05-26T12:00:00Z",
  "workflow": "Workflow Name",
  "runId": "123456",
  "status": "success | running | failed | cancelled",
  "nextAction": "Release | Wait | Repair | Re-run"
}
```
