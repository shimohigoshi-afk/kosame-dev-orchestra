# KOSAME Dev Orchestra Multi-Product Progress Board v79.0.0

## 概要

6プロダクトの進捗を一覧化するpackです。

## 6プロダクト

| productId | 状態 | riskLevel |
|-----------|------|-----------|
| kosame_dev_orchestra | ACTIVE | low |
| anesty_board | ACTIVE | medium |
| cloud_run_pm_agent | ACTIVE | high |
| sales_dx | PLANNING | critical |
| backoffice_agent | PLANNING | high |
| email_reply_bot | PLANNING | medium |

## 6レーン

- `nowLane` / `nextLane` / `holdLane`
- `guardianLane` / `revenueLane` / `externalReviewLane`

## 設計原則

- 実repoを読みに行かない
- repoPathは文字列参照のみ
- 外部repoには触らない

## 使用方法

```bash
npm run pm-agent:multi-product-progress-board
npm run smoke:multi-product-progress-board
```
