# KOSAME Dev Orchestra Pilot Customer Onboarding v74.0.0

## 概要

パイロット顧客オンボーディング計画をdryRunで設計するpackです。
Guardian Class (v70) 通過が前提条件です。

## pilotCustomerCriteria (5件)

- Guardian Classが通過済みであること
- 顧客の課題がプロダクトで解決できること
- 顧客からの「試したい」シグナルがあること
- 機密情報・保険情報の取り扱いに合意できること
- パイロット期間・目標・解約条件を事前合意できること

## onboardingSteps (6ステップ)

1. パイロット合意書確認 (human required)
2. 初期セットアップ dryRun確認 (human required)
3. キックオフMTG (human required)
4. 週次チェックイン
5. 中間レビュー2週後 (human required)
6. パイロット完了レビュー30日後 (human required)

## 安全設計

- `dryRun: true` / `guardianClassRequired: true` / `realOnboardingExecuted: false`

## 使用方法

```bash
npm run pm-agent:pilot-customer-onboarding
npm run smoke:pilot-customer-onboarding
```
