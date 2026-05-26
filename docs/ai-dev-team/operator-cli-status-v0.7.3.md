# Operator CLI Status (v0.7.3)

## 概要
Operator CLI Status は、ターミナル上で現在のプロジェクト状態を素早く確認するためのコマンドラインツールおよびその仕様である。

## 表示項目
- `[STATUS]`: 現在のワークフロー状況。
- `[NEXT]`: 次に推奨されるアクション。
- `[AGENT]`: 現在稼働中のエージェント。
- `[APPROVAL]`: 承認待ちの件数。
- `[RISK]`: 現在のリスクレベル。

## 目的
- `node tools/operator-cli-status.js` を実行するだけで、状況を把握できるようにする。
- 外部APIや複雑なシェル実行に依存せず、`fixtures/operator-state.json` を読み取る。
