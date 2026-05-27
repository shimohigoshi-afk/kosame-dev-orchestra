# KOSAME Dev Orchestra v3.8.0 Release Record

## バージョン
v3.8.0 — Kosame Approval Board Practical Console Pack

## リリース日
2026-05-27

## 目的
commit / push / tag / release / dispatch / handoff の承認状態を1つのBoardにまとめ、じゅんやさんへのYES依頼を最小化する「Human YES Compression」を実現する。

---

## 実装ファイル

### ツール (tools/)
| ファイル | 説明 |
|---|---|
| `tools/kosame-approval-board.js` | 6操作の承認状態Board生成 + Human YES Compression |

### スモーク (smoke/)
| ファイル | アサーション数 |
|---|---|
| `smoke/dev-agent-kosame-approval-board-smoke.js` | 46 |
| `smoke/dev-agent-v3.8.0-release-record-smoke.js` | リリース確認 |

---

## Approval Board 行構造

各操作 (commit / push / tag / release / dispatch / handoff) ごとに以下を生成：

| フィールド | 説明 |
|---|---|
| `action` | 操作名 |
| `recommendation` | YES / NO / HOLD |
| `reason` | 判断理由 |
| `requiredEvidence` | 必要な証拠条件リスト |
| `humanApprovalRequired` | じゅんやさんYESが必要かどうか |
| `dangerousActions` | 危険アクション一覧 |
| `safeNextStep` | 次に安全に実行できるコマンド |

---

## Human YES Compression

| 区分 | 内容 |
|---|---|
| `needsJunyaYes` | YESが必要な操作 (push/tag/releaseがYES推奨時) |
| `cannotYes` | NO判定でYESしてはいけない操作 |
| `aiCanContinue` | こさめ副社長が自律実行できる操作 |
| `cloudShellCheck` | Cloud Shellで確認すべき操作 (HOLD) |

---

## 操作別 humanApprovalRequired

| 操作 | humanApprovalRequired |
|---|---|
| commit | **false** |
| push | **true** (常時) |
| tag | **true** (常時) |
| release | **true** (常時) |
| dispatch | false |
| handoff | false |
