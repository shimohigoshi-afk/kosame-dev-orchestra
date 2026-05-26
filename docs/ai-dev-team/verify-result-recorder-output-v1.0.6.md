# Verify Result Recorder Output v1.0.6

## Output Schema

```json
{
  "version": "1.0.6",
  "timestamp": "2026-05-26T12:00:00Z",
  "result": "pass | fail",
  "summary": "Short description of the result",
  "failedSmoke": ["list of failing smoke tests"],
  "nextRepairOwner": "Claude | Gemini | Human",
  "commitAllowed": true | false
}
```
