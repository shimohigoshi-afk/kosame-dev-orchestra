# Agent Dispatch Priority Policy (v0.5.2)

## 優先度定義

| 優先度 | 名称 | 対応 |
|---|---|---|
| P0 | Critical | 即時対応。Human Approval Gate 直行。 |
| P1 | High | 本日のリリースに必要な作業。優先的に処理。 |
| P2 | Normal | 通常の開発作業。 |
| P3 | Low | 内部改善・ドキュメント修正。空き時間に処理。 |

## 優先度判定
- 本番環境の停止、セキュリティホールは P0。
- npm run verify 失敗の修正は P1。
- 新機能のドキュメント作成は P2。
- README のタイポ修正は P3。
