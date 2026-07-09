# KOSAME Sales Console Card Visual Assets

Repo target:

public/assets/sales-console/cards/

These are repo-ready transparent SVG visuals for each Sales Console card.
Use each file as a right-side card visual. Do not redraw card illustrations inside
public/kosame-sales-console.html.

Recommended HTML:

```html
<div class="card-visual" aria-hidden="true">
  <img class="card-visual-img" src="/assets/sales-console/cards/board.svg" alt="">
</div>
```

Recommended CSS:

```css
.tool-card{
  display:grid;
  grid-template-columns:minmax(0,1fr) 38%;
  align-items:center;
  gap:18px;
  min-height:150px;
  padding:24px 24px 22px 26px;
}
.card-visual{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  opacity:.88;
  pointer-events:none;
}
.card-visual-img{
  width:100%;
  max-width:230px;
  height:118px;
  object-fit:contain;
  filter:drop-shadow(0 0 10px rgba(216,181,106,.10));
}
.tool-card:hover .card-visual{opacity:1}
@media(max-width:768px){
  .tool-card{grid-template-columns:1fr}
  .card-visual{display:none}
}
```

Mapping:
- 手書きボード: board.svg
- 面談メモ: meeting-memo.svg
- 計算メモ: calc-memo.svg
- 医務査定確認: underwriting.svg
- 必要保障額: required-coverage.svg
- 医療保障チェック: medical-coverage.svg
- ファンド確認: fund-check.svg
- 健康・体格バランス: health-balance.svg
- 住宅ローン試算: mortgage.svg
- 土地・エリア情報: land-area.svg
- 建物価格シミュレーション: building-price.svg
- ライフプラン・相続・税務: lifeplan-tax.svg
- 事業保障・退職金・法人保険: corporate-insurance.svg
- メール文章作成: email-compose.svg
- 提案資料作成: proposal-doc.svg
- 会社報告テンプレート: report-template.svg
- 議事録作成: minutes.svg
