# OpenCode / Claude 実装指示: KOSAME Sales Console カード18枚 + ログイン画像投入

対象repo: `~/kosame-dev-orchestra`
主対象: `public/kosame-sales-console.html`

## 目的
このZIP内の画像を、Sales Console のカード右側ビジュアルとログイン画面のブランド画像としてrepoに投入する。
画像はデザイン正本として扱い、再生成・再描画・SVG/CSS化しない。

## 変更してよい
- `public/kosame-sales-console.html`
- `public/assets/sales-console/cards/*`
- `public/assets/sales-console/auth/*`
- `docs/design/sales-console/*`

## 禁止
- `git add -A`
- commit/push（報告後に人間確認）
- `package.json` 変更
- `public/kosame-live-cockpit.html` 変更
- `tools/` 変更
- `smoke/` 変更
- LP系HTML変更
- API / Secret / 認証仕様変更
- localStorage / sessionStorage の新規保存追加
- `LOAN_TAX_RULES` 変更
- 住宅ローン控除ロジック変更
- 画像をSVG/CSSで描き直すこと
- 画像に文字を焼き込むこと
- 保険商品名、保険会社名、申込誘導、おすすめ、ランキング、断定表現を追加すること

## repoへ配置する画像

### カード画像
```text
public/assets/sales-console/cards/
  board.png
  meeting-memo.png
  calc-memo.png
  required-coverage.png
  medical-coverage.png
  underwriting.png
  fund-check.png
  health-balance.png
  mortgage.png
  land-area.png
  building-price.png
  lifeplan-inheritance.png
  tax-calculation.png
  corporate-insurance.png
  email-compose.png
  proposal-doc.png
  report-template.png
  minutes.png
```

### ログイン画像
```text
public/assets/sales-console/auth/auth-brand-lockup.png
```

## HTML側の推奨タイトル/説明文

### board
- title: 手書きボード
- description: 面談中の要点や図解をその場で整理します。
- img: `assets/sales-console/cards/board.png`

### meeting-memo
- title: 面談メモ
- description: 面談内容・確認事項・次回対応を整理します。
- img: `assets/sales-console/cards/meeting-memo.png`

### calc-memo
- title: 計算メモ
- description: その場の試算メモや数字の確認を整理します。
- img: `assets/sales-console/cards/calc-memo.png`

### required-coverage
- title: 必要保障額の目安
- description: 万一に備える金額の目安を、一般的な家計設計として確認します。
- img: `assets/sales-console/cards/required-coverage.png`
- note: 「必要保障額」単独より「目安」表記を優先。特定商品推奨にしない。

### medical-coverage
- title: 医療保障チェック
- description: 公的保障・自己負担・収入減少など、医療保障の確認ポイントを整理します。
- img: `assets/sales-console/cards/medical-coverage.png`
- note: 最適・十分・給付される等の断定禁止。

### underwriting
- title: 医務査定確認
- description: 告知内容や確認資料のポイントを整理します。
- img: `assets/sales-console/cards/underwriting.png`
- note: 加入可能・査定OK・通る等の断定禁止。

### fund-check
- title: ファンド確認
- description: ファンド情報や資料の確認、推移確認を補助します。
- img: `assets/sales-console/cards/fund-check.png`
- note: おすすめ・ランキング・運用成果断定を出さない。

### health-balance
- title: 健康・体格バランス
- description: 身長・体重などの体格目安を確認します。
- img: `assets/sales-console/cards/health-balance.png`
- note: 医療・引受判断の断定にしない。

### mortgage
- title: 住宅ローン試算
- description: 返済額・金利・期間の目安を確認します。
- img: `assets/sales-console/cards/mortgage.png`

### land-area
- title: 土地・エリア情報
- description: 土地や周辺エリアの確認ポイントを整理します。
- img: `assets/sales-console/cards/land-area.png`

### building-price
- title: 建物価格シミュレーション
- description: 建物価格や付帯費用の目安を整理します。
- img: `assets/sales-console/cards/building-price.png`

### lifeplan-inheritance
- title: ライフプラン・相続
- description: 家計・将来資金・相続に関する確認事項を整理します。
- img: `assets/sales-console/cards/lifeplan-inheritance.png`
- note: 税務計算とは分離。旧 lifeplan-tax の役割をこちらへ寄せる。

### tax-calculation
- title: 税務計算
- description: 税務に関する概算と確認ポイントを整理します。
- img: `assets/sales-console/cards/tax-calculation.png`
- note: 税務判断・節税断定ではなく、概算・確認補助として扱う。

### corporate-insurance
- title: 事業保障・退職金確認
- description: 事業継続・役員退職金・資金準備の考え方を整理します。
- img: `assets/sales-console/cards/corporate-insurance.png`
- note: 法人保険・節税保険・最適商品比較の表現は禁止。

### email-compose
- title: メール文章作成
- description: 面談後の御礼・日程調整・確認連絡を作成します。
- img: `assets/sales-console/cards/email-compose.png`
- note: 加入促進・申込案内・保険提案メールに寄せない。

### proposal-doc
- title: 提案資料作成
- description: 試算結果・確認事項をもとに資料の下書きを作成します。
- img: `assets/sales-console/cards/proposal-doc.png`
- note: おすすめ商品を自動選定・申込資料作成にしない。

### report-template
- title: 面談報告テンプレート
- description: 面談内容・確認事項・次回対応を社内共有用に整理します。
- img: `assets/sales-console/cards/report-template.png`
- note: 成約見込み・申込見込み・クロージング状況の表現は禁止。

### minutes
- title: 面談記録作成
- description: 面談の要点・確認事項・次回対応を記録します。
- img: `assets/sales-console/cards/minutes.png`
- note: 保険提案議事録・申込意向記録に寄せない。

## ログイン画像の使い方
ログイン画面では、既存の傘単体SVGや別々の文字組みを無理に再現しない。
`assets/sales-console/auth/auth-brand-lockup.png` をブランドロックアップとして配置する。
既存HTMLに別途 `KOSAME` / `SALES CONSOLE` の文字がある場合、重複表示にならないように整理する。
ただし認証仕様やログイン処理は変更しない。

## CSS配置方針
- カード画像は `<img>` で読み込む。
- `object-fit: contain` を使う。
- 画像比率を保持する。
- `.tool-card` のタイトルが縦折れしないよう、右ビジュアル領域とテキスト領域を分離する。
- 画像はカード右側ビジュアル扱い。文字はHTML側。
- 営業支援の折り畳み仕様は維持する。

## 検証コマンド
```bash
cd ~/kosame-dev-orchestra
git status --short public/kosame-sales-console.html public/assets/sales-console/cards public/assets/sales-console/auth docs/design/sales-console
grep -o 'assets/sales-console/cards/[^"'"'"']*\.png' public/kosame-sales-console.html | sort | uniq -c
grep -o 'assets/sales-console/auth/[^"'"'"']*\.png' public/kosame-sales-console.html | sort | uniq -c
python3 - <<'PY'
from pathlib import Path
s = Path('public/kosame-sales-console.html').read_text()
start = s.find('<script>')
end = s.rfind('</script>')
Path('/tmp/kosame-sales-console-script.js').write_text(s[start+8:end] if start != -1 and end != -1 else '')
print('/tmp/kosame-sales-console-script.js')
PY
node --check /tmp/kosame-sales-console-script.js
git diff --name-only
```

## commit前確認
`git add -A`は禁止。以下のように個別addする。
```bash
git add public/kosame-sales-console.html
git add public/assets/sales-console/cards
git add public/assets/sales-console/auth
git add docs/design/sales-console
git diff --cached --name-only
```
`git diff --cached --name-only` に、対象外ファイルが混ざっていたらcommitしない。

## 報告内容
1. 配置した画像一覧
2. 18/18カード参照確認
3. ログイン画像参照確認
4. タイトル/説明文の変更内容
5. コンプラ文言対応
6. node --check結果
7. 変更ファイル一覧
8. commit message案
