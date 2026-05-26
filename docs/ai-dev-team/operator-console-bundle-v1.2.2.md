# Operator Console Bundle Pack v1.2.2

## 概要
Operator Console の現在状態を1つのポータブルなバンドルにまとめるパック。

## 目的
- 状態・スナップショット・承認待ち・検証結果を1つのJSONに集約
- こさめPMが一目で全体状況を把握できる
- セッション間の引き継ぎ情報として活用

## バンドル構造
- `state`: 現在の作業状態
- `snapshot`: ダッシュボードスナップショット
- `approvalPending`: 承認待ち項目
- `lastVerify`: 最新の verify 結果
- `lastActions`: 最新の GitHub Actions 結果

## 利用方法
```bash
node tools/operator-console-bundle-pack.js
```
