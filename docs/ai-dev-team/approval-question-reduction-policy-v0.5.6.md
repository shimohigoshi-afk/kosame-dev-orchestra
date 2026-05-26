# Approval Question Reduction Policy (v0.5.6)

## 方針
「YES地獄」を回避するため、以下のルールを徹底する。

1. **Self-Correction First**: 軽微なエラーは人間に聞かずに Claude Code で自動補修を試みる。
2. **Batching Decisions**: 10個の小さな変更を個別に聞かず、1つの大きなリリースパケットとして一括で聞く。
3. **Preset Defaults**: リスク L1-L2 の操作は「事後報告」または「PM 承認のみ」で進行し、人間には「結果の要約」だけを渡す。
4. **Binary Questions**: 質問は「Yes か No か」で答えられる形式に変換してから渡す。「どうすればいいですか？」というオープンな質問は避ける。
