# Operator Release Record Schema v1.1.2

## JSON Schema

```json
{
  "version": "string",
  "timestamp": "ISO8601 string",
  "record": {
    "version": "string",
    "commit": "string",
    "pushed": "boolean",
    "actionsStatus": "string",
    "verified": "boolean",
    "releaseNotes": "string",
    "nextVersionCandidate": "string"
  }
}
```
