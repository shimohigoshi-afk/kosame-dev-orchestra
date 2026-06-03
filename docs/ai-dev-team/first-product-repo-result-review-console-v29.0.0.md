# First Product Repo Result Review Console (v29.0.0)

## 目的
実プロダクトrepo作業後のClaude報告を受け取り、KOSAME Dev Orchestra側で結果レビュー・採用/保留/差し戻し判断を行う。
Secret・顧客情報が含まれる想定の場合は reviewDecision を hold または reject にする。
forbiddenFiles・dangerousOperationが検出された場合は commitCandidateReady = false。

## 出力フィールド
- resultReviewId
- targetProduct
- targetRepoCandidate
- claudeReportInputSummary
- changedFilesReview
- verificationReview
- safetyReview
- businessIntentReview
- allowedFilesCheck
- forbiddenFilesCheck
- secretLeakCheck
- customerDataLeakCheck
- dangerousOperationCheck
- acceptedItems
- rejectedItems
- blockerItems
- reviewDecision (approve / revise / reject / hold)
- decisionOptions
- commitCandidateReady
- needsHumanApproval
- recommendedNextAction

## 検出パターン

### secretPatterns
api key / api_key / secret / .env / password / token / credential / private key / access key / bearer

### customerDataPatterns
insurance / health record / patient / policyholder / employee salary / financial record / personal info / pii / 個人情報 / 保険証券 / 健診 / 診察

### forbiddenFilePatterns
.env / .env.production / .env.local / secrets/ / credentials/ / private/ / .ssh/ / config/secrets / config/credentials

## reviewDecision ロジック
| 状態 | decision |
|------|----------|
| secretLeak / customerDataLeak | hold |
| forbiddenFile / dangerousOp | reject |
| verificationFailed / outOfZone | revise |
| 全チェック通過 | approve |

## 安全境界
- commitCandidateReady = true のためには全6チェック通過が必要
- needsHumanApproval は常に true
- 実commit / push / tag / deploy は行わない

## 使用方法
```bash
node tools/first-product-repo-result-review-console-pack.js
npm run pm-agent:first-product-repo-result-review-console
npm run smoke:first-product-repo-result-review-console
```

## 次ステップ
reviewDecision = approve かつ commitCandidateReady = true の場合、v30 E2E Prototype の commitCandidateDecision へ進む。
その後 こさめ/GPT PM レビュー → じゅんやさん YES → git add / commit / push / tag。
