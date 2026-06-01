# Claude Execution Prompt Exporter v12.5.0

## Purpose
v12.0.0 docs task packet から、Claude Code に貼れる実装用プロンプトを生成する。
生成するのはプロンプト文字列のみ。Claude を自動実行しない。実ファイル編集もしない。

## Input
| Field | Type | Description |
|-------|------|-------------|
| docsTaskPacket | object | v12.0.0 buildDocsTaskPacket の返却値 |
| repoStatus | string | リポジトリ状態 |
| implementationMode | string | 実装モード (dry-run) |
| allowedFiles | string[] | 編集許可ファイル |
| deniedFiles | string[] | 編集禁止ファイル |
| verifyCommands | string[] | 検証コマンド |
| doneCriteria | string[] | 完了条件 |
| forbiddenActions | string[] | 禁止アクション |

## Output
| Field | Type | Description |
|-------|------|-------------|
| exporterId | string | エクスポーターID |
| claudePrompt | string | Claude Code に貼るプロンプト |
| allowedFiles | string[] | 編集許可ファイル |
| deniedFiles | string[] | 編集禁止ファイル |
| verifyCommands | string[] | 検証コマンド |
| doneCriteria | string[] | 完了条件 |
| forbiddenActions | string[] | 禁止アクション |
| approvalGates | object | 承認ゲート |
| safetyNotes | string[] | 安全メモ |
| dryRun | boolean | 常に true |
| humanApprovalRequired | boolean | 常に true |
| exportPassed | boolean | エクスポート成功フラグ |
| recommendedNextAction | string | 推奨次アクション |

## claudePrompt 構造
```
# Claude Implementation Prompt
## Task
## allowedFiles
## deniedFiles
## Implementation Scope
## verifyCommands
## doneCriteria
## forbiddenActions
## Report Format
## Safety Rules
```

## Safety Rules
- Claude を自動実行しない
- dryRun: true / humanApprovalRequired: true 常時
- git add / commit / push / tag はしない
- Secret / .env / API key は読まない
- 実 API 呼び出し禁止

## Usage
```bash
npm run pm-agent:claude-execution-prompt-exporter
npm run smoke:claude-execution-prompt-exporter-pack
```
