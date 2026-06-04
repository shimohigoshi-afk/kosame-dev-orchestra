# KOSAME Dev Orchestra Guardian Data / Secret / Permission Gate v68.0.0

## 概要

データアクセス・シークレット管理・パーミッション境界を守るゲートpackです。

## ゲート構成

| 種別 | 件数 |
|------|------|
| dataAccessGates | 4 (Firestore/GCS/Logging/AI API) |
| secretGates | 4 (Discord/AI/Gmail/DB) |
| permissionBoundaries | 3 (Cloud Run SA / GitHub Actions / Developer) |

## overallGateStatus判定

| 状態 | 条件 |
|------|------|
| `GATE_OPEN_CRITICAL` | critical riskLevel のゲートがOPEN |
| `GATE_OPEN` | 非criticalゲートがOPEN |
| `ALL_GATES_PENDING_REVIEW` | 全ゲートPENDING (デフォルト) |

## 安全設計

- `dryRun: true` / `humanApprovalRequired: true`
- Secretの実読取なし

## 使用方法

```bash
npm run pm-agent:guardian-data-secret-permission-gate
npm run smoke:guardian-data-secret-permission-gate
```
