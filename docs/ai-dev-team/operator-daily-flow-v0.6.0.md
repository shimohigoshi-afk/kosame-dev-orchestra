# Operator Daily Flow (v0.6.0)

## 標準的な 1日の流れ

1. **稼働開始確認 (09:00)**
   - GitHub Actions の結果を確認 (`gh run list`)
   - Cloud Run PM Agent のログを確認
2. **タスクの切り分け**
   - 新規チケットを Operator Command に変換
   - Gemini Bulk Work へ投入
3. **中間検証**
   - Gemini の生成物を Cloud Shell で検証 (`npm run verify`)
   - 失敗した場合は Claude Repair へ Handoff
4. **PM レビュー & 最終承認**
   - こさめ PM が Decision Log を記録
   - じゅんやさんへ Minimal Approval Packet を送信
5. **リリース & 記録 (18:00)**
   - `git push` & `deploy`
   - セッション記録を保存
