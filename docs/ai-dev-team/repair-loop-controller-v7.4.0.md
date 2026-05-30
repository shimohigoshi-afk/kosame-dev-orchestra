# Repair Loop Controller v7.4.0

## Purpose

失敗時に、Claude修正 / Gemini整理 / Grok突破案 / こさめ裁定 / Human Approvalへ回す修正ループを生成する。
verify failure / syntax error / missing file / provider unavailable / safety block / human approval requiredを扱う。

## Inputs

| Field | Type | Default | Description |
|---|---|---|---|
| failureType | string | unknown_failure | 失敗タイプ |
| errorOutput | string | (no error output) | エラー出力 |
| taskGoal | string | (task goal) | タスク目標 |
| taskType | string | implementation | taskType |
| productLine | string | backoffice | productLine |
| provider | string | claude | 元のprovider |
| attempt | number | 1 | 試行回数 |

## Outputs

| Field | Description |
|---|---|
| version | 7.4.0 |
| dryRun | true (always) |
| humanApprovalRequired | true (always) |
| repairId | ユニーク修正ID |
| failureType | 失敗タイプ |
| repairRoute | repairProvider, fallbackProvider, escalationProvider, reason |
| repairPrompt | プロバイダー別修正指示文 |
| repairSteps | 7ステップの修正ループ |
| escalationRequired | 最大試行超過またはhuman判断必要の場合true |
| recommendedNextAction | 次アクション推奨 |
| blockedDangerousActions | 禁止アクション一覧 |

## Failure Types

```
verify_failure    — npm run verify / smoke test failed
syntax_error      — SyntaxError in code
missing_file      — File or module not found
type_error        — TypeError
reference_error   — ReferenceError
npm_error         — npm ERR detected
unclear_spec      — Requirements unclear
spec_issue        — Conflicting or wrong specification
provider_unavailable — Provider is down or rate-limited
safety_block      — Safety policy violated
human_approval_required — Requires human decision
incomplete        — Task not fully completed
unknown_failure   — Unknown failure type
```

## Max Retries

| productLine | maxRetries |
|---|---|
| anesty_board | 1 (immediate escalation) |
| others | 3 |

## Repair Steps

1. Capture full error output (cloudShell, auto)
2. Dispatch repair prompt to {repairProvider}
3. Apply fix to codebase
4. Run node --check on changed files (cloudShell, auto)
5. Run npm run verify (cloudShell, auto)
6. Evaluate result (attempt N/maxRetries)
7. Loop back or escalate to kosame

## Provider Fallback Chains

```
claude   → grok → deepseek → kosame
gemini   → grok → kimi → kosame
grok     → claude → deepseek → kosame
deepseek → claude → grok → kosame
kimi     → gemini → grok → kosame
kosame   → human
```
