# Operator Handoff Format (v0.7.4)

## Markdown フォーマット
```markdown
# Operator Handoff - [VERSION]

## 状況
- **Status**: [STATUS]
- **Risk**: [RISK]
- **Active Agent**: [AGENT]

## 完了した作業
- [DONE_LIST]

## 残りの作業
- [TODO_LIST]

## 次のアクション
1. `[NEXT_COMMAND]`

## 注意事項 (Do Not Touch)
- [WARNINGS]

## 承認ゲート
- [APPROVAL_ITEMS]
```

## 生成ルール
- `fixtures/operator-state.json` の内容をベースに埋め込む。
- `TODO_LIST` は `nextAction` から派生させる。
- `WARNINGS` は `riskLevel` が `High` の場合に強調表示する。
