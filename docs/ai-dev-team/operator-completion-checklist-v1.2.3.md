# Operator Completion Checklist v1.2.3

## 概要
Local Operator Console の完成条件を定義し、進捗を追跡するチェックリスト。

## 使い方
```bash
node tools/operator-completion-checklist-pack.js
```

## チェックリスト項目（必須）
- [ ] Unified CLI entry point wired
- [ ] Console bundle export working
- [ ] Safety contract validated
- [ ] Smoke registry up-to-date
- [ ] Self-review passed
- [ ] Handoff document generated
- [ ] Local console complete flow verified
- [ ] Release pack generated

## チェックリスト項目（任意）
- [ ] Claude escalation path verified
- [ ] Gemini next-work path verified

## 完了条件
必須項目がすべて `completed: true` になったとき `status: "COMPLETE"` となる。
