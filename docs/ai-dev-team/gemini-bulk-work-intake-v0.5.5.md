# Gemini Bulk Work Intake (v0.5.5)

## 概要
Gemini Bulk Work Intake は、Gemini エージェントに対して「大量のファイル生成」や「広範囲のドキュメント更新」を一括で依頼するためのパケット形式である。

## インテークパケット定義
```json
{
  "bulkId": "BLK-20260526-001",
  "title": "v0.5.1〜v0.7.0 ドキュメント一括作成",
  "scope": "docs/ai-dev-team/",
  "constraints": {
    "noShellExecution": true,
    "editOnly": true,
    "fileLimit": 50
  },
  "deliverables": [
    "docs/ai-dev-team/operator-*.md",
    "tools/*.js"
  ],
  "verificationMethod": "Manual check in Cloud Shell"
}
```

## 運用ルール
1. **Shell 禁止**: Gemini は原則として shell command を実行しない（生成と編集に専念）。
2. **検証委託**: 生成物の verify は、後続の Claude または人間が Cloud Shell で行う。
3. **一括報告**: 作業完了後、作成したファイル一覧を明示して報告する。
