# KOSAME Dev Orchestra Product-Specific Build Flow v57.0.0

## 概要

プロダクトごとに開発導線を標準化するpackです。
productTypeごとにallowedTaskTypes / forbiddenTaskTypes / externalReviewTriggersが定義されます。

## productType別方針

| productType | 低リスク範囲 | 承認ゲート |
|-------------|-----------|----------|
| discord_ai_board | docs / smoke / routing | bot.js / Webhook / deploy |
| sales_dx_pipeline | docs / dryRun / prompt template | 顧客/保険情報 / Gmail / GCS |
| backoffice_agent | docs / 分類template | 税務/法務判断 / 契約送信 |
| email_reply_bot | docs / template / tone | Gmail実送信 / PII / 添付 |
| cloud_run_pm_agent | docs / preflight | gcloud deploy / IAM / Secret |
| dev_orchestra_core | tools / smoke / fixtures | git add/commit/push/tag |

## 共通禁止コマンド

- git add/commit/push/tag/reset --hard
- deploy/docker build/gcloud deploy
- rm -rf / cat .env / printenv

## 使用方法

```bash
npm run pm-agent:product-specific-build-flow
npm run smoke:product-specific-build-flow
```
