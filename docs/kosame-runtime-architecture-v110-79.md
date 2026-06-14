# KOSAME Runtime Architecture

> バージョン: 110.79.0  
> ステータス: 構成判断メモ  
> 目的: KOSAME Dev Orchestra と商品repoの関係を明確化する

## 1. KOSAME Dev Orchestra の位置づけ

KOSAME Dev Orchestra は開発OS・母艦として継続する。  
Claude/Codex/GPT/Gemini/DeepSeek/Grok等のAIを束ね、安全な開発運用を支える基盤である。

KOSAME Dev Orchestra は商品本体ではなく、商品を作るためのOSである。

## 2. 商品/業務システムは別repoで開発する

以下の商品/業務システムは、KOSAME Dev Orchestra とは別repoで開発する。

- 営業DX
- KOSAME Video Factory（動画作成）
- HP作成OS

KOSAME Dev Orchestra 内に商品機能を増やしすぎない。  
各repoは KOSAME Dev Orchestra の共通思想をテンプレートとして利用する。

## 3. 流用する共通部品

各商品repoで流用する共通部品・運用ルール:

- human_gate（人間承認ゲート）
- cheap-first routing（最安優先ルーティング）
- AI役割分担（GPT/Claude/Gemini/DeepSeek/Grokの使い分け）
- DeepSeek/GPT/Claudeレビュー体制
- smoke / verify テスト体系
- pre-commit scope check
- 危険ゲート（SECURITY_VIOLATION検出）
- commit/tag/push安全運用（force push禁止、tag上書き禁止）
- 作業ログ・成果物管理

## 4. Cloud Run運用方針

Cloud Runは KOSAME Dev Orchestra の実行基盤として継続利用する。

運用原則:

- Cloud Run内で長時間waitしない
- 承認待ちはDBや外部stateに保存する
- 承認後に再開する
- 長時間処理は Cloud Run Jobs / Cloud Tasks / Pub/Sub 等へ逃がす

## 5. Google Driveの位置づけ変更

Google Driveは主ストレージではなく、共有/出力/人間確認用に降格する。

変更内容:

- 実行状態・承認待ち・キュー管理は Google Drive に持たせない
- 将来的には DB / GCS / Markdown / GitHub / Obsidian 閲覧などを検討

## 6. 今後の進行

1. v110.79 finalized 後、営業DX本体repo作成へ進む
2. 営業DX本体repoでは、KOSAME Dev Orchestra の共通思想をテンプレートとして使う
3. KOSAME Dev Orchestra は商品開発の母艦として保守・改善を継続する
