# KOSAME Dev Orchestra Landing Page Requirement Pack v62.0.0

## 概要

開発前にLPで需要検証できるよう、LP要件・訴求・waitlist導線を整理するpackです。
実LP公開はしません。dryRun設計まで。

## LP原則

- 1秒で何のアプリか分かる
- ファーストビューで対象ユーザーと価値が分かる
- SNSでスクショが拡散されやすい
- waitlist登録導線がある
- 軽量・検証用LP (作り込みすぎない)
- 誇大広告・断定表現を避ける

## 安全設計

- `dryRun: true` / 実LP公開しない
- 実広告出稿なし / 実個人情報収集なし

## 使用方法

```bash
npm run pm-agent:landing-page-requirement
npm run smoke:landing-page-requirement
```
