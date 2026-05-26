# Operator Handoff Final Template v1.3.1

## テンプレート構造

```markdown
# Operator Handoff - {version}

## 状況
- **Status**: {status}
- **Milestone**: {milestone}
- **Timestamp**: {timestamp}

## 完了した作業
- {completed_work_item_1}
- {completed_work_item_2}
...

## 次のアクション
1. {next_action_1}
2. {next_action_2}
...

## 承認ゲート
- 承認者: {approver}
- git commit / push / tag は Human Approval 後のみ実行

---
Generated at: {timestamp}
```

## 記入規則
- `status`: COMPLETE / IN_PROGRESS / BLOCKED
- `milestone`: リリースマイルストーン名
- `approver`: 通常は「じゅんやさん」
- 次のアクションは具体的なコマンドを含める

## 使用タイミング
- セッション終了時
- 担当エージェント交代時
- リリース前の最終確認時
