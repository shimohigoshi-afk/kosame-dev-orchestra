# Claude Repair Intake (v0.5.4)

## 概要
Claude Repair Intake は、Gemini による大量生成や初期実装が失敗した際（verify 失敗等）、Claude Code に「補修」を依頼するためのパケット形式である。

## インテークパケット定義
```json
{
  "repairId": "REP-20260526-001",
  "sourceCommandId": "CMD-20260526-001",
  "failureLog": "npm run verify output showing syntax error at...",
  "targetFiles": ["src/parser.js"],
  "prohibitedFiles": ["config/secrets.json"],
  "completionCriteria": "npm run verify PASS",
  "maxTokens": 4000
}
```

## 運用ルール
1. 失敗ログ（Failure Log）を必ず添付する。
2. 修正対象（Target Files）を最小限に絞る。
3. 完了条件（Completion Criteria）を明確にする。
