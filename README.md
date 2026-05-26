# KOSAME Dev Orchestra

**共通 AI 開発チーム OS**

KOSAME Dev Orchestra は、ANESTY Board 専用ではなく、以下すべてのプロジェクトに流用できる共通 AI 開発チーム OS です。

- ANESTY Board（Discord ボット）
- KOSAME 営業 DX
- スマホ PWA
- 議事録 DX
- 案件発掘ツール
- Cloud Run 系プロダクト

---

## このリポジトリの役割

設計書・方針文書・テンプレート・検証スクリプトを管理する。
実装コードはプロジェクト別リポジトリに置く。

---

## 大原則

**じゅんやさんをコピペ作業員にしない。**

| 役割 | 担当 |
|---|---|
| 最終判断・commit / push / deploy 承認 | じゅんやさん（Human Approval） |
| 設計・切り分け・安全ゲート | こさめ PM |
| 下読み・要約・GCP 観点レビュー | Gemini Agents |
| 実装・差分作成 | Claude Code |
| 自動検証 | GitHub Actions |

---

## バージョン履歴（サマリー）

- **v0.1.x**: 基本設計・エージェントインターフェース・Live-Call ゲート
- **v0.2.x**: Cloud Run PM Agent 基礎・Launch Pack
- **v0.3.x**: Deploy 実行準備・Runtime Ops Pack
- **v0.4.0**: 初回 Deploy 手順
- **v0.4.1 - v0.4.2**: Post-Deploy & First Connection Pack
- **v0.4.3 - v0.4.6**: ガバナンス・ルーティング・障害対応強化
- **v0.4.7 - v0.5.0**: 運用監視・コスト制御・リリースガバナンス・オペレータコンソール基盤
- **v0.5.1 - v0.7.0**: オペレーターコマンド基盤（パケット化・キュー・Decision Log・Runbook） (Current)

---

## v0.4.3 - v0.4.6 Governance & Routing Refinement

| ファイル | 役割 |
|---|---|
| `docs/ai-dev-team/approval-gate-risk-matrix-v0.4.3.md` | 承認ゲート・リスクマトリクス |
| `docs/ai-dev-team/claude-code-approval-policy-v0.4.3.md` | Claude Code 承認ポリシー |
| `docs/ai-dev-team/safe-ask-deny-command-policy-v0.4.3.md` | 安全な Ask/Deny コマンド方針 |
| `docs/ai-dev-team/yes-hell-reduction-guide-v0.4.3.md` | Yes-Hell 回避ガイド |
| `docs/ai-dev-team/agent-role-routing-policy-v0.4.4.md` | エージェント役割ルーティング |
| `docs/ai-dev-team/claude-code-fix-packet-v0.4.4.md` | Claude Code 修正パケット形式 |
| `docs/ai-dev-team/gemini-agent-task-packet-v0.4.4.md` | Gemini タスクパケット（v0.4.4） |
| `docs/ai-dev-team/multi-agent-task-packet-v0.4.4.md` | 複数エージェント連携パケット |
| `docs/ai-dev-team/claude-code-dev-policy-v0.4.5.md` | Claude Code 開発方針 |
| `docs/ai-dev-team/gemini-agent-dev-policy-v0.4.5.md` | Gemini Agent 開発方針 |
| `docs/ai-dev-team/kosame-pm-review-policy-v0.4.5.md` | PM レビューポリシー |
| `docs/ai-dev-team/bug-repair-routing-guide-v0.4.6.md` | バグ修正ルーティングガイド |
| `docs/ai-dev-team/claude-fix-handoff-v0.4.6.md` | Claude 修正引き継ぎガイド |
| `docs/ai-dev-team/verify-failure-triage-v0.4.6.md` | 検証失敗時のトリアージガイド |

---

## v0.4.7 - v0.7.0 Expansion Packs

| バージョン | 名称 | 内容 |
|---|---|---|
| v0.4.7 | Runtime Monitoring Pack | ランタイム監視・ログ分析・健康状態シグナル |
| v0.4.8 | Cost Control Extension | コスト制御・軽量モデルルーティング拡張 |
| v0.4.9 | Release Governance Pack | リリースガバナンス・バージョニング・承認フロー |
| v0.5.0 | Operator Console Foundation | オペレータコンソール基盤・データ連携仕様 |
| v0.5.x | Operator Command Pack | コマンドパケット化・ディスパッチキュー・Decision Log・補修/大量生成インテーク・最小承認パケット |
| v0.6.x | Operator Runbook Pack | ランブック標準化・セッション記録・Actions結果レビュー・検証結果パーサー |
| v0.7.0 | Foundation Complete Pack | オペレーター基盤土台完成・次期UI実装計画 |
| v0.7.x | Operator Core Packs | 状態管理 (State)・Dashboard Data・CLI Status・Handoff 生成・承認分類 (Approval Board) |
| v0.8.x | Operator Integration Packs | Local Console MVP・Verify/GHA 結果記録・Agent パフォーマンス評価 (Scorecard) |
| v0.9.x | Operator Console Spec Packs | API 契約 (Contract)・UI 画面設計 (Spec)・セキュリティ境界 (Security Boundary) |
| v1.0.0 | MVP Foundation Complete | Operator Console MVP Foundation 完成・v1.1 以降の実装計画策定 |

**v1.0.0 で Operator Console MVP のための全基盤・規約・土台が完成。**

---

## Human Approval が必要な操作

以下は必ず **じゅんやさんの承認** を得てから実行する：

- `git commit`
- `git push`
- `git tag`
- `deploy`（Cloud Run / Railway）
- `gcloud` コマンド
- Secret Manager の値閲覧・変更
- 課金・外部 API 実接続
- PR / issue の作成

---

## 検証コマンド

```bash
npm run verify
```

## GitHub Actions 自動検証

`push` / `pull_request` 時に `.github/workflows/verify.yml` が自動で `npm run verify` を実行する。
v1.0.0 の全 smoke test（50件以上）が対象。
