# Operator Command Packet (v0.5.1)

## 概要
Operator Command は、人間（オペレーター）または上位エージェントが、下位エージェントやシステムに対して発行する「実行単位」を定義するパケットである。

## パケット定義 (JSON Schema 案)
```json
{
  "commandId": "CMD-20260526-001",
  "version": "0.5.1",
  "title": "v0.5.1 Operator Command Packet の実装",
  "purpose": "オペレーターの操作をパケット化し、トレーサビリティと安全性を確保する",
  "owner": "Gemini Agent",
  "executor": "Gemini Agent / Claude Code",
  "risk": "low",
  "approvalGate": "kosame-pm",
  "humanApprovalRequired": false,
  "dryRunOnly": false,
  "prohibitedActions": ["git push", "deploy"],
  "nextAction": "smoke test 実行",
  "createdAt": "2026-05-26T10:00:00Z"
}
```

## 運用ルール
1. すべての主要操作は commandId を持つ。
2. risk が high の場合は humanApprovalRequired を true にする。
3. dryRunOnly が true の場合は、実際の書き込みを行わずに結果のみを報告する。
