# Verify Result Record (v0.8.1)

## 概要
Verify Result Record は、`npm run verify` の実行結果を構造化データとして記録し、エージェントや人間が解析しやすくするためのフォーマットである。

## 記録項目
- `status`: `pass` または `fail`。
- `failedSmokeTests`: 失敗したスモークテストのリスト。
- `errorSummary`: エラー内容の要約。
- `nextRepairOwner`: 補修を依頼すべきエージェント (`Claude`, `Gemini`, `None`)。
- `commitAllowed`: コミットが許可される状態か (`true`, `false`)。

## 目的
- 検証結果を「単なるテキストログ」から「判断可能なデータ」に変える。
- Claude Code が補修に入る際のインテークとして機能させる。
