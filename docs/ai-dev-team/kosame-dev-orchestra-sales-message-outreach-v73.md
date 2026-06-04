# KOSAME Dev Orchestra Sales Message / Outreach v73.0.0

## 概要

営業メッセージ・アウトリーチ計画をdryRunで設計するpackです。
実メール送信・実SNS投稿は実行しません。

## salesMessages (3種)

- direct_sales 向けメール (dryRunOnly: true)
- existing_customer_upsell 向けメール (dryRunOnly: true)
- SNS投稿ドラフト (dryRunOnly: true、実投稿は人間承認後)

## outreachSequence

5ステップ。人間承認が必要なステップを明示。

## 安全設計

- `dryRun: true` / `realOutreachExecuted: false`
- 全メッセージ `dryRunOnly: true` / `realSendExecuted: false`
- 実送信はじゅんやさんの承認ゲートを通す

## 使用方法

```bash
npm run pm-agent:sales-message-outreach
npm run smoke:sales-message-outreach
```
