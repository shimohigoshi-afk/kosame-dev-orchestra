# KOSAME Dev Orchestra First Revenue Complete Gate v75.0.0

## 概要

v66〜v74を統合し、初回収益パイロット開始可否を判定するゲートpackです。

## READY_TO_PILOT 必須条件

- Guardian Class (v70) completePackReady = true
- guardianReadiness.status = READY
- customer-facing operation guard 確認済み (v67)
- data/secret/permission gate 確認済み (v68)
- revenue route定義済み (v71)
- offer variant存在 (v72)
- sales message準備済み (v73)
- onboarding plan存在 (v74)
- blockers = 0
- humanApprovalRequired = true

## 判定ロジック

| 条件 | 判定 |
|------|------|
| Guardian Class未確認 | HOLD |
| guardianReadiness.status ≠ READY | HOLD |
| customerFacingGuard未確認 | HOLD |
| dataSecretPermission未確認 | HOLD |
| blockers > 0 | BLOCKED |
| 全条件クリア | READY_TO_PILOT |

## 実行禁止事項

- 実決済・実契約・実オンボーディング・実メール送信は人間承認ゲートを通す

## 使用方法

```bash
npm run pm-agent:first-revenue-complete-gate
npm run smoke:first-revenue-complete-gate
```
