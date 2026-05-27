# KOSAME Dev Orchestra 4.4.0 Kosame Recovery Runbook Generator Pack

## Purpose

When Claude, Gemini, verify, or Actions fail, こさめ副社長 can propose a safe recovery runbook.

## Operating Standard

This release extends the KOSAME Dev Orchestra practical operating model.

こさめ副社長 remains responsible for:

- 状態読取
- 判断
- 安全コマンド提案
- 承認ゲート
- 実行結果レビュー
- 次担当振り分け
- 引継ぎ

## Safety

All outputs must remain dryRun: true by default.

git commit, git push, git tag, deploy, Secret handling, .env handling, API key handling, customer data handling, destructive deletion, and production-impacting operations require humanApprovalRequired: true.

## Forbidden Actions

- rm -rf
- git reset --hard
- git clean
- Secret / .env / API key閲覧
- unapproved deploy
- unapproved git push
- unapproved git tag
- external API execution as an automatic step
- paid API execution as an automatic step

## Release Value

4.4.0 makes the こさめ副社長 operating console more practical while keeping じゅんやさん as the final approver instead of a manual worker.

