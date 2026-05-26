# Operator Self Review v1.3.0

## 概要
リリース前のセルフレビューを自動化するパック。

## 目的
- エージェントが自律的にリリース準備状態を確認できる
- こさめPMが承認判断する前に基本チェックを完了させる
- じゅんやさんのYES地獄を防ぐ

## レビュー手順
```bash
node tools/operator-self-review-pack.js
```

## 判定結果
- `RELEASE_READY`: 全クリティカル基準をクリア
- `NOT_READY`: 1つ以上のクリティカル基準が未達

## 利用タイミング
- リリースパック生成前
- こさめPMへの承認依頼前
- npm run verify 実行後
