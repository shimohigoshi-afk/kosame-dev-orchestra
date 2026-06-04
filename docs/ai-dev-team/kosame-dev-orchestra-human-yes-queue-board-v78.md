# KOSAME Dev Orchestra Human YES Queue Board v78.0.0

## 概要

じゅんやさんが最終YESすべきものだけを一覧化するpackです。
コピペ作業員に戻さず、YES/NO判断だけに圧縮します。

## YES Queue 9項目

1. git commit / push / tag
2. deploy (Cloud Run / gcloud)
3. Secret / .env / API key 閲覧・操作
4. Cloud Run / IAM / Secret Manager 設定変更
5. Gmail / メール実送信
6. 実顧客データ読取
7. 実契約・実請求・実導入
8. 外部SEレビュー依頼送付
9. 顧客に見える文章の最終送信

## 設計原則

- `autoProceedAllowed: false` — AIが勝手にYESしない
- `decisionOptions: [YES, NO, HOLD]`
- じゅんやさんには最終判断だけを残す
- 作業コマンドや細かい確認を増やしすぎない

## 使用方法

```bash
npm run pm-agent:human-yes-queue-board
npm run smoke:human-yes-queue-board
```
