# Operator Approval Board (v0.7.5)

## 概要
Operator Approval Board は、数多くの「承認待ち」項目を整理し、人間（じゅんやさん）が最終的な判断を下しやすくするための管理盤である。

## 目的
- 「YES地獄（何でもYESと言わされる状況）」を回避する。
- 承認項目を「単純な確認」と「高度な判断」に分類し、適切なエージェントや人間に割り振る。
- じゅんやさんには「最終的なYES/NO」のみを提示する状態を作る。

## 構成
- `Approval List`: 現在保留中の全項目。
- `Decision Categories`: 各項目への推奨アクション。
- `Risk Analysis`: 承認することによるリスクの明示。
