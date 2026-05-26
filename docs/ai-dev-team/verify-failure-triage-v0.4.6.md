# Verify Failure Triage v0.4.6

`npm run verify` 失敗時の仕分け（Triage）ロジック。

---

## 仕分けカテゴリ

| エラー種別 | 判定基準 | 推奨アクション |
|---|---|---|
| **Syntax Error** | `SyntaxError`, `unexpected token` | Claude Code による即時修正 |
| **Test Failure** | `FAIL`, `AssertionError` | 実装ロジックの再確認と Claude による修正 |
| **Missing File** | `ENOENT`, `not found` | ファイルパスの確認または不足ファイルの生成 |
| **Permission Error** | `EACCES`, `permission denied` | 実行権限の確認（人間へのエスカレーション検討） |
| **Timeout** | `timeout`, `timed out` | リソース不足または無限ループの調査 |

---

## Triage プロセス

1. **キーワード検索**: エラーログから上記のキーワードを抽出。
2. **影響範囲特定**: 失敗したのが `smoke/` なのか `src/` なのかを特定。
3. **重要度判定**:
    - `docs/` 関連の smoke 失敗: 低 (L1)
    - `src/` 関連の smoke 失敗: 中 (L2)
    - `verify` 自体のクラッシュ: 高 (L3)

---

## 自動判定後の挙動

- **L1/L2**: `ClaudeFixPacket` を生成し、自動修正フローへ。
- **L3**: 人間（じゅんやさん）に通知し、判断を仰ぐ。

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v0.4.6 | 初版作成。エラーの自動仕分けルールを定義。 |
