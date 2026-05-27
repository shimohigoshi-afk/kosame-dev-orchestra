# KOSAME Dev Orchestra v3.2.0 Release Record
## Kosame State Auto-Reader Pack

**Version:** 3.2.0  
**Release Date:** 2026-05-27  
**Release Manager:** Claude係長  
**Final Approval:** じゅんやさん社長

---

## Summary

v3.2.0 implements the **Kosame State Auto-Reader Pack** — git/Actions/verify状態を構造化入力またはfixtureから読み取り、Combined State Snapshotに統合するtoolセット。v3.3.0 Auto Decision Reportの入力として使う。

---

## New Tools (4)

| Tool | Function | Description |
|------|----------|-------------|
| `tools/repo-state-reader.js` | `readRepoState`, `parseGitStatusSb` | git status -sb テキストまたは構造化入力からrepo状態を読み取り |
| `tools/actions-state-reader.js` | `readActionsState`, `parseGhRunListText` | gh run list テキストまたは構造化入力からActions状態を分類 |
| `tools/verify-state-reader.js` | `readVerifyState`, `parseVerifyLog` | verify logテキストまたは構造化入力からPASS/FAIL/timeout分類 |
| `tools/combined-state-snapshot.js` | `createCombinedStateSnapshot` | 全reader統合 + provider health + approval gate を1 snapshotに |

---

## New Fixtures (3)

- `fixtures/repo-state.sample.json`
- `fixtures/actions-state.sample.json`
- `fixtures/verify-state.sample.json`

---

## New Smoke Tests (5)

- `smoke/dev-agent-repo-state-reader-smoke.js`
- `smoke/dev-agent-actions-state-reader-smoke.js`
- `smoke/dev-agent-verify-state-reader-smoke.js`
- `smoke/dev-agent-combined-state-snapshot-smoke.js`
- `smoke/dev-agent-v3.2.0-release-record-smoke.js`

---

## Key Design Decisions

### No shell execution — caller provides text
全readerはテキストや構造化データを受け取るのみ。`exec` / `spawn` / `gh` CLI呼び出しは一切しない。

### gitStatusSbText > statusLines fallback
`gitStatusSbText` が提供された場合はそれを優先してparse。なければ `statusLines` 配列フォールバック。

### overallHealth thresholds
- `healthy`: 0 issues
- `degraded`: 1–2 issues
- `critical`: 3+ issues

### combined-state-snapshot flattens for decision tools
`branch`, `actionsStatus`, `verifyStatus`, `workingTreeClean`, `isAhead`, `geminiAvailable` をトップレベルに展開してv3.3.0 Decision Reportが直接参照できるようにする。
