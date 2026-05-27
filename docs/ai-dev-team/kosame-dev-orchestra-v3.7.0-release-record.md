# KOSAME Dev Orchestra v3.7.0 Release Record

## バージョン
v3.7.0 — Kosame Real Repo Snapshot Reader Pack

## リリース日
2026-05-27

## 目的
実際のCLIテキスト出力（package.json / git status / git log / gh run list / tag list / verify log）を受け取り、repo状態を構造化スナップショット＋riskLevelに変換する。実際のgit/ghコマンドは実行しない。

---

## 実装ファイル

### ツール (tools/)
| ファイル | 説明 |
|---|---|
| `tools/kosame-real-repo-snapshot.js` | テキスト入力をパースしてsnapshot + riskLevelを返す |

### スモーク (smoke/)
| ファイル | アサーション数 |
|---|---|
| `smoke/dev-agent-kosame-real-repo-snapshot-smoke.js` | 51 |
| `smoke/dev-agent-v3.7.0-release-record-smoke.js` | リリース確認 |

---

## パーサー一覧

| 関数 | 入力 | 出力キー |
|---|---|---|
| `parsePackageVersion` | package.json文字列 | currentVersion |
| `parseGitStatus` | git status -sb出力 | workingTreeClean, aheadBehind, uncommittedFiles |
| `parseGitLog` | git log出力 | headCommit, originMainCommit, recentCommits |
| `parseGhRunList` | gh run list出力 | actionsStatus, latestRun |
| `parseTagList` | git tag --list出力 | latestTag, tags |
| `parseVerifyLog` | npm run verify出力 | verifyStatus, passedCount, failedCount |

---

## riskLevel 分類

| riskLevel | 意味 |
|---|---|
| `release_ready` | 全グリーン。リリース候補 |
| `clean_and_synced` | クリーン + Actions success だがverify未実行 |
| `ahead_unpushed` | push待ちコミットあり |
| `uncommitted_changes` | 未コミット変更あり |
| `tag_missing` | タグなし |
| `actions_pending` | Actions実行中 |
| `actions_failed` | Actions失敗 |
| `dangerous_unknown` | 状態不明 |

---

## 安全設計
- テキスト解析のみ。実際のgit/ghコマンドは実行しない
- dryRun: true
- timeout検出: verifyLogのTIMEOUT文字列を優先検出
