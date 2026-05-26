# Verify Output Classification (v0.6.3)

## 出力分類定義

| クラス | 識別キーワード | 意味 |
|---|---|---|
| `PASS` | `PASSED` / `0 failed` | すべてのテストが成功 |
| `SYNTAX_ERROR` | `SyntaxError` / `Unexpected token` | JS の文法間違い |
| `LOGIC_FAIL` | `AssertionError` / `should be` | 期待値と実際の値が不一致 |
| `MISSING_FILE` | `ENOENT` / `Missing doc` | 指定したファイルが存在しない |
| `MISSING_SCRIPT` | `missing script:` | package.json にスクリプトがない |
| `TIMEOUT` | `ETIMEDOUT` / `timed out` | API 応答や処理のタイムアウト |

## 解析ロジック
正規表現を用いてキーワードを走査し、最も重大度の高いクラスを判定する。
判定結果は Decision Log の `evidence` フィールドに格納される。
