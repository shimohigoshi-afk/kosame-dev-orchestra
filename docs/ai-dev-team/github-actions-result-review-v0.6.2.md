# GitHub Actions Result Review (v0.6.2)

## 概要
GitHub Actions Result Review は、CI/CD パイプライン（`gh run list`）の結果を機械的かつ構造的にレビューするための指針である。Actions の成功・失敗を単なる点滅としてではなく、次アクションのトリガーとして扱う。

## レビュー項目
- **Workflow Name**: `KOSAME Dev Orchestra Verify` または `PM Agent Launch Readiness`
- **Status**: `success` / `failure` / `cancelled`
- **Failure Point**: どのステップで落ちたか（例: `npm run verify`, `docker build`）
- **Log Summary**: エラーメッセージの主要な抜粋

## 運用
1. `git push` 後、Actions の完了を待つ。
2. `gh run list --limit 1` で最新の結果を取得。
3. 失敗した場合は `actions-failure-triage` へ移行。
