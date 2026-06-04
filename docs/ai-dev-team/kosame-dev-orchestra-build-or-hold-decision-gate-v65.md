# KOSAME Dev Orchestra Build or Hold Decision Gate v65.0.0

## 概要

v61〜v64を統合し、BUILD / HOLD / PIVOT / VALIDATE_MORE / SCALE を判定するゲートpackです。

## 判定ロジック

| 条件 | 判定 |
|------|------|
| targetUser未定義 | HOLD |
| oneSecondUnderstandingScore < 5 | VALIDATE_MORE |
| waitlist = 0 | HOLD |
| CPA ≤ 300円 | BUILD候補 |
| CPA 300〜1000円 | VALIDATE_MORE |
| CPA > 1000円 | PIVOT候補 |
| CVR ≥ 1% | BUILD/CONTINUE候補 |
| CVR = 0%(母数十分) | PIVOT候補 |
| retention30d ≥ 15% + LTV>CAC | SCALE候補 |
| データ不足 | VALIDATE_MORE |

## 目的

「作れるか」ではなく「誰が欲しがるか」「なぜ買うか」「PMFに近づけるか」を判定する。
SEが弱くなりがちな営業・需要・訴求・数字判断をKOSAME Dev Orchestraの標準ゲートにする。

## 安全設計

- `dryRun: true` / `humanApprovalRequired: true`
- 実広告・実LP・実SNS・実決済なし
- じゅんやさんが最終判断

## 使用方法

```bash
npm run pm-agent:build-or-hold-decision-gate
npm run smoke:build-or-hold-decision-gate
```
