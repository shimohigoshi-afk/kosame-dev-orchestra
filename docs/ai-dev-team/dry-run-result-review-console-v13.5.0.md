# Dry Run Result Review Console v13.5.0

## Purpose
v13.0.0 First End-to-End Dry Run Console の結果を読み込み、
じゅんやさんが「何が生成されたか」「何を実行予定か」「どこが危険か」「次に承認すべきか」を
一目で判断できる review packet に圧縮する。

## Input
| Field | Type | Description |
|-------|------|-------------|
| dryRunConsolePacket | object | v13.0.0 buildEndToEndConsole の返却値 (省略可) |
| projectName | string | プロジェクト名 |
| taskGoal | string | タスク目標 |
| targetFiles | string[] | 対象ファイル |
| allowedFiles | string[] | 編集許可ファイル |
| deniedFiles | string[] | 編集禁止ファイル |
| providerPromptPackets | object | プロバイダープロンプト (省略可、dryRunPacketから取得可) |
| verificationPlan | object | 検証計画 (省略可) |
| finalApprovalPacket | object | 承認パケット (省略可) |
| riskLevel | string | リスクレベル |
| dataLevel | string | データレベル |
| reviewMode | string | review モード (dry-run) |

## Output
| Field | Type | Description |
|-------|------|-------------|
| reviewConsoleId | string | review コンソールID |
| inputSummary | object | 入力サマリー |
| generatedPacketSummary | object | v13.0.0 output の各 packet 有無 |
| providerRoleSummary | object | 5プロバイダーの役割と権限要約 |
| fileTouchSummary | object | targetFiles の危険性チェック |
| safetyReview | object | 安全審査結果 |
| approvalReadiness | object | human review 準備状態 |
| unresolvedItems | string[] | 未解決の問題 |
| reviewerDecisionOptions | string[] | 判断オプション (approve/revise/reject/hold) |
| blockedDangerousActions | string[] | ブロックされた危険アクション |
| recommendedNextAction | string | 推奨次アクション |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| noRealApiExecution | boolean | 常に true |
| noRealFileEdit | boolean | 常に true |
| reviewPassed | boolean | review 成功フラグ |

## reviewPassed 条件
- safetyReview.safetyPassed === true (riskLevel low / dataLevel not C / no dangerous files)
- unresolvedItems.length === 0

## Safety Rules
- .env / Secret / API key / customer data は危険扱い
- Gemini/Grok は repo 編集不可 (canEditRepo: false)
- Claude は実装候補のみ
- Human/じゅんやさんは final YES only
- dryRun: true / humanApprovalRequired: true 常時

## Usage
```bash
npm run pm-agent:dry-run-result-review-console
npm run smoke:dry-run-result-review-console-pack
```
