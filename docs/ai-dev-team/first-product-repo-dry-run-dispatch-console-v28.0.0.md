# First Product Repo Dry Run Dispatch Console (v28.0.0)

## 目的
実repoへ作業を投げる前のdry-run dispatch packetを生成する。
実Claude実行・実repo編集・実コマンド実行はしない。「何をどう投げるか」のdry-run packetだけ生成する。

## 前提パック
- v25.0.0 Work Order Console
- v25.5.0 External Repo Preflight
- v26.0.0 Handoff & Result Import
- v27.0.0 Connection Bridge

## 出力フィールド
- dryRunDispatchId
- targetProduct
- targetRepoCandidate
- workOrderSummary
- connectionBridgeSummary
- preflightSummary
- executionPromptSummary
- dryRunSteps (10ステップ)
- expectedClaudeActions
- expectedHumanActions
- allowedActions
- blockedActions
- verificationPlan
- rollbackPlan
- dispatchDryRunReady
- notReadyReasons
- humanApprovalRequired
- dangerousActionsDenied
- recommendedNextAction

## dryRunSteps 概要
1. Human: work order確認
2. Human: connection bridge確認 (v27 passed)
3. Human: preflight確認 (v25.5 passed)
4. Claude: execution promptを受領 (dry-run)
5. Claude: 実装計画生成 (ファイル編集はhuman YES後)
6. Human: 実装計画をレビューしてYES/修正指示
7. Claude: 承認済みzoneのみ編集
8. Claude: node --check + verification実行
9. Claude: handoff report生成 (git操作なし)
10. Human: v29 Result Review Consoleでレビュー

## 安全境界
- allowedActions: generate_dry_run_dispatch_packet, describe_expected_* など
- blockedActions: real_repo_edit / real_git_commit / real_git_push / real_git_tag / real_deploy / secret_access / customer_data_access

## 使用方法
```bash
node tools/first-product-repo-dry-run-dispatch-console-pack.js
npm run pm-agent:first-product-repo-dry-run-dispatch-console
npm run smoke:first-product-repo-dry-run-dispatch-console
```

## 次ステップ
dispatchDryRunReady = true の場合、Claude へ execution prompt を渡し、実装計画を受領してからHuman YES で編集開始。
結果はv29 Result Review Console で受け取る。
