# Practical Dev Factory Loop v7.5.0

## Purpose

タスク投入 → Runtime正規化 → provider振分 → 実行パケット生成 → 結果レビュー → 修正ループ → 承認パケット生成まで一周させる。

## Inputs

| Field | Type | Default | Description |
|---|---|---|---|
| projectName | string | (unnamed) | プロジェクト名 |
| repoPath | string | . | リポジトリパス |
| taskGoal | string | (task goal) | タスク目標 |
| productLine | string | backoffice | sales_dx / email_reply / ai_bot / backoffice / anesty_board / cloud_run_launch_pack |
| taskType | string | implementation | implementation / draft / strategy / review / repair / release / bugfix / docs / bulk |
| riskLevel | string | low | low / medium / high / critical |
| dataLevel | string | A | A / B / C |
| preferredProvider | string\|null | null | claude / gemini / grok / deepseek / kimi / kosame / human |
| currentStatus | string | "" | 現在のリポジトリ状態 |
| providerResult | string\|null | null | プロバイダーからの作業結果 (nullの場合はdispatch前) |

## Outputs

| Field | Description |
|---|---|
| version | 7.5.0 |
| dryRun | true (always) |
| humanApprovalRequired | true (always) |
| loopId | ユニークループID |
| runtimePacket | v7.0.0 runtime normalization result |
| providerRoute | selectedProvider, reason, fallbacks |
| executionPacket | allowedFiles, deniedFiles, verifyCommands, doneCriteria, forbiddenActions, reportFormat |
| importedResult | normalizedResult, reviewDecision |
| reviewDecision | status, approved, requiresRepair, requiresHumanApproval |
| repairLoop | repair-loop-controller packet (failureがある場合のみ) |
| finalApprovalPacket | commitGate, pushGate, tagGate, deployGate (全てallowed=false) |
| blockedDangerousActions | 禁止アクション一覧 |
| recommendedNextAction | 次アクション推奨 |
| levelCBlocked | Level C data block フラグ |

## Loop Flow

```
Input
  ↓
1. Runtime normalization (v7.0.0 practical-dev-factory-runtime-pack)
  ↓
2. Provider routing (v7.1.0 provider-prompt-router-real-use-pack)
  ↓
3. Level C safety gate — if dataLevel=C, override to kosame
  ↓
4. Execution packet generation (v7.2.0 task-execution-packet-generator-pack)
  ↓
5. Result import & review (v7.3.0 result-import-review-pack)
  ↓
6. [if failure] Repair loop (v7.4.0 repair-loop-controller-pack)
  ↓
7. Final approval packet generation
  ↓
Output
```

## Provider Routing Rules

| Condition | Provider |
|---|---|
| implementation / bugfix / repair | claude |
| draft / docs / bulk | gemini |
| strategy / breakthrough | grok |
| review / safety / final / critical | kosame |
| Level C data | kosame or human only |
| riskLevel=critical | kosame |
| release | kosame + human approval |

## Final Approval Packet

commitGate / pushGate / tagGate / deployGate はすべてallowed=false。
じゅんやさんの明示的YESがない限り、どのゲートも通過不可。
じゅんやさんは最終YESのみ。作業員に戻さない。

## Usage

```bash
node tools/practical-dev-factory-loop-pack.js
```

env vars:
- KOSAME_PROJECT_NAME
- KOSAME_REPO_PATH
- KOSAME_TASK_GOAL
- KOSAME_PRODUCT_LINE
- KOSAME_TASK_TYPE
- KOSAME_RISK_LEVEL
- KOSAME_DATA_LEVEL
- KOSAME_PREFERRED_PROVIDER
- KOSAME_CURRENT_STATUS
- KOSAME_PROVIDER_RESULT
