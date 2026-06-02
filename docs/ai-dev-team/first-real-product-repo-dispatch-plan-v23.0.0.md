# First Real Product Repo Dispatch Plan v23.0.0

## 目的
実プロダクトrepoへどの順番で作業を流すかを決めるdispatch planを生成する。

## dispatchOrder (7ステップ)
| Step | Action | Provider | Required |
|------|--------|---------|---------|
| 1 | Product Repo Connection Prep (v21.5.0) | Claude/こさめ | ○ |
| 2 | Safety Gate Review (v23.5.0) | こさめ/GPT | ○ |
| 3 | Execution Prompt Export (v24.0.0) | Claude | ○ |
| 4 | Human final YES — じゅんやさん | Human | ○ |
| 5 | Claude executes in product repo | Claude | ○ |
| 6 | Verification & Handoff Collector | Claude/こさめ | ○ |
| 7 | Release Candidate Packet Builder | こさめ/GPT | ○ |

## requiredInputs
- taskGoal / targetProduct / taskTitle / businessContext / allowedFileZones / deniedFileZones

## rollbackPlan の3段階
- fileLevel: git checkout -- <file>
- repoLevel: git reset --hard HEAD (じゅんやさん YES 必須)
- branchLevel: git branch -d feature/<taskId> (じゅんやさん YES 必須)

## 安全ルール
- dryRun: true / humanApprovalRequired: true 固定
- noRealRepoAccess / noRealExecution: true 固定
- dangerousActionsDenied: 14種類
