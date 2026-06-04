# KOSAME Dev Orchestra Guardian Customer-Facing Operation Guard v67.0.0

## 概要

顧客対向業務での事故を防ぐguardを定義するpackです。
保険営業DX特有のリスクを含む包括的なガードを提供します。

## 保険営業DX特有リスク

- 告知義務違反につながる表現を出さない
- 健康状態・病歴・健診結果を本文メールに出さない
- 保険料試算をAIが断定しない
- 保障額・保険料・契約詳細を本文に出さない
- 既契約情報の誤表示を防ぐ
- 被保険者・契約者・受取人の取り違えを防ぐ
- 保険会社・商品名・条件を誤って断定しない
- 引受可否・診査結果をAIが断定しない
- 金融・保険・税務・法務判断は人間確認ゲート
- 本文とPDF化すべき内容を分離する
- PDF化時はパスワード別送ルールを適用する

## 出力フラグ (v75 Required)

- `disclosureDutyRiskGuard: true`
- `healthInformationBodyBlock: true`
- `premiumEstimateNonDefinitivePolicy: true`
- `existingContractMixupGuard: true`
- `policyholderInsuredBeneficiaryVerification: true`
- `insurancePdfSeparationPolicy: true`

## 安全設計

- `dryRun: true` / 実メール送信なし / 実顧客情報アクセスなし

## 使用方法

```bash
npm run pm-agent:guardian-customer-facing-operation-guard
npm run smoke:guardian-customer-facing-operation-guard
```
