# KOSAME Dev Orchestra BackOffice Agent MVP Launch Plan v93.0.0

## 概要

BackOffice AgentのMVP Launch Planを作るpackです。
税務/法務/労務判断・送信・契約締結は人間承認に残します。

## 許可操作

- 問い合わせ分類・ルーティング
- 定型業務テンプレート生成 (下書きのみ)
- 経費申請の形式チェック補助
- FAQ自動応答下書き生成

## 禁止操作

- 税務判断 (断定禁止)
- 法務判断 (断定禁止)
- 労務判断 (断定禁止)
- 実送信 / 実契約締結 / 実請求 / 実給与計算

## 人間承認が必要な操作

- 税務・法務・労務の最終判断
- 契約書への署名・締結
- 請求書の送付・決済処理
- 個人情報・財務情報へのアクセス

## 使用方法

```bash
npm run pm-agent:backoffice-agent-mvp-launch-plan
npm run smoke:backoffice-agent-mvp-launch-plan
```
