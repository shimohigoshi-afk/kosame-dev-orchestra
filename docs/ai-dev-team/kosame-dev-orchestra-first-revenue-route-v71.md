# KOSAME Dev Orchestra First Revenue Route v71.0.0

## 概要

初回収益ルートを設計するpackです。
Guardian Class (v70) 通過を前提条件とします。

## 含む項目

- revenueModel (subscription / one_time / freemium / pilot_free_then_paid)
- pricingHypothesis (価格は要検証)
- acquisitionChannel (直販 / 既存顧客 / 紹介 / SNS / waitlist転換)
- conversionPath (4ステップ)
- firstRevenueTarget (初回有料顧客1件)
- revenueBlockers (Guardian Class要件含む)

## 安全設計

- `dryRun: true` / `realRevenueActions: false`
- 実決済・実契約なし

## 使用方法

```bash
npm run pm-agent:first-revenue-route
npm run smoke:first-revenue-route
```
