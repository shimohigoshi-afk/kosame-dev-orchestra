# Yes Hell Reduction Approval Packet v2.1.0

## 概要

じゅんやさんに細かく聞かず、最終判断だけ出せる承認パケットの標準フォーマット。
こさめがこの形式で整理し、じゅんやさんへ提出する。

---

## Approval Packet フォーマット

```
## Approval Packet v2.1.0

- 推奨：YES / NO / HOLD
- 理由：[こさめが判断した根拠]
- 残リスク：[残っているリスク]
- 危険操作：[含まれる場合のみ記載。含まれない場合は「なし」]
- じゅんやさんの操作：[じゅんやさんが実際に行う操作のみ]
- AI側で完了済みの確認：[smokeテスト・node --check・verify結果など]
- 次アクション：[YESの場合に行う次のステップ]
```

---

## 記入例（Gemini fallback → Claude実装完了時）

```
## Approval Packet v2.1.0

- 推奨：YES
- 理由：Gemini認証エラーによりClaudeが代行実装。npm run verify 全PASS。node --check OK。
- 残リスク：Gemini quota回復後の再統合が必要になる可能性あり（影響なし）
- 危険操作：なし
- じゅんやさんの操作：git commit → git push → git tag v2.1.0
- AI側で完了済みの確認：
  - node --check: 全新規JSファイル OK
  - npm run verify: 全smoke PASS
  - git status: 差分が意図通り
- 次アクション：commit後にGitHub Actions確認
```

---

## 使用タイミング

- Claude実装完了 → こさめがpacket生成 → じゅんやさんへ提出
- Gemini fallback完了時
- package version更新・リリース時
- 新機能追加のcommit/push前

---

## 禁止事項

- じゅんやさんにコードの詳細を聞かない
- 複数の小さな質問を分けて聞かない
- 承認パケット無しで危険操作を開始しない

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| v2.1.0 | 初版。YES地獄排除のための標準パケット定義 |
