# Operator Command Risk Classification (v0.5.1)

## リスクレベル定義

| レベル | 名称 | 定義 | 承認ゲート |
|---|---|---|---|
| L1 | Low | ファイル作成・編集（非破壊） | こさめ PM |
| L2 | Medium | 既存ファイルの大規模改修・リファクタ | こさめ PM + 自動検証 |
| L3 | High | git commit / git tag / 外部API実接続 | じゅんやさん (Human Approval) |
| L4 | Critical | git push / deploy / Secret 変更 / データ削除 | じゅんやさん (社長) |

## リスク判定基準
- `rm -rf` や `git reset --hard` を含む場合は自動的に L4 とする。
- 課金が発生する API 実行は L3 以上とする。
- 新規ドキュメント作成は L1 とする。
