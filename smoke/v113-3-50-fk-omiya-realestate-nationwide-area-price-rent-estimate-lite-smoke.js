const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'public', 'fk-omiya-console.html');
const pkgPath = path.join(repoRoot, 'package.json');

const html = fs.readFileSync(htmlPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const nationalBlockStart = html.indexOf('🗾 全国版 エリア価格・賃料推定 Lite');
const nationalBlockEnd = html.indexOf('<div class="re-api-note">', nationalBlockStart);
const nationalBlock = nationalBlockStart >= 0 && nationalBlockEnd > nationalBlockStart ? html.slice(nationalBlockStart, nationalBlockEnd) : '';

console.log('===== v113-3-50 real estate nationwide area price rent estimate lite smoke =====');

assert.strictEqual(pkg.version, '113.3.50', 'package version must be 113.3.50');
assert.ok(pkg.scripts['smoke:v113-3-50'], 'smoke:v113-3-50 script must exist');

assert.ok(html.includes('全国版 エリア価格・賃料推定 Lite'), 'must expose nationwide section');
assert.ok(html.includes('都道府県'), 'must include prefecture input');
assert.ok(html.includes('市区町村'), 'must include city input');
assert.ok(html.includes('町名/エリア'), 'must include area input');
assert.ok(html.includes('駅徒歩'), 'must include walk input');
assert.ok(html.includes('築年数'), 'must include age input');
assert.ok(html.includes('専有面積 / 土地面積'), 'must include size input');
assert.ok(html.includes('物件種別'), 'must include type input');
assert.ok(html.includes('間取り'), 'must include room input');
assert.ok(html.includes('売買 / 賃貸 / 両方'), 'must include mode input');
assert.ok(html.includes('渋谷区 / 恵比寿') || html.includes('渋谷区 恵比寿'), 'must include Ebisu sample');
assert.ok(html.includes('大阪市北区') && html.includes('梅田'), 'must include Umeda sample');
assert.ok(html.includes('名古屋市中村区') && html.includes('名駅'), 'must include Meieki sample');
assert.ok(html.includes('福岡市博多区') && html.includes('博多駅前'), 'must include Hakataekimae sample');
assert.ok(html.includes('さいたま市大宮区') && html.includes('桜木町'), 'must include Omiya sample');
assert.ok(html.includes('推定成約価格'), 'must include sale estimate');
assert.ok(html.includes('参考月額賃料'), 'must include rent estimate');
assert.ok(html.includes('表面利回り'), 'must include yield estimate');
assert.ok(html.includes('完全一致データではなく、地方区分・都市規模をもとにした参考推定'), 'must show fallback wording');
assert.ok(html.includes('国交省データだけでは現在募集家賃の網羅は難しい'), 'must warn about rent coverage');
assert.ok(html.includes('地図クリック時は緯度経度から町名/町丁目を判定して同じ全国版ロジックへ流す'), 'must describe map-click to nationwide logic');
assert.ok(html.includes('Google Maps や国土地理院タイルは地図表示だけに使い'), 'must mention map display-only note');
assert.ok(html.includes('ブラウザから API key は直打ちしません'), 'must warn about browser API keys');

assert.ok(nationalBlock.includes('data-estimated-price=""'), 'must expose estimated price dataset attribute');
assert.ok(nationalBlock.includes('data-estimated-rent=""'), 'must expose estimated rent dataset attribute');
assert.ok(nationalBlock.includes('data-estimated-yield=""'), 'must expose estimated yield dataset attribute');
assert.ok(nationalBlock.includes('data-selected-area=""'), 'must expose selected area dataset attribute');
assert.ok(html.includes('fkRealEstateNationwideSelectedPrice'), 'must persist selected price key');
assert.ok(html.includes('fkRealEstateNationwideSelectedRent'), 'must persist selected rent key');
assert.ok(html.includes('fkRealEstateNationwideSelectedYield'), 'must persist selected yield key');
assert.ok(html.includes('fkRealEstateNationwideSelectedArea'), 'must persist selected area key');
assert.ok(html.includes('searchRealestateNationwide'), 'must define nationwide search handler');
assert.ok(html.includes('applyRealestateNationwideEstimateToMortgage'), 'must define nationwide mortgage handoff');
assert.ok(html.includes('applyNationwideSample'), 'must define nationwide sample selector');

assert.ok(!nationalBlock.includes('fetch('), 'must not perform direct fetch in nationwide block');
assert.ok(!nationalBlock.includes('google.maps.'), 'must not use live Google Maps API in nationwide block');
assert.ok(!nationalBlock.includes('cyberjapandata.gsi.go.jp'), 'must not use live GSI tile endpoint in nationwide block');
assert.ok(!nationalBlock.includes('tile.gsi.go.jp'), 'must not use live GSI tile endpoint in nationwide block');
assert.ok(!nationalBlock.includes('SUUMO'), 'must not scrape SUUMO in nationwide block');
assert.ok(!nationalBlock.includes("HOME'S"), 'must not scrape HOME\'S in nationwide block');

assert.ok(html.includes('地図クリック価格推定 Lite'), 'must preserve v113.3.49 map click UI');
assert.ok(html.includes('FK Omiya Real Estate Pricing Score Lite'), 'must preserve v113.3.48 pricing score lite');

console.log('PASS: v113.3.50 nationwide real estate estimate UI and wiring checks');
