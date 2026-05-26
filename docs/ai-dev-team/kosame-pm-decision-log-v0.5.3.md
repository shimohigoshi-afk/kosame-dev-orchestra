# Kosame PM Decision Log (v0.5.3)

## 概要
Kosame PM Decision Log は、こさめ PM エージェントが行ったすべての「裁定（Decision）」を記録するログである。これにより、なぜその変更が承認されたのか、または Claude による補修が必要と判断されたのかを後から追跡できる。

## 記録対象
- `commit_approval`: commit してもよいかどうかの判断
- `repair_request`: Claude Code への補修依頼
- `human_escalation`: じゅんやさんへのエスカレーション判断
- `retry_request`: Gemini への再投入依頼

## 運用フロー
1. エージェントが作業を完了し `needs_review` 状態になる。
2. こさめ PM が内容を確認。
3. 判断結果を Decision Log に記録。
4. 次のステートへ移行。
