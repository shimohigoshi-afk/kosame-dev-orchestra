# First End-to-End Product Repo Operation Prototype (v30.0.0)

## 目的
KOSAME Dev Orchestraが、実プロダクトrepo作業を IntakeからCommit Candidate Decisionまでの流れで管理できるE2E prototype packetを生成する。
実repoを触らずに運用設計を完成させるためのE2E dry-run operation prototypeである。

## E2E フロー

| Stage | 名前 | Actor | Tool |
|-------|------|-------|------|
| 1 | Intake | Human + Kosame/GPT | repo-task-intake-console-pack |
| 2 | Product Repo Task Packet | Claude | first-product-repo-task-packet-pack |
| 3 | Connection Bridge | Claude | first-real-product-repo-connection-bridge-pack |
| 4 | Work Order | Claude | first-product-repo-work-order-console-pack |
| 5 | External Repo Preflight | Claude | external-repo-preflight-command-pack |
| 6 | Execution Prompt Pack | Claude | first-real-product-repo-execution-prompt-pack |
| 7 | Dry Run Dispatch | Claude + Human | first-product-repo-dry-run-dispatch-console-pack |
| 8 | Handoff & Result Import | Claude + Human | first-product-repo-handoff-result-import-pack |
| 9 | Result Review | Kosame/GPT + Claude | first-product-repo-result-review-console-pack |
| 10 | Commit Candidate Decision | Human (じゅんやさん) | commit-candidate-packet-builder-pack |

## providerRoleMap

| Provider | 主な役割 |
|----------|----------|
| Kosame/GPT | PM: intake review, safety gate, integration judge, final review |
| Claude | 実装: task packet / work order / execution prompt / file edit / verification / handoff |
| Gemini | Bulk work intake support, draft expansion, fallback provider |
| Grok | Research / analysis support, secondary review |
| DeepSeek | Code analysis / review support, alternative suggestions |
| Kimi | Document review / summarization, long-context analysis |
| Cloud Shell | CLI execution (gcloud/node/npm), git status (read-only) |
| Human | じゅんやさん: 全 commit/push/tag/deploy の final YES |

## humanApprovalContract
- git add / commit / push / tag → Human YES 必須
- deploy / docker build / gcloud deploy → Human YES 必須
- 全ファイル編集 → Human YES 後のみ

## 安全境界
| 境界 | 内容 |
|------|------|
| noRealRepoEdit | dry-run フェーズではtarget repoを変更しない |
| noRealGitOps | git add/commit/push/tag は明示的 Human YES がないと実行不可 |
| noRealDeploy | このprototypeのどのフェーズでもdeployを実行しない |
| noSecretRead | .env / secrets / credentials はどのステージでも読まない |
| noCustomerData | PII / 保険 / 医療 / 財務データはどのステージでもアクセスしない |

## allowedOperationModes
dry_run_only / dry_run_dispatch / dry_run_review / human_approved_edit / readonly_bridge / packet_generation

## blockedOperationModes
direct_deploy / auto_push / auto_tag / secret_inspection / customer_data_scan / destructive_cleanup

## productRepoOperationPrototypePassed 条件
- isKnownProduct: true
- stageBlockers: []（全stageがdry-run安全条件を満たす）
- commitCandidateDecision.decision ≠ 'blocked'

## 使用方法
```bash
node tools/first-end-to-end-product-repo-operation-prototype-pack.js
npm run pm-agent:first-end-to-end-product-repo-operation-prototype
npm run smoke:first-end-to-end-product-repo-operation-prototype
```

## 次ステップ
productRepoOperationPrototypePassed = true の場合:
- v31.0.0: First Real Repo Edit with Human Gate（承認済みゾーン内の実ファイル1件編集）
- v32.0.0: First Commit Candidate Execution（git add/commit with じゅんやさん YES）
