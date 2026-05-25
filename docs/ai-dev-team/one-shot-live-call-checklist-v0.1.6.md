# v0.1.6 One-Shot Live Call 実行前チェックリスト

## 概要

OpenAI / Gemini への実 API 呼び出し（one-shot live call）を行う前に、
以下のすべての項目を確認する。**じゅんやさんの承認**が必要。

---

## チェックリスト

### 1. コード・リポジトリの状態

- [ ] `git status` が空（未コミット変更がない）
- [ ] `npm run verify` が全 passed / 0 failed で通っている
- [ ] GitHub Actions の verify ワークフローが通っている
- [ ] main ブランチが最新の状態である

### 2. プロバイダー選択

- [ ] 実行対象 provider は `gpt` または `gemini` のどちらか一方に限定する
- [ ] mock provider での動作確認が済んでいる
- [ ] 実行する taskPacket の内容を事前に確認している
- [ ] taskPacket に個人情報・秘密情報が含まれていない

### 3. Human Approval（必須）

- [ ] じゅんやさんが `--live` 実行を明示的に承認している
- [ ] 承認した provider・実行内容を確認している
- [ ] 承認なしに実行しない

### 4. 環境変数・Gate 条件

- [ ] `KOSAME_AGENT_LIVE_CALLS_ENABLED=true` がセットされている
- [ ] `KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL=true` がセットされている
- [ ] 対象 provider の APIキーが環境変数に存在する（boolean 確認のみ）
  - GPT: `OPENAI_API_KEY` が存在する
  - Gemini: `GEMINI_API_KEY` が存在する
- [ ] `node tools/agent-one-shot-preflight.js --provider=<gpt|gemini>` で `readyForOneShot: true` を確認

### 5. リソース制限

- [ ] `KOSAME_AGENT_MAX_TOKENS` は小さい値（300 以下推奨）に設定している
- [ ] `KOSAME_AGENT_TIMEOUT_MS` を設定している（15000 以下推奨）
- [ ] 呼び出す input（prompt）は短く、不要に長くしていない

### 6. 実行ルール

- [ ] 1回だけ実行する（連打しない）
- [ ] ループ・自動再試行しない
- [ ] CI / GitHub Actions に `--live` を絶対に付けない
- [ ] `KOSAME_AGENT_LIVE_CALLS_ENABLED` を GitHub Secrets に入れない

### 7. 実行後の確認

- [ ] ターミナルの出力にAPIキー値が含まれていないことを確認する
- [ ] ログファイルがある場合、APIキー値が記録されていないことを確認する
- [ ] 実行後に環境変数を解除する

```bash
unset OPENAI_API_KEY
unset GEMINI_API_KEY
unset KOSAME_AGENT_LIVE_CALLS_ENABLED
unset KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL
```

### 8. 課金・本番影響

- [ ] 課金が発生することを事前に認識している
- [ ] 連打・ループによる課金連打をしない
- [ ] 本番サービスに影響がないことを確認している
- [ ] deploy しない

---

## 実行コマンド（参考）

**preflight 確認（APIを呼ばない）:**

```bash
node tools/agent-one-shot-preflight.js --provider=gpt
node tools/agent-one-shot-preflight.js --provider=gemini
```

**one-shot live call（Human Approval 後のみ・1回だけ実行）:**

```bash
node tools/agent-live-call-one-shot.js --provider=gpt --live
```

---

## 禁止事項まとめ

| 禁止 | 理由 |
|---|---|
| APIキー値をAIチャットに貼る | AI側のログに残る可能性 |
| APIキー値をconsole.logする | ログ漏洩リスク |
| --live を CI に付ける | 自動課金連打リスク |
| .env にAPIキー値を書く | gitへの誤コミットリスク |
| 承認なしに --live を実行する | 課金・秘密情報漏洩リスク |
| 1回を超えて連打する | 課金連打リスク |
| deploy する | 本番影響リスク |
