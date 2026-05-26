# PM Review Before Commit Policy (v0.5.3)

## ポリシー
1. **No Decision, No Commit**: Decision Log に記録がない変更は commit を禁止する。
2. **Review Scope**: 
   - コードの論理的妥当性
   - セキュリティ（APIキー漏洩等）の有無
   - テスト（smoke test）の通過状況
   - 既存機能への影響
3. **Escalation Trigger**:
   - リスク L3 以上
   - 判断に迷う複雑な仕様変更
   - コストが想定を大幅に超える場合
