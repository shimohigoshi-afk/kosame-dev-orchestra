# Gemini Agent Task Packet v0.4.4

Gemini エージェント専用のタスクパケット拡張定義。

---

## 概要

`MultiAgentTaskPacket` を Gemini 向けに具体化したもの。
Gemini の強みである「長文理解」と「GCP 専門知識」を最大限に引き出すための構成。

---

## パケット構造 (拡張部分)

```json
{
  "payload": {
    "geminiOptions": {
      "model": "gemini-1.5-pro",
      "temperature": 0.2,
      "responseMimeType": "application/json"
    },
    "analysisDepth": "deep",
    "focusAreas": ["cost", "security", "scalability"]
  }
}
```

---

## 主な用途と指示例

### 1. GCP 設定レビュー
- **指示**: 「提供された `cloud-run-service.yaml` をレビューし、セキュリティ上の不備がないか、コストを最適化できる余地がないか報告せよ。」
- **期待結果**: 指摘事項のリストと改善案。

### 2. 大規模ドキュメント要約
- **指示**: 「`docs/` 配下の全ファイルを読み、現在のプロジェクトの進捗と未解決の課題を 3 行で要約せよ。」
- **期待結果**: 簡潔な要約。

---

## 制約事項

- **実行能力の欠如**: Gemini は直接ファイルを編集したりコマンドを実行したりすることはできない（この役割は Claude Code が担う）。
- **出力形式**: 後続の PM Agent が処理しやすいよう、原則として JSON 形式での出力を求める。

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v0.4.4 | v0.1.2 から更新。マルチエージェント連携を前提とした構造に刷新。 |
