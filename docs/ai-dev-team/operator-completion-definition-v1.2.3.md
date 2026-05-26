# Operator Completion Definition v1.2.3

## 完成の定義（Definition of Done）

### Local Operator Console Complete とは

以下がすべて満たされた状態を指す：

1. **CLI機能完備**: status / next / approval / handoff / verify-record / actions-record / dashboard / release / escalate-claude / next-gemini / help が全て動作する
2. **安全性**: git push / deploy / Secret閲覧 を一切行わない
3. **Human Approval Gate**: 外部影響のある操作は必ずじゅんやさんのYES/NOを経る
4. **npm run verify 通過**: 全 smoke test が pass する
5. **ドキュメント整備**: README / docs / fixtures が最新状態
6. **package.json version**: 2.0.0 に更新済み

### 完成ではないもの
- Web UI（Cloud Run UI は v2.1.x 以降）
- 自動エージェントディスパッチ
- Gemini quota 回復後の再統合
