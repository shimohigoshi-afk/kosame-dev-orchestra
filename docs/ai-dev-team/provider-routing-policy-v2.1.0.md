# Provider Routing Policy v2.1.0

## 概要

Gemini / Claude / GPT(こさめ) / Cloud Shell / GitHub Actions の振り分けルールを定義する。
Geminiが停止した場合のfallbackも含む。

---

## Provider 振り分けマトリックス

| タスク内容 | 第一選択 | fallback | 理由 |
|---|---|---|---|
| **大量ファイル展開・bulk実装** | Gemini課長 | Claude係長 | コンテキストウィンドウが広く一括処理に向く |
| **GCP / インフラ構成** | Gemini課長 | Cloud Shell手動 | Google Cloud知識・最新情報に強い |
| **バグ修正・最小修正** | Claude係長 | — | ツール実行・verify cycle が得意 |
| **コード実装・verify循環** | Claude係長 | — | file edit + node --check + smoke が直結 |
| **設計方針・routing判断** | こさめ(GPT) | — | PM視点・全体統括 |
| **承認判断要約** | こさめ(GPT) | — | YES/NO packet生成に特化 |
| **CI/CD実行** | GitHub Actions | Cloud Shell | 自動化済みワークフロー |
| **verify・smoke確認** | Claude係長 | Cloud Shell | npm run verify が直接実行可能 |
| **最終YES/NO** | じゅんやさん | — | 責任者の最終判断のみ人間が担う |

---

## Provider Health 判定順序

1. `gemini_available` → Gemini優先
2. `gemini_quota_exhausted` OR `gemini_auth_error` OR `gemini_needs_fallback` → Claude係長へfallback
3. `github_actions_pending` → 完了まで待機
4. `github_actions_success` → verify扱い
5. `approval_required` → こさめが推奨YESまで整理 → じゅんやさんへ

---

## Routing 判断フロー

```
タスク発生
  └─ こさめが provider health を確認
       ├─ Gemini available → Geminiに依頼
       │    └─ 10分以上無反応 or 完走報告なし → Claude fallback
       └─ Gemini停止 → Claude係長へ handoff packet 生成
```

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v2.1.0 | 初版。Provider routing & Gemini fallback 体系化 |
