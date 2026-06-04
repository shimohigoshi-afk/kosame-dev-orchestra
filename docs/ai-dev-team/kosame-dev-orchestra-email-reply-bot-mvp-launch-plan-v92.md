# KOSAME Dev Orchestra Email Reply BOT MVP Launch Plan v92.0.0

## 概要

Email Reply BOTのMVP Launch Planを作るpackです。
下書き生成だけから始め、実送信はしません。

## Draft-Only Policy

- `autoSendBlocked: true`
- 全メール出力はdraftのみ
- 実送信はじゅんやさん / 担当者が手動実行

## Gmail Handling Policy

- Gmail API: HUMAN_GATE (じゅんやさんYES後のみ)
- draftOnly: true
- oauth scope: gmail.readonly or gmail.compose (not gmail.send)

## PDF Separation Policy

- 保障額・保険料・契約詳細・健康情報はPDF化
- パスワードは別メール別送

## 安全設計

- `dryRun: true` / `autoSendBlocked: true`
- 実Gmail送信なし / 実顧客データなし

## 使用方法

```bash
npm run pm-agent:email-reply-bot-mvp-launch-plan
npm run smoke:email-reply-bot-mvp-launch-plan
```
