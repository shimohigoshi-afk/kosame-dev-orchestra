# First Product Repo Claude Prompt Exporter v22.0.0

## 目的
v21.0 / v21.5 のpacketをもとに、Claude Codeへ実プロダクトrepo作業を投げるための安全promptを生成する。
まだ実repoには投げない。prompt exportのみ。

## 入力フィールド
| フィールド | 説明 |
|-----------|------|
| targetProduct | 対象商品タイプ |
| targetRepo | 対象repoパス |
| taskScope | タスクのスコープ |
| filesAllowedToTouch | 触れるファイル一覧 |
| filesForbiddenToTouch | 触れないファイル一覧 |
| implementationSteps | 実装ステップ |
| verificationCommands | 検証コマンド |
| dataBoundary | データ境界 |
| secretBoundary | シークレット境界 |
| rollbackInstruction | ロールバック手順 |
| taskPacket | v21.0.0 taskPacketを直接渡す場合 |
| connectionPrep | v21.5.0 connectionPrepを直接渡す場合 |

## exportedPrompt の構成
1. Role (商品別Claude実装担当ロール)
2. Target Repo / Target Product
3. Task Scope
4. Files Allowed to Touch
5. Files Forbidden to Touch
6. Implementation Steps
7. Verification Commands
8. Data Boundary / Secret Boundary
9. **Forbidden Actions** (15種類)
10. Rollback Instruction
11. Report Format
12. **Critical Safety Rules** (必須)

## Critical Safety Rules (exportedPrompt内に必ず記載)
- git add / commit / push / tag は自動実行しない
- じゅんやさん explicit YES なしに実行しない
- .env / secrets / API key は読まない
- deploy / docker build / gcloud deploy は実行しない
- humanApprovalRequired: true

## promptReady 判定
- isKnownProduct: true
- taskScope.length > 0
- filesAllowedToTouch.length > 0

## 安全ルール
- noRealRepoEdit / noRealExecution: true 固定
- promptReady = false の場合、exportedPrompt に "# BLOCKED" を表示
