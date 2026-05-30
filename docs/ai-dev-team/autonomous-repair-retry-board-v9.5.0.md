# Autonomous Repair & Retry Board v9.5.0

## 概要

失敗時のrepair retry routing。どのエージェントへ差し戻すか、
何回リトライするか、いつ止めるかをpacketとして生成する。
実際の修正は実行しない。repair instruction packetを生成するだけ。

## 入力

| フィールド | 説明 |
|-----------|------|
| failureType | 失敗種別 |
| failedStep | 失敗したステップ名 |
| errorSummary | エラー概要テキスト |
| providerStatus | 各providerの稼働状態 |
| previousAttempts | これまでの試行回数 |
| riskLevel | リスクレベル |
| dataLevel | データレベル |

## 扱うfailureType

- syntax_error → claude
- verify_failure → claude
- missing_file → claude
- provider_unavailable → fallback chain → kosame
- safety_block → kosame (即時エスカレ)
- unclear_spec → kosame → Gemini
- human_approval_required → human (じゅんやさん)
- repeated_failure → STOP → こさめ副社長

## stopConditions

1. 3回以上連続失敗 → STOP
2. safety_block → 常にkosameエスカレ (auto retry禁止)
3. human_approval_required → 常にhuman (auto bypass禁止)
4. 全fallback試行後もprovider_unavailable → kosameエスカレ
5. riskLevel=critical → auto retry禁止、常にhuman approval first

## 出力

- repairBoardId
- failureClassification
- retryTargetAgent
- repairInstructionPacket
- retryLimit
- escalationPolicy
- stopConditions
- humanApprovalRequired
- recommendedNextAction
- dryRun: true (常に)
