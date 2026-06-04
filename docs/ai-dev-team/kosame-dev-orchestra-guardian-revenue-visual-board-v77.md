# KOSAME Dev Orchestra Guardian / Revenue Visual Board v77.0.0

## 概要

Guardian ClassとRevenue Launch Lineの通過状況を見える化するpackです。

## guardianClassStatus (5キー)

- attackSurfaceReview (v66)
- customerFacingOperationGuard (v67)
- dataSecretPermissionGate (v68)
- defensiveRedTeamDryRun (v69)
- guardianClassComplete (v70)

## revenueLaunchStatus (5キー)

- firstRevenueRoute (v71)
- offerPricingTest (v72)
- salesMessageOutreach (v73)
- pilotCustomerOnboarding (v74)
- firstRevenueCompleteGate (v75)

## 重要設計

- **Guardian未確認ならRevenue READY表示にしない**
- customer-facing productはv67通過必須
- data/secret/permission gate未通過ならHOLD表示
- 実送信・実契約・実請求・実導入はしない

## 使用方法

```bash
npm run pm-agent:guardian-revenue-visual-board
npm run smoke:guardian-revenue-visual-board
```
