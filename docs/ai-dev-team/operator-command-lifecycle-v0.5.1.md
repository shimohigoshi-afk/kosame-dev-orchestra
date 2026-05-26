# Operator Command Lifecycle (v0.5.1)

## ステート遷移
1. **draft**: パケット作成中
2. **queued**: 実行待ち（Dispatch Queue へ）
3. **assigned**: 実行エージェント決定
4. **running**: 実行中
5. **needs_review**: 実行完了、PM または人間による確認待ち
6. **completed**: 承認され、完了
7. **failed**: エラー発生、または否認

## ライフサイクル管理
- 各ステート移行時にログを記録する。
- `needs_review` 状態では、実行結果の diff またはログを添付する。
- 承認が得られるまで、次の `git push` や `deploy` は行わない。
