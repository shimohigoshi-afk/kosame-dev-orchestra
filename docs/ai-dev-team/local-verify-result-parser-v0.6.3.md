# Local Verify Result Parser (v0.6.3)

## 概要
Local Verify Result Parser は、Cloud Shell 等のローカル環境で実行した `npm run verify` の標準出力を解析し、成功・失敗の理由を構造化データとして抽出するツールである。

## 解析対象
- `stdout` / `stderr` の全体テキスト
- 終了コード (Exit Code)
- 各 smoke test の個別の成功・失敗

## 運用
1. エージェント（または人間）が `npm run verify` を実行。
2. 出力をこのパーサーに投入。
3. 抽出されたエラー箇所を基に Claude Repair Ticket を自動生成。
