# First Real Product Repo Launch Handoff (v37.0.0)

## 目的
初回実プロダクトrepo作業をClaude Codeへ渡すための最終 launch handoff packet を生成する。
実repoへは投げない。implementationPrompt の生成と安全ルール定義のみ。

## implementationPrompt の構成
1. Target Repo / Objective
2. Claude の役割
3. Allowed Files / Forbidden Files
4. Allowed Commands / ABSOLUTELY FORBIDDEN Commands
5. Safety Rules (7条)
6. Handoff Report Format

## stopConditions (5条)
1. sensitive content (Secret/.env/API key/顧客情報/保険証券) 発見 → 即STOP
2. forbidden file zone タッチ → 即STOP
3. dangerous operation 試行 (git push/deploy/rm -rf) → 即STOP
4. verification fails → STOP、commit しない
5. node --check fails → STOP、report

## commitCandidateStopRule (5ルール)
1. git add/commit/push/tag を実行しない
2. file edit + node --check + npm run verify で停止
3. handoff report 生成 (changedFiles/nodeCheck/verification/gitStatus)
4. v38 Acceptance Gate でのレビューを待つ
5. git ops は じゅんやさん YES が必要

## 役割分担
| 役割 | 担当 |
|------|------|
| 実装 | Claude — 許可ゾーン内ファイル編集 + verify + handoff report |
| PM gate | Kosame/GPT — 各ステージ承認 |
| 最終YES | じゅんやさん — git/deploy 全操作の最終承認 |

## 使用方法
```bash
node tools/first-real-product-repo-launch-handoff-pack.js
npm run pm-agent:first-real-product-repo-launch-handoff
npm run smoke:first-real-product-repo-launch-handoff
```

## 次ステップ
launchHandoffReady = true → implementationPrompt を Claude Code に貼り付ける。
Claude から handoff report が返ってきたら v38 Result Acceptance Gate で受け入れ判定。
