# KOSAME Dev Orchestra Guardian Attack Surface Review v66.0.0

## 概要

システムの攻撃面を洗い出し、リスクレベル別に整理するpackです。

## デフォルト攻撃面 (7項目)

| surfaceId | 攻撃面 | riskLevel |
|-----------|--------|-----------|
| as-001 | HTTP API endpoints (Cloud Run) | HIGH |
| as-002 | GitHub Actions CI/CD pipeline | HIGH |
| as-003 | Discord Bot webhook / token | HIGH |
| as-004 | Firestore / Cloud Storage | HIGH |
| as-005 | External AI API calls | MEDIUM |
| as-006 | Email / Gmail API | CRITICAL |
| as-007 | Admin / operator CLI | MEDIUM |

## 安全設計

- `dryRun: true` / `humanApprovalRequired: true`
- 実エクスプロイト実行なし / 実ペネトレーションテストなし

## 使用方法

```bash
npm run pm-agent:guardian-attack-surface-review
npm run smoke:guardian-attack-surface-review
```
