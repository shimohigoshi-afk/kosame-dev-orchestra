# KOSAME Dev Orchestra v3.3.0 Release Record
## Kosame Auto Decision Report Pack

**Version:** 3.3.0  
**Release Date:** 2026-05-27  
**Release Manager:** Claude係長  
**Final Approval:** じゅんやさん社長

---

## Summary

v3.3.0 implements the **Kosame Auto Decision Report Pack** — Combined State Snapshot (v3.2.0)を入力にして、commit / push / release / dispatchの判断をYES/NO/HOLDで自動生成するtoolセット。

---

## New Tools (5)

| Tool | Function | Description |
|------|----------|-------------|
| `tools/auto-decision-report-generator.js` | `generateAutoDecisionReport` | 全4レポートを統合、primaryAction/priority決定 |
| `tools/commit-decision-report.js` | `generateCommitDecisionReport` | commit YES/NO/HOLD判断 |
| `tools/push-decision-report.js` | `generatePushDecisionReport` | push YES/NO/HOLD (gate_required: always true) |
| `tools/release-decision-report.js` | `generateReleaseDecisionReport` | tag/release YES/NO/HOLD (ActionsSuccess必須) |
| `tools/dispatch-decision-report.js` | `generateDispatchDecisionReport` | Claude/Gemini/Cloud Shell/Human分岐 |

---

## New Smoke Tests (6)

- `smoke/dev-agent-commit-decision-report-smoke.js`
- `smoke/dev-agent-push-decision-report-smoke.js`
- `smoke/dev-agent-release-decision-report-smoke.js`
- `smoke/dev-agent-auto-decision-report-generator-smoke.js`
- `smoke/dev-agent-dispatch-decision-report-smoke.js` (dispatch)
- `smoke/dev-agent-v3.3.0-release-record-smoke.js`

---

## Key Design Decisions

### Release YES の条件は Actions success のみ
`release-decision-report` は `actionsStatus === 'success'` の場合のみ `YES` を返す。`pending` → HOLD、それ以外 → NO。

### push / release は gate_required: true 固定
どの状態でも `gate_required: true`, `humanApprovalRequired: true`。こさめ副社長は自律実行しない。

### primaryAction の優先順位
1. verify失敗/timeout → fix_verify (high)
2. Actions失敗 → triage_actions (high)
3. 変更+verify未実施 → run_verify (normal)
4. commit候補 → commit (normal)
5. push候補 → push_with_junya_approval (normal)
6. release候補 → release_with_junya_approval (low)
7. Actions pending → wait_for_actions (low)
