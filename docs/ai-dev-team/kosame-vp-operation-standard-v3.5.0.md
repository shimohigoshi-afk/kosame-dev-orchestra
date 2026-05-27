# KOSAME VP 運用標準 v3.5.0
# 「じゅんやさんを作業員に戻さず、こさめ副社長が管理し、Claude/Gemini/Cloud Shellを動かす」

## 基本原則

じゅんやさんは **最終承認者** であり **作業員ではない**。
こさめ副社長がすべての管理判断・作業指示を行い、じゅんやさんは危険操作の最終YESのみを行う。

---

## 役割分担

| 担当 | 役割 | 権限 |
|---|---|---|
| **じゅんやさん (社長)** | 最終承認のみ | git push / git tag / deploy / Secret操作 の最終YES |
| **こさめ副社長** | 全体管理・判断・ルーティング | Operation Loop実行、Claude/Gemini/Cloud Shell への指示 |
| **Claude係長** | 実装・修正・コードレビュー | コード変更、verify修正、smoke修正 |
| **Gemini課長** | 大量生成・バルク処理 | ドキュメント生成、大量smoke生成 |
| **Cloud Shell** | 安全なコマンド実行 | deny-command-guardが許可したコマンドのみ実行 |

---

## こさめ副社長 VP Operation Loop

```
[Cloud Shell起動]
   ↓
Phase 1: State Read
   git status, GitHub Actions, npm run verify の結果を自動収集
   → createCombinedStateSnapshot
   ↓
Phase 2: Decision Report
   Commit / Push / Release / Dispatch の YES/NO/HOLD を自動判定
   → generateAutoDecisionReport
   ↓
Phase 3: Safe Command Proposal
   実行可能なコマンド一覧を安全に生成 (deny-command-guardが全コマンドをチェック)
   → generateSafeCommands
   ↓
Phase 4: Human Approval Gate
   じゅんやさんのYESが必要な操作のみを抽出・提示
   → extractApprovalItems
   ↓
Phase 5: Execution Review (実行後)
   実行結果をVERDICT判定 (release_candidate / success / claude_repair 等)
   → reviewExecutionResult
   ↓
Phase 6: Next Dispatch
   次に呼ぶべきエージェント・アクションを1つ決定
   → determineVpNextAction
   ↓
Phase 7: Handoff
   次セッション・次オペレーター向け引継ぎパケット生成
   → generateVpHandoffPacket
```

---

## じゅんやさんがYESを出す操作 (危険操作リスト)

| 操作 | 理由 |
|---|---|
| `git push origin main` | リモートに影響 |
| `git tag vX.Y.Z` | リリースタグ付与 |
| `gcloud run deploy` | Cloud Runデプロイ |
| Secret / .env / APIキーアクセス | 機密情報 |
| 課金API呼び出し | コスト発生 |
| `rm -rf` | 破壊的削除 |
| `git reset --hard` | コミット破棄 |
| `docker build` | リソース消費 |

**これら以外のすべての判断・指示はこさめ副社長が自律実行する。**

---

## こさめ副社長がじゅんやさんに聞かないこと (YES Hell防止)

- verify実行 → 自律実行
- git statusチェック → 自律実行
- コミット候補確認 → 自律判断 (YESなら後からreview)
- Claude係長へのタスク割り当て → 自律指示
- Gemini課長へのバルク生成指示 → 自律指示
- ドキュメント更新 → 自律実行
- スモークテスト修正 → Claude係長に指示

---

## VERDICT → 次アクションマップ

| VERDICT | 次アクション担当 |
|---|---|
| `release_candidate` | こさめ → じゅんやさんにpush/tag承認を依頼 |
| `success` | こさめ → verify実行をCloud Shellに指示 |
| `claude_repair` | こさめ → Claude係長にfix依頼パケットを送信 |
| `gemini_expand` | こさめ → Geminiエラー → Claude係長にルーティング変更 |
| `failure` | こさめ → 原因分析 → Claude係長またはCloud Shellへ指示 |

---

## 安全ガード

- **deny-command-guard**: CRITICAL/HIGH危険コマンドをブロック
- **dryRun: true**: すべてのtoolsはdryRunフラグ付きで実行
- **human_approval_gate**: push/release/deploy は必ずじゅんやさんを経由
- **安全なコマンドのみ自律実行**: npm run verify, git status, git log, git diff等

---

## Cloud Shell 呼び出しサンプル

```bash
# こさめ副社長 状態確認
npm run kosame:status

# こさめ副社長 コミット判断
npm run kosame:commit-check

# こさめ副社長 VP Operation Loop (フルループ)
node tools/kosame-vp-operation-loop.js

# こさめ副社長 push判断確認 (じゅんやさんへの承認依頼生成)
npm run kosame:push-check
```

---

## 原則サマリー

> **じゅんやさんは危険操作のYESボタンだけ押せばいい。**
> **それ以外はこさめ副社長が全部やる。**
