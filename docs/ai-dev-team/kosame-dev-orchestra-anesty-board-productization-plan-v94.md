# KOSAME Dev Orchestra ANESTY Board Productization Plan v94.0.0

## 概要

ANESTY Boardを商品化候補として整理するpackです。
SNS投稿制作支援・会議Bot・コンテンツ企画支援としてpilot可能性を検討します。

## Productization Angles

| angle | riskLevel |
|-------|-----------|
| SNS投稿制作支援Bot | low |
| 会議・ブレスト支援Bot | medium |
| コンテンツ企画支援 | low |

## Pilot Offer

- type: pilot_free_then_paid
- channel: じゅんやさんの直販 / 紹介
- price: 月額 数千〜数万円 (需要検証後に決定)
- hardGuarantee: false

## Discord Operational Risk

- webhookSend: BLOCKED (じゅんやさんYES必須)
- autoPost: BLOCKED (実投稿は人間のみ)
- botToken: BLOCKED (Secret Manager、AIは読まない)

## 安全設計

- `dryRun: true`
- Discord/Webhook実送信なし
- 外部ANESTY repo変更なし
- SNS実投稿なし

## 使用方法

```bash
npm run pm-agent:anesty-board-productization-plan
npm run smoke:anesty-board-productization-plan
```
