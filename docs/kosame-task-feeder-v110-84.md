# KOSAME Task Feeder 作業票

> バージョン: 110.84.0  
> 作業名: v110.84 KOSAME Task Feeder  
> 方針: Task Vault から今やる 1〜3 件と later ideas を小出しで返す

## 目的

Task Vault に保存されたタスクと wishlist を、今やる候補と後で提案するアイデアに分けて Cockpit に出す。

## 実装範囲

- Task Vault のタスク一覧から候補を最大 3 件選ぶ
- blocked / done / dependency 未解決 / human gate を分離する
- Cockpit snapshot に `taskFeeder` を追加する
- Cockpit に `NEXT TASK FEED` と `WISHLIST / LATER IDEAS` を追加する
- `wishlist.jsonl` の保存/読込と小出し候補化

## 変更予定ファイル

- `tools/kosame-task-feeder.js`
- `tools/kosame-task-vault.js`
- `tools/kosame-live-cockpit-snapshot.js`
- `public/kosame-live-cockpit.html`
- `config/kosame-task-feeder-policy.json`
- `smoke/v110-84-task-feeder-smoke.js`
- `package.json`

## 危険ゲート

- `git add / commit / push / tag` は実行しない
- `kosame-sales-dx` と `transcriber` は触らない
- Secret / API key / `.env` / credentials の値は読まない
- DeepSeek / opencode は使わない
- 外部 API / DB / Gmail 接続はしない

## feeder の選定ルール

- `status: ready` を優先
- `P0 > P1 > P2 > P3`
- done / blocked / dependency 未解決 / human gate 未解決は除外
- risk high / critical は human gate 寄せ
- costTier high / approval_required は警告を出す
- 営業 DX / transcriber / Secret / 顧客情報 / DeepSeek 禁止範囲は安全警告を出す

## smoke 項目

- temp Task Vault から tasks を読める
- ready task だけを候補化できる
- done / blocked / dependency 未解決 / human gate を分離できる
- priority 順に並べられる
- 最大 3 件に制限できる
- wishlist 項目を保存/読込できる
- Cockpit snapshot に `taskFeeder` が入る
- Cockpit HTML に `NEXT TASK FEED` / `WISHLIST / LATER IDEAS` がある
- `npm run smoke:v110-84` が PASS
- `npm run verify` が PASS
