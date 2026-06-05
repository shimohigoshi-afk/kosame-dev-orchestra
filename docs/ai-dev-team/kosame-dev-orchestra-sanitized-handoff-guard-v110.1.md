# KOSAME Dev Orchestra — Sanitized Handoff Guard v110.1.0

## 概要

DeepSeek / Kimi などの外部・中国関連モデルへ情報を渡す際の厳格なサニタイズガード。
`sanitized:false` の場合、該当プロバイダーへのハンドオフは即座にブロックされる。

---

## ブロック対象プロバイダー

- `deepseek`
- `kimi`

---

## サニタイズが必要なフィールド（必ず削除・抽象化）

| フィールド | 説明 |
|-----------|------|
| `apiKeys` | APIキー |
| `secrets` | シークレット全般 |
| `envContent` | .env ファイルの内容 |
| `customerData` | 顧客データ |
| `insuranceData` | 保険データ |
| `healthData` | 健康・医療データ |
| `personalNames` | 個人名 |
| `emailAddresses` | メールアドレス |
| `phoneNumbers` | 電話番号 |
| `addresses` | 住所 |
| `contractContent` | 契約内容 |
| `billingDetails` | 請求・支払い情報 |
| `revenueDetails` | 売上の具体的数値 |
| `companyStrategy` | 未公開の社内戦略 |
| `rawLogs` | 識別子を含む生ログ |
| `githubTokens` | GitHub トークン |
| `deployCredentials` | デプロイ認証情報 |

---

## 許可されるコンテンツタイプ（sanitized後のみ）

- `abstractedErrorSummary` — 抽象化されたエラー要約
- `generalizedArchitectureQuestion` — 一般化されたアーキテクチャ質問
- `anonymizedCodeSnippet` — 匿名化されたコードスニペット
- `nonSensitivePseudoCode` — 非機密の擬似コード
- `genericRefactorQuestion` — 汎用リファクタリング質問
- `publicLibraryBehaviorQuestion` — 公開ライブラリの動作質問

---

## 拒否されるコンテンツタイプ

`apiKey`, `secret`, `envFile`, `customerData`, `insuranceData`, `healthData`, `personalName`, `emailAddress`, `phoneNumber`, `address`, `contractContent`, `billingDetail`, `exactRevenueFigure`, `unpublishedStrategy`, `rawLog`, `deployCredential`

---

## 出力フィールド

| フィールド | 説明 |
|-----------|------|
| `sanitized` | 入力値をそのまま反映 |
| `blocked` | ブロックされたか |
| `blockedReasons` | ブロック理由リスト |
| `redactedFields` | サニタイズ必要フィールド一覧 |
| `allowedContentTypes` | 許可コンテンツタイプ |
| `deniedContentTypes` | 拒否コンテンツタイプ |
| `targetProvider` | ターゲットプロバイダー |
| `finalDecisionAllowed` | 常に `false`（DeepSeek/Kimiへ） |
| `humanApprovalRequired` | 外部ハンドオフ時は `true` |

---

## 使用方法

```bash
npm run pm-agent:sanitized-handoff-guard-pack
npm run smoke:sanitized-handoff-guard-pack
```

---

## バージョン

- v110.1.0 — 初版、2026-06-05
