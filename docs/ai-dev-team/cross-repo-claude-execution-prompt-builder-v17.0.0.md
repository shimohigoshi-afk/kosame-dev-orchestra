# Cross-Repo Claude Execution Prompt Builder v17.0.0

## 目的
intake packetからClaude Codeへ渡す実装promptを生成する。
実際の外部repo編集はしない。

## 入力フィールド
| フィールド | 必須 | 説明 |
|-----------|------|------|
| targetRepo | - | 対象repoパス |
| productType | - | 商品タイプ |
| taskGoal | ○ | タスクの目的 |
| implementationScope | - | 実装スコープ |
| verifyCommands | - | 検証コマンド |
| doneCriteria | - | 完了判定条件 |
| rollbackPolicy | - | ロールバックポリシー |
| intakePacket | - | v16.5.0 intake packetを直接渡す場合 |

## 出力の主要フィールド
- `claudePrompt`: Claude Codeへ渡す構造化promptテキスト
- `forbiddenActions`: 禁止アクション一覧
- `reportFormat`: 結果回収用フォーマット

## claudePromptの構成
1. Target Repo
2. Task Goal
3. Implementation Scope
4. Allowed Files
5. Denied Files
6. Forbidden Actions
7. Verify Commands
8. Done Criteria
9. Rollback Policy
10. Safety Rules

## 安全ルール
- noRealRepoEdit / noRealExecution: true 固定
- forbiddenActionsにgit add/commit/push/tag/deploy/docker build等を明示
