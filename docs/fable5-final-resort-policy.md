# Fable 5 Final Resort Policy

## 位置づけ
Fable 5 は KOSAME Dev Orchestra の **final_resort_lane（最終兵器）** である。

**常用禁止。** 通常は DeepSeek / Gemini / Claude / Llama / Groq で処理する。

以下の条件を **すべて満たす場合のみ** 提案・投入する。

## 投入条件
1. DeepSeek / Gemini / Claude 通常レーンで **2回以上** 修正しても同じバグが残る
2. 原因が **推測止まり** で、根本原因が特定できていない
3. JS / DOM / Enter / paste / click / SSE / ASL など **実ブラウザ検証** が必要
4. Playwright等で実機挙動を確認しないと判断できない
5. 人間や下位モデルで粘る方が **コスト高** になる
6. **リリース前の重要な最終根本原因調査** である

## 投入時のルール
- 投入理由を必ず明記する
- 例: `Fable 5投入理由: DeepSeekで2回修正してもEnter送信が直らず、実ブラウザでDOM/event listenerを確認する必要があるため`
- Console / Chat / docs に理由を残す

## 禁止事項
- ❌ 自動常用
- ❌ 最初から丸投げ
- ❌ 単純CSS変更
- ❌ docs追加のみ
- ❌ smoke追加のみ
- ❌ 「高性能だから」という理由
- ❌ 低コストモデルで十分な作業

## 通常レーン
| レーン | モデル | 用途 |
|--------|--------|------|
| L1 | DeepSeek V4 Flash | 大量実装、docs、smoke、単純UI、土木 |
| L2 | DeepSeek V4 Pro | 中規模実装、API連携、workflow |
| L3 | DeepSeek V4 Pro+Audit | 高難度実装、security、release gate |
| Gemini | Gemini | Google / Cloud Run / GCP / 広域確認 |
| Claude | Claude | sensitive repo、営業DX、丁寧な実装 |
| Llama/Groq | Llama/Groq | 軽量監査、安価な確認 |
| GPT | GPT上位 | PM、裁定、設計、判断整理 |
| **Fable 5** | **Fable 5** | **最終突破のみ（final_resort_lane）** |

## Model Lane
- lane: `final_resort_lane`
- model: `Fable 5`
- classification: `expensive_high_precision_root_cause_lane`
- default_enabled: `false`
- usage: `manual_proposal_only`
