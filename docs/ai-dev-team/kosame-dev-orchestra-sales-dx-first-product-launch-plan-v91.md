# KOSAME Dev Orchestra Sales DX First Product Launch Plan v91.0.0

## 概要

営業DXを最初の実プロダクト候補としてLaunch Plan化するpackです。
実repo・実顧客・実データには触らずdryRun設計まで。

## First Use Case: AI議事録・提案書下書き生成 (draft-only)

- scope: draft_only
- realSend: false
- Human-in-the-loop必須

## Guardian必須項目

- v67 customerFacingOperationGuard (告知義務/健康情報/PDF分離)
- v68 dataSecretPermissionGate
- v70 guardianClassComplete

## Data Boundary

- customerPII: BLOCKED
- insuranceData: BLOCKED + PDF化 + パスワード別送
- premiumEstimate: NON_DEFINITIVE
- financialLegalJudge: HUMAN_GATE

## Launch Blockers

- Guardian Class未通過
- 顧客/保険データ境界 未定義 → External SE必須
- Cloud Run deploy 未承認

## 使用方法

```bash
npm run pm-agent:sales-dx-first-product-launch-plan
npm run smoke:sales-dx-first-product-launch-plan
```
