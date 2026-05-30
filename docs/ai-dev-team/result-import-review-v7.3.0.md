# Result Import & Review Pack v7.3.0

## Purpose

Claude/Gemini/Grok等の作業結果を取り込み、こさめ副社長がレビューできる形に正規化する。
成功/失敗/未完了/要修正/承認待ちを判定し、次アクションを出す。

## Inputs

| Field | Type | Default | Description |
|---|---|---|---|
| providerResult | string\|object | (no result provided) | プロバイダーからの作業結果 |
| provider | string | unknown | claude / gemini / grok / deepseek / kimi / kosame / human |
| taskGoal | string | (task goal) | タスク目標 |
| taskType | string | implementation | taskType |
| productLine | string | backoffice | productLine |

## Outputs

| Field | Description |
|---|---|
| version | 7.3.0 |
| dryRun | true (always) |
| humanApprovalRequired | true (always) |
| importId | ユニークインポートID |
| normalizedResult | provider, taskGoal, rawResult, importedAt |
| reviewDecision | status, issueCount, issues, approved, requiresRepair, requiresHumanApproval |
| recommendedNextAction | 次アクション推奨 |
| blockedDangerousActions | 禁止アクション一覧 |

## Review Decision Status Values

| status | Meaning |
|---|---|
| success | 完了。kosameレビューへ |
| failure | 失敗。repair-loop-controllerへ |
| incomplete | 未完了。再dispatching |
| needs_repair | 修正必要。claudeへ |
| pending_approval | 承認待ち。humanへ |

## Issue Types

| type | Description | Next Action |
|---|---|---|
| syntax_error | SyntaxError detected | → claude repair |
| verify_failure | AssertionError / smoke fail | → claude repair |
| missing_file | Module not found | → claude repair |
| type_error | TypeError | → claude repair |
| reference_error | ReferenceError | → claude repair |
| npm_error | npm ERR detected | → claude diagnose |
| incomplete | TODO/FIXME markers | → re-dispatch with clearer criteria |
| unknown_failure | 不明な失敗 | → kosame triage |

## Next Action Routing

- success + no issues → kosame final review
- pending_approval → human approval
- syntax_error / verify_failure / missing_file → claude repair
- incomplete → re-dispatch to same provider
- unknown_failure → kosame triage
- failure (general) → repair-loop-controller

## ANESTY Board Special Rule

productLine=anesty_boardの場合、常にrequiresHumanApproval=trueが設定される。
