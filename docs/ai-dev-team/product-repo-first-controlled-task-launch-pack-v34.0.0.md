# Product Repo First Controlled Task Launch Pack (v34.0.0)

## 目的
初回商品repo作業をClaude Codeへ渡すための controlled launch packetを生成する。
実repoへは投げない。claudePromptToLaunch の生成と安全境界の明確化のみ。

## claudePromptToLaunch の構成
1. Target Repo / Task Title / Task Goal
2. Allowed File Zones
3. Forbidden File Zones
4. Allowed Commands (node --check / npm run verify / git status read-only)
5. FORBIDDEN Commands (git add/commit/push/tag / deploy / docker build / cat .env)
6. Safety Rules (6条)
7. Handoff Report Format (必須フィールド)

## preLaunchChecklist (必須7項目)
1. v32 Product Repo Selection decided
2. v33 First Touch Dry Run completed
3. v27 Connection Bridge ready
4. v25 Work Order confirmed
5. Task scope and allowed file zones confirmed by human
6. No secrets / customer data in task scope
7. Human issued YES for this launch

## commitStopRule
1. git add / commit / push / tag を実行しない
2. file edit + node --check + npm run verify で停止
3. handoffレポートを生成する (changedFiles / verificationResult / gitStatusOutput)
4. v29 Result Review Console でのレビューを待つ
5. commit/push/tag は明示的な じゅんやさん YES が必要

## postLaunchReportFormat
### requiredFields
changedFiles / nodeCheckResult / verificationResult / gitStatusOutput / sensitiveContentFound (false必須) / dangerousOpsPerformed (空配列必須) / readyForResultReview

### forbiddenFields
secretValues / envValues / customerPII / insuranceData / commitHash / pushConfirmation

## 使用方法
```bash
node tools/product-repo-first-controlled-task-launch-pack.js
npm run pm-agent:product-repo-first-controlled-task-launch-pack
npm run smoke:product-repo-first-controlled-task-launch-pack
```

## 次ステップ
launchReady = true の場合、claudePromptToLaunch を Claude Code セッションに貼り付ける。
実装計画が返ってきたら Human がレビューしてYES。編集後、handoff reportを v29 Result Review Console へ渡す。
