# KOSAME Dev Orchestra First Real Product Launch Gate v95.0.0

## 概要

v91〜v94を統合し、どの実プロダクトを最初にpilotすべきか判定するpackです。
KOSAME Dev Orchestraを「実商品投入の手前」まで進めます。

## Candidate Products

- sales_dx / email_reply_bot / backoffice_agent / anesty_board

## Launch Decision Options

| 決定 | 条件 |
|------|------|
| PILOT_ANESTY_BOARD | Guardian READY + 低リスク + ブロッカーなし |
| PILOT_EMAIL_REPLY_BOT | Guardian READY + draft-only |
| PILOT_SALES_DX | Guardian READY + Revenue READY + データ境界確認済み |
| PILOT_BACKOFFICE_AGENT | Guardian READY + 法務/税務方針確定済み |
| VALIDATE_MORE | Revenue未確認 / Cloud Run未確認 |
| HOLD | Guardian未確認 / 実顧客データ必要 / 実送信必要 |

## 判定ルール

| 条件 | 判定 |
|------|------|
| Guardian未確認 | HOLD |
| Revenue未確認 | VALIDATE_MORE |
| Cloud Run未確認 | VALIDATE_MORE |
| customerDataBoundary不明 | HOLD |
| 実送信・実顧客データ必要 | HOLD |
| all ready + no blockers | pilot candidate |

## 安全設計

- `dryRun: true` / `humanApprovalRequired: true`
- `realProductActionsExecuted: false`
- じゅんやさんが最終YES担当

## 使用方法

```bash
npm run pm-agent:first-real-product-launch-gate
npm run smoke:first-real-product-launch-gate
```
