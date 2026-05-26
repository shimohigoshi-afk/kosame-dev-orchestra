# Operator Error Recovery Flow (v0.6.0)

## エラー発生時のリカバリ手順

### 1. npm run verify 失敗
- **原因判定**: 文法エラーか、ロジックエラーか、テストの不備か。
- **対応**: Claude Repair Intake を作成し、Claude Code に修正を丸投げする。
- **完了条件**: 再度の `npm run verify` で PASS すること。

### 2. GitHub Actions 失敗
- **原因判定**: 環境依存、シークレット不足、または flaky test。
- **対応**: ログを Gemini に要約させ、必要な修正（Secret 設定等）を行う。

### 3. Deploy 失敗
- **原因判定**: クォータ不足、IAM 権限、または runtime error。
- **対応**: `gcloud logging` を確認。必要であれば前バージョンへロールバック (`gcloud run services update --image=...`)。
