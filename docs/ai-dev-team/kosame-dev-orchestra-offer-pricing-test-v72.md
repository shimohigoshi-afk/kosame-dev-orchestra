# KOSAME Dev Orchestra Offer / Pricing Test v72.0.0

## 概要

オファー・価格設計テストをdryRunで行うpackです。
実課金・実請求は実行しません。

## offerVariants (3種)

- 無料パイロット (30日)
- 月額スタータープラン (価格TBD)
- 初回割引オファー (割引率TBD)

## pricingMatrix

- `hardGuarantee: false` — 価格は断定しない
- AI/インフラコストをLTV/CAC計算に含める
- 需要検証・競合調査を基に設定する

## 安全設計

- `dryRun: true` / `realBillingExecuted: false`
- 実課金なし / 実契約なし

## 使用方法

```bash
npm run pm-agent:offer-pricing-test
npm run smoke:offer-pricing-test
```
