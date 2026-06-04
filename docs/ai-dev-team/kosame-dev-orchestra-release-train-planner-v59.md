# KOSAME Dev Orchestra Release Train Planner v59.0.0

## 概要

複数プロダクトの開発順・優先度・リリース候補を5つのlaneに整理するpackです。

## Laneの定義

| Lane | 内容 |
|------|------|
| `now` | 今すぐ進める (低リスク / ready / blockerなし) |
| `next` | 次に進める (準備中 / 低〜中リスク) |
| `hold` | blockerがあるため保留 |
| `external_review` | 外部SEレビュー待ち |
| `production_gate` | 本番GO/NO-GOゲート通過が必要 |

## Lane割り当てルール

| 条件 | Lane |
|------|------|
| blockers > 0 | hold |
| externalReviewRequired = true | external_review |
| productionImpact / goNoGoRequired = true | production_gate |
| ready + riskLevel = low | now |
| ready or planning | next |

## デフォルトLane配置

- kosame_dev_orchestra v60 → **now**
- anesty_board next task → **next**
- email_reply_bot design → **next**
- cloud_run_pm_agent → **external_review** (IAM review pending)
- backoffice_agent design → **hold** (legal boundary未定義)
- sales_dx design → **hold** (customer/insurance data boundary未定義)

## 使用方法

```bash
npm run pm-agent:release-train-planner
npm run smoke:release-train-planner
```
