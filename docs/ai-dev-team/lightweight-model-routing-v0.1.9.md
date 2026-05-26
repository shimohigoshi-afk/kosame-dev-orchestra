# v0.1.9 Lightweight Model Routing

## 概要

v0.1.9 は、OpenAI / Gemini 両プロバイダーへの実 API 接続成功（v0.1.7 / v0.1.8）を受けて、
軽量モデルを中心としたルーティング方針を `providers/provider-config.js` に正式反映するバージョン。

API 実行はしない。Secret / APIキー値は読まない。

---

## v0.1.9 の目的

- 軽量モデル中心のルーティング方針をコードとして明示する
- タスク種別ごとに適切なプロバイダー・モデルを選択できる基盤を設ける
- 上位モデルへの逃げ道（premium モデル）を env override 可能な構造で確保する
- 将来の BackOffice Agent / BackOffice Orchestra への流用に備える

---

## 軽量モデル中心方針

常用モデルは軽量モデルとする。コスト効率とレイテンシを最優先する。

| プロバイダー | デフォルトモデル | 備考 |
|---|---|---|
| Gemini | `gemini-2.5-flash-lite` | `KOSAME_AGENT_MODEL_GEMINI` env で上書き可能 |
| OpenAI | `gpt-4o-mini` | `KOSAME_AGENT_MODEL_OPENAI` env で上書き可能 |

上位モデルは高リスク・高単価タスクのみ。常用しない。

---

## タスク別ルーティング方針

`provider-config.js` に `lightweightRoutingPolicy` として定義する。

### bulkProcessingProvider: gemini（大量処理・下読み・分類・要約）

- 大量テキストの分類・ラベリング
- ドキュメントの下読み・要約
- データ整形・前処理
- コストが積み上がる繰り返し処理

**理由**: Gemini は大コンテキスト処理・コスト効率に優れる。
`gemini-2.5-flash-lite` はその中で最も軽量なモデル。

### reviewProvider: gpt（判断・レビュー・PM補助）

- 判断・方針決定の補助
- コードレビュー・設計レビュー
- PM 補助・タスク分解
- 出力品質が重要なケース

**理由**: GPT は指示遵守・判断品質に安定感がある。
`gpt-4o-mini` は軽量ながら判断タスクに十分な能力を持つ。

### premiumReviewProvider: env override 可能（高リスク・高単価・最終レビュー）

- 最終成果物レビュー
- セキュリティ・コンプライアンス判断
- 高リスクな変更の承認補助

上位モデルへの切り替えは env override で行う。常用しない。

| 環境変数 | 対象 | デフォルト |
|---|---|---|
| `KOSAME_AGENT_PREMIUM_MODEL_GEMINI` | Gemini 上位モデル | `gemini-2.5-pro` |
| `KOSAME_AGENT_PREMIUM_MODEL_OPENAI` | OpenAI 上位モデル | `gpt-4o` |
| `KOSAME_AGENT_PREMIUM_REVIEW_PROVIDER` | 最終レビュープロバイダー | `gpt` |

---

## 上位モデルを常用しない理由

- コストが高い
- レイテンシが大きい
- 軽量モデルで十分なタスクに上位モデルを使うのは無駄
- Human Approval なしに上位モデルへ常時ルーティングする設計は避ける

上位モデルへの切り替えは **Human Approval** のもとで env を変更する。

---

## Human Approval が必要な境界

以下は Human Approval なしに実行してはならない:

- `KOSAME_AGENT_PREMIUM_MODEL_*` を本番環境に設定する
- 上位モデルを使う live call を実行する
- live call 自体の実行（`--live` フラグ + gate 条件）
- Secret Manager の値を変更する

---

## API実行・Secret読み取りについて

- **v0.1.9 は API を実行しない**
- provider-config.js はモデル名・方針・boolean・ルーティング情報のみ返す
- APIキー値・Secret値を一切返さない
- `.env` / Secret Manager / GitHub Secrets を読まない

---

## BackOffice Agent / BackOffice Orchestra への将来流用

本ルーティング方針は KOSAME Dev Orchestra に限らず、以下への流用を想定して設計している:

- **BackOffice Agent**: 社内業務自動化エージェント
- **BackOffice Orchestra**: 複数エージェントを束ねる業務オーケストレーター

流用時は `providers/provider-config.js` をそのままコピーし、
プロジェクト固有の env 変数名を `KOSAME_AGENT_` プレフィックスから変更するだけでよい。

---

## 注意事項

- このドキュメントに実キー値・実キーっぽいサンプルは含まない
- APIキー値を記録しないことは KOSAME Dev Orchestra の基本ルール
- ルーティング変更は Human Approval のもとで env を変更して行う
