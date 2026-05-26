# Human Approval Minimal Packet (v0.5.6)

## 概要
Human Approval Minimal Packet は、人間（じゅんやさん）が判断を下すために必要な「最小限の要素」をまとめたパケットである。情報のノイズを削ぎ落とし、即断即決を支援することを目的とする。

## 構成要素
- **Decision Request**: 何を承認してほしいか（例: v0.7.0 commit & push）
- **Risk Level**: リスク判定（L1-L4）
- **PM Recommendation**: こさめ PM の推奨アクション（Yes/No/Retry）
- **Evidence URL**: 詳細を確認したい場合のリソース（GitHub Diff / Log）
- **Cost Impact**: この操作による想定コスト（API 課金等）

## フォーマット案
> 【承認依頼】v0.7.0 リリース
> リスク: L3 (git push 含む)
> 推奨: 承認 (Verify 済)
> 影響: package.json version 0.7.0 へ更新
> [承認] [保留] [Claude補修依頼]
