# KOSAME Dev Orchestra — AI Fallback / Sanitized Handoff / Budget Guard Gate v110.1.0

## 概要

v110.1.0 の3つのパックを統合したゲート。
AI Fallback Router / Sanitized Handoff Guard / Budget Governor を順番に通過させ、
単一のステータスで判断を返す。

---

## ゲートステータス

| ステータス | 意味 |
|-----------|------|
| `READY` | 全チェックを通過、Human承認なしで続行可能 |
| `NEEDS_HUMAN_APPROVAL` | 続行可能だがHuman確認が推奨または必須 |
| `BLOCKED_UNSANITIZED_HANDOFF` | 非サニタイズ状態での外部ハンドオフをブロック |
| `BLOCKED_BUDGET` | 予算超過によりエスカレーションをブロック |
| `BLOCKED_DANGEROUS_ACTION` | 危険操作をOSポリシーでブロック |

---

## チェック順序

```
1. isDangerousAction → BLOCKED_DANGEROUS_ACTION
2. Sanitized Handoff Guard → BLOCKED_UNSANITIZED_HANDOFF
3. Budget Governor → BLOCKED_BUDGET
4. AI Fallback Router + failover validation
5. humanApprovalRequired 評価 → NEEDS_HUMAN_APPROVAL or READY
```

---

## 検証済み動作

| シナリオ | 期待ステータス |
|---------|--------------|
| `isDangerousAction:true` | `BLOCKED_DANGEROUS_ACTION` |
| `deepseek + sanitized:false` | `BLOCKED_UNSANITIZED_HANDOFF` |
| `kimi + denied contentType` | `BLOCKED_UNSANITIZED_HANDOFF` |
| `spentJpy >= hardCap + expensive model` | `BLOCKED_BUDGET` |
| `gemini fail → grok, low budget` | `NEEDS_HUMAN_APPROVAL` |
| `deepseek + sanitized + safe content` | `NEEDS_HUMAN_APPROVAL`（finalDecisionAllowed:false） |

---

## 不変条件（全ステータスで常に保証）

- `dryRun: true`
- `realProductActionsExecuted: false`
- `dangerousActionsDenied: true`
- `humanApprovalRequired: true`

---

## 使用方法

```bash
npm run pm-agent:ai-fallback-sanitized-budget-gate-pack
npm run smoke:ai-fallback-sanitized-budget-gate-pack
```

---

## 依存パック

- `dev-agent-ai-fallback-router-pack.js`
- `dev-agent-sanitized-handoff-guard-pack.js`
- `dev-agent-budget-governor-pack.js`

---

## バージョン

- v110.1.0 — 初版、2026-06-05
