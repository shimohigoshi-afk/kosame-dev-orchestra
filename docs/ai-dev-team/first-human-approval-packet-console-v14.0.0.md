# First Human Approval Packet Console v14.0.0

## Purpose
v13.5.0 の review packet をもとに、じゅんやさんが YES/NO だけで判断できる
human approval packet を生成する。YES 地獄防止のため判断項目を最小化する。

## Integration
v14.0.0 → v13.5.0 (`buildReviewConsole`) → [input fields]

## Input
| Field | Type | Description |
|-------|------|-------------|
| reviewPacket | object | v13.5.0 buildReviewConsole の返却値 (省略可) |
| taskGoal | string | タスク目標 |
| targetFiles | string[] | 対象ファイル |
| allowedFiles | string[] | 編集許可ファイル |
| deniedFiles | string[] | 編集禁止ファイル |
| claudePrompt | string | Claude Code への実装プロンプト |
| verificationPlan | object | 検証計画 |
| rollbackNote | string | ロールバック手順 |
| approvalMode | string | approval モード (dry-run) |
| riskLevel | string | リスクレベル |
| dataLevel | string | データレベル |

## Output
| Field | Type | Description |
|-------|------|-------------|
| humanApprovalConsoleId | string | approval コンソールID |
| approvalSummary | object | 承認サマリー |
| yesNoDecisionPacket | object | YES/NO 判断パケット |
| executionReadiness | object | 実行準備状態 |
| approvalChecklist | object | 11 項目チェックリスト |
| dangerousActionGates | string[] | ブロック対象アクション |
| safeToProceedReasons | string[] | 進行可能な理由 |
| stopReasons | string[] | 停止理由 |
| rollbackNote | string | ロールバック手順 |
| finalDecisionOptions | string[] | 最終判断オプション |
| recommendedNextAction | string | 推奨次アクション |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| approvalPacketPassed | boolean | approval packet 成功フラグ |

## yesNoDecisionPacket
| Field | 説明 | 固定値 |
|-------|------|--------|
| approveToSendClaudePrompt | Claude Prompt 送信承認 | riskLevel low かつ prompt 存在時 true |
| approveToAllowFileEditCandidate | ファイル編集候補承認 | allowedFiles に含まれる場合 true |
| approveToRunVerifyAfterEdit | 編集後 verify 実行承認 | verificationPlan 存在時 true |
| approveToCommitAfterHumanReview | commit 承認 | **常に false** |
| approveToPushAfterHumanReview | push 承認 | **常に false** |
| approveToTagAfterHumanReview | tag 承認 | **常に false** |
| approveToDeploy | deploy 承認 | **常に false** |
| approveToReadSecrets | Secret 読み取り承認 | **常に false** |
| approveToUseRealApi | 実 API 呼び出し承認 | **常に false** |

## approvalChecklist (11 items)
1. task goal is low risk
2. target files are allowed
3. denied files are protected
4. no Secret / .env / API key
5. no customer data
6. no real API execution
7. no deploy
8. rollback note present
9. verification plan present
10. Claude prompt present
11. final YES only preserved

## Usage
```bash
npm run pm-agent:first-human-approval-packet-console
npm run smoke:first-human-approval-packet-console-pack
```
