# KOSAME Sales Console Card/Auth Asset Mapping

updated 2026-07-09

このZIPは、KOSAME Sales Console のrepo投入用アセット一式です。
カード画像18枚と、ログイン用ロックアップ画像1枚を含みます。

## 重要ルール

- 画像はデザイン正本です。再生成・再描画・SVG/CSSでの描き直しは禁止。
- HTML/CSS側は配置、サイズ、余白、タイトル/説明文の管理だけを担当します。
- 画像内に文言を追加しません。
- タイトル・説明文はHTML側で管理します。
- 保険商品名、保険会社名、申込誘導、おすすめ、ランキング、断定表現は入れません。
- `git add -A`は禁止。対象ファイル・対象フォルダだけ個別addします。

## カード画像 18枚

| slug | カテゴリ | 推奨タイトル | 推奨説明文 | repo path |
|---|---|---|---|---|
| board | 面談デスク | 手書きボード | 面談中の要点や図解をその場で整理します。 | `public/assets/sales-console/cards/board.png` |
| meeting-memo | 面談デスク | 面談メモ | 面談内容・確認事項・次回対応を整理します。 | `public/assets/sales-console/cards/meeting-memo.png` |
| calc-memo | 面談デスク | 計算メモ | その場の試算メモや数字の確認を整理します。 | `public/assets/sales-console/cards/calc-memo.png` |
| required-coverage | 保険提案 | 必要保障額の目安 | 万一に備える金額の目安を、一般的な家計設計として確認します。 | `public/assets/sales-console/cards/required-coverage.png` |
| medical-coverage | 保険提案 | 医療保障チェック | 公的保障・自己負担・収入減少など、医療保障の確認ポイントを整理します。 | `public/assets/sales-console/cards/medical-coverage.png` |
| underwriting | 保険提案 | 医務査定確認 | 告知内容や確認資料のポイントを整理します。 | `public/assets/sales-console/cards/underwriting.png` |
| fund-check | 保険提案 | ファンド確認 | ファンド情報や資料の確認、推移確認を補助します。 | `public/assets/sales-console/cards/fund-check.png` |
| health-balance | 保険提案 | 健康・体格バランス | 身長・体重などの体格目安を確認します。 | `public/assets/sales-console/cards/health-balance.png` |
| mortgage | 住宅・不動産 | 住宅ローン試算 | 返済額・金利・期間の目安を確認します。 | `public/assets/sales-console/cards/mortgage.png` |
| land-area | 住宅・不動産 | 土地・エリア情報 | 土地や周辺エリアの確認ポイントを整理します。 | `public/assets/sales-console/cards/land-area.png` |
| building-price | 住宅・不動産 | 建物価格シミュレーション | 建物価格や付帯費用の目安を整理します。 | `public/assets/sales-console/cards/building-price.png` |
| lifeplan-inheritance | 生活資金・税務 | ライフプラン・相続 | 家計・将来資金・相続に関する確認事項を整理します。 | `public/assets/sales-console/cards/lifeplan-inheritance.png` |
| tax-calculation | 生活資金・税務 | 税務計算 | 税務に関する概算と確認ポイントを整理します。 | `public/assets/sales-console/cards/tax-calculation.png` |
| corporate-insurance | 法人提案 | 事業保障・退職金確認 | 事業継続・役員退職金・資金準備の考え方を整理します。 | `public/assets/sales-console/cards/corporate-insurance.png` |
| email-compose | 営業支援 | メール文章作成 | 面談後の御礼・日程調整・確認連絡を作成します。 | `public/assets/sales-console/cards/email-compose.png` |
| proposal-doc | 営業支援 | 提案資料作成 | 試算結果・確認事項をもとに資料の下書きを作成します。 | `public/assets/sales-console/cards/proposal-doc.png` |
| report-template | 営業支援 | 面談報告テンプレート | 面談内容・確認事項・次回対応を社内共有用に整理します。 | `public/assets/sales-console/cards/report-template.png` |
| minutes | 営業支援 | 面談記録作成 | 面談の要点・確認事項・次回対応を記録します。 | `public/assets/sales-console/cards/minutes.png` |

## ログイン画像

| slug | 用途 | repo path |
|---|---|---|
| auth-brand-lockup | ログイン画面のブランドロックアップ | `public/assets/sales-console/auth/auth-brand-lockup.png` |

## 注記テンプレート

> 本機能は一般的な確認・試算・整理を目的とした補助機能です。特定の保険商品・保険会社の推奨、契約申込の誘導を目的とするものではありません。

## 旧名からの変更

- `lifeplan-tax.png` は廃止方向。
- ライフプラン/相続は `lifeplan-inheritance.png`。
- 税務計算は `tax-calculation.png` として分離。
