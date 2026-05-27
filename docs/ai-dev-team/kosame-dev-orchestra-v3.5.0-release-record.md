# KOSAME Dev Orchestra v3.5.0 Release Record

## バージョン
v3.5.0 — Kosame VP Operation Loop Pack

## リリース日
2026-05-27

## 目的
こさめ副社長がCloud Shell上で1コマンド実行し、State Read → Decision → Command Proposal → Human Approval Gate → Execution Review → Next Dispatch → Handoffまでのフルループを回せる状態を実現する。

---

## 実装ファイル

### ツール (tools/)
| ファイル | 説明 |
|---|---|
| `tools/vp-next-action-controller.js` | 現在のスナップショットから次に取るべき最優先アクションを1つ決定する |
| `tools/vp-human-approval-gate.js` | Decision Reportからじゅんやさんの最終YES承認が必要な操作を抽出する |
| `tools/vp-execution-review-packet.js` | コマンド実行結果をレビューしてVERDICT (release_candidate / success / claude_repair / failure等) を判定する |
| `tools/vp-handoff-packet.js` | 次セッション・次オペレーター向けの引継ぎパケットを生成するMarkdownノート付き |
| `tools/kosame-vp-operation-loop.js` | 7フェーズVP Operation Loop統合エンジン。skipPhasesで個別フェーズをスキップ可能 |

### スモーク (smoke/)
| ファイル | アサーション数 |
|---|---|
| `smoke/dev-agent-vp-next-action-controller-smoke.js` | 16 |
| `smoke/dev-agent-vp-execution-review-packet-smoke.js` | 14 |
| `smoke/dev-agent-vp-handoff-packet-smoke.js` | 38 |
| `smoke/dev-agent-kosame-vp-operation-loop-smoke.js` | 16 |
| `smoke/dev-agent-v3.5.0-release-record-smoke.js` | リリース確認 |

---

## VP Operation Loop フェーズ構造

```
Phase 1: state_read          — createCombinedStateSnapshot
Phase 2: decision_report     — generateAutoDecisionReport
Phase 3: safe_command_proposal — generateSafeCommands
Phase 4: human_approval_gate — extractApprovalItems
Phase 5: execution_review    — (実行結果が提供された場合)
Phase 6: next_dispatch       — determineVpNextAction
Phase 7: handoff             — generateVpHandoffPacket
```

`skipPhases: ['phase_name']` で特定フェーズをスキップできる。

---

## VERDICT 体系 (vp-execution-review-packet)

| Verdict | 意味 |
|---|---|
| `release_candidate` | verify PASS + Actions success → リリース候補 |
| `success` | 成功。次ステップはverify実行 |
| `claude_repair` | FAIL検出 → Claude係長が修正担当 |
| `gemini_expand` | quota/Gemini障害 → Gemini課長にエスカレーション |
| `failure` | 汎用失敗 |
| `needs_review` | 手動確認が必要 |

---

## 安全設計

- すべてのツールに `dryRun: true` フラグ
- じゅんやさんの承認が必要な操作 (git push / git tag / deploy 等) はすべて `humanApprovalRequired: true` で明示
- vp-human-approval-gate でフィルタリングされた操作のみじゅんやさんに提示
- deny-command-guard による禁止コマンドガード (v3.4.0より継承)

---

## package.json
- `version`: `3.5.0`
- 新規スクリプト: `smoke:vp-next-action-controller`, `smoke:vp-execution-review-packet`, `smoke:vp-handoff-packet`, `smoke:kosame-vp-operation-loop`, `smoke:v3.5.0-release-record`
- pm-agentスクリプト: `pm-agent:vp-next-action`, `pm-agent:vp-approval-gate`, `pm-agent:vp-execution-review`, `pm-agent:vp-handoff`, `pm-agent:vp-operation-loop`
- verifyチェーン: v3.2.0〜v3.5.0の全スモークを追加

---

## 引継ぎ判断

| 条件 | 状態 |
|---|---|
| `readyForHandoff` | `openIssues.length === 0 && verifyStatus !== 'failed'` |
| `hasPendingApprovals` | push/release の承認待ちがある |
| `geminiStatus` | gemini_auth_error の場合はClaude係長へルーティング |
