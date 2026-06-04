# KOSAME Dev Orchestra Product Portfolio Operation Board v56.0.0

## 概要

KOSAME Dev Orchestraが複数プロダクトを横断して一覧表示するOperation Boardです。
6プロダクトの状態・次アクション・担当AI・危険ゲートを一覧で確認できます。

## 対象プロダクト

| productId | 製品名 | フェーズ | readinessStatus |
|-----------|-------|---------|----------------|
| anesty_board | ANESTY Board | controlled_task_operation | ACTIVE |
| sales_dx | 営業DX | design | PLANNING |
| backoffice_agent | BackOffice Agent | design | PLANNING |
| email_reply_bot | Email Reply BOT | design | PLANNING |
| cloud_run_pm_agent | Cloud Run PM Agent | production | ACTIVE |
| kosame_dev_orchestra | KOSAME Dev Orchestra | active_development | ACTIVE |

## 設計原則

- `dryRun: true` — 実repoを読みに行かない (repoPathは文字列参照のみ)
- `humanApprovalRequired: true` — 全製品で常にtrue
- 全DANGER GATES BLOCKED

## 使用方法

```bash
npm run pm-agent:product-portfolio-operation-board
npm run smoke:product-portfolio-operation-board
```
