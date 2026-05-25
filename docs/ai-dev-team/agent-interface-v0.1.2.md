# Agent Interface v0.1.2

KOSAME Dev Orchestra における AI エージェント共通インターフェース定義。

---

## 概要

すべての provider（mock / GPT / Gemini）は同一の関数シグネチャと返却形式を実装する。
呼び出し元（agent-runner-local 等）は provider を差し替えても動作する。

---

## provider インターフェース

```js
// provider module が export するもの
{
  name: string,                  // "mock" | "gpt" | "gemini"
  run(taskPacket): Promise<ProviderResult>
}
```

---

## taskPacket 形式

```js
{
  id: string,       // "task-001" など一意の識別子
  type: string,     // "review" | "summarize" | "generate"
  input: string,    // エージェントへの指示文
  options: {
    language?: string,   // "ja" | "en"
    maxTokens?: number,
  }
}
```

---

## ProviderResult 形式

```js
{
  success: boolean,       // true: 正常応答, false: エラー / dry-run
  provider: string,       // "mock" | "gpt" | "gemini"
  response: string|null,  // 成功時の応答テキスト
  error: string|null,     // 失敗時のエラーメッセージ
  dryRun: boolean,        // true: 実API呼び出しを行っていない
}
```

---

## provider 別の現在の挙動

| provider | 実API呼び出し | 挙動 |
|---|---|---|
| mock | なし | ローカル固定応答を返す（success: true） |
| gpt | disabled | dry-run エラーを返す（success: false, dryRun: true） |
| gemini | disabled | dry-run エラーを返す（success: false, dryRun: true） |

---

## ファイル構成

```
providers/
  mock-provider.js    — ローカル固定応答
  gpt-provider.js     — GPT API 接続予定（現在 disabled）
  gemini-provider.js  — Gemini API 接続予定（現在 disabled）

tools/
  agent-task-packet-sample.js  — taskPacket サンプル出力
  agent-router-dry-run.js      — 全 provider への dry-run ルーティング
  agent-runner-local.js        — --provider= 引数で provider を切り替え
```

---

## Human Approval が必要な操作

- 実 API キーの設定・有効化
- `dryRun: false` への切り替え
- 外部 API への実接続有効化

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v0.1.2 | Agent Interface 定義・provider scaffold 実装 |
| v0.1.3 | Agent API Wiring Preparation（API接続設計・disabled stub） |
