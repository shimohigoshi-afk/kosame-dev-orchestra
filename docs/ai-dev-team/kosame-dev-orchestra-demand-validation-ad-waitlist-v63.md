# KOSAME Dev Orchestra Demand Validation Ad / Waitlist Pack v63.0.0

## 概要

広告・SNS・waitlistで需要を検証するためのdryRun設計packです。
実広告出稿はしません。

## CPA判断基準 (exampleOnly)

| CPA | シグナル | 推奨 |
|-----|---------|------|
| ≤ 300円 | 強い需要シグナル | BUILD候補 |
| 300〜1000円 | 追加検証・訴求改善 | VALIDATE_MORE |
| 1000円超 | 需要シグナルが弱い | PIVOT検討 |

**注意:** 数値は業種・競争環境により変動。hard guaranteeではない。

## 安全設計

- `dryRun: true` / `adBudgetPlan.executedInThisPack: false`
- 実広告出稿なし / 実SNS投稿なし / 実LP公開なし

## 使用方法

```bash
npm run pm-agent:demand-validation-ad-waitlist
npm run smoke:demand-validation-ad-waitlist
```
