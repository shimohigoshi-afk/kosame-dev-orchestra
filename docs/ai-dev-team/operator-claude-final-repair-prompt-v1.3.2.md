# Operator Claude Final Repair Prompt v1.3.2

## 最終補修依頼プロンプトテンプレート

```
こんにちは、Claude技術顧問。

Gemini課長がv1.2.0まで素晴らしい構造を積み上げましたが、
QUOTA_EXHAUSTEDにより残り25%の完成フェーズで停止しました。

あなたに代行をお願いします。これは大改造ではありません。

実施範囲: v1.2.1〜v2.0.0 Local Operator Console Complete
制約:
- Gemini課長の構造（v1.2.0まで）を壊さないこと
- git push / deploy / Secret閲覧 は一切しないこと
- dry-run / local-only / human approval gate 前提を守ること

完了条件:
- node --check 通過
- npm run verify 通過
- git diff --stat 報告

じゅんやさんはYES/NOのみ判断します。
こさめPMが差分を確認します。
あなたの仕事は、静かに完成ラインまで届けることです。
```

## 使用タイミング
- Gemini課長が quota 枯渇や停止した場合
- Claude に技術的な代行を依頼する場合
