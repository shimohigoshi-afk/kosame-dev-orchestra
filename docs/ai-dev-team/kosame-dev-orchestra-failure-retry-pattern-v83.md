# KOSAME Dev Orchestra v83.0.0 Failure / Retry Pattern Pack

This pack stores known failures and retry policies.

Required known failures include:
- verify script replaced by node -e
- simulated verification without real logs
- wrong relative path in tools/smoke
- git add -A included unexpected files
- docs count mismatch
- Claude prompt missing forbiddenFiles / forbiddenCommands
- timeout追加だけで原因未特定

The goal is to prevent loops and repeated mistakes.
