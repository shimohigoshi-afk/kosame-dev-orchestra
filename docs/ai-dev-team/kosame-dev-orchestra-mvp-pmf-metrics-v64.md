# KOSAME Dev Orchestra MVP / PMF Metrics Pack v64.0.0

## 概要

MVPリリース後に見るべき数字を標準化するpackです。

## 主要閾値 (業種により変動・hard guaranteeではない)

| 指標 | シグナル閾値 |
|------|------------|
| CVR | 1%以上: 初期シグナル / 2%以上: 強いシグナル |
| 30日継続率 | 15%以上: PMF候補 |
| PMFサーベイ | 40%以上: PMF候補 |
| LTV/CAC | ≥ 3: 健全 / ≥ 1: ギリギリ / < 1: 持続困難 |
| 課金 | 300DL中1件以上: 初期価値あり |

## AI/インフラコスト

LTV/CAC判断にはAI利用料・Cloud Run・Firestore・GCSなどのインフラ費を必ず含める。

## 安全設計

- `dryRun: true` / 実決済・実ユーザーデータ収集なし

## 使用方法

```bash
npm run pm-agent:mvp-pmf-metrics
npm run smoke:mvp-pmf-metrics
```
