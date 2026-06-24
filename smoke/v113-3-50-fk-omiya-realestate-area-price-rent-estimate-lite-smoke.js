const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'public', 'fk-omiya-console.html');
const pkgPath = path.join(repoRoot, 'package.json');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const html = read(htmlPath);
const pkg = JSON.parse(read(pkgPath));
const realestateSection = html.slice(
  html.indexOf('<!-- REAL ESTATE -->'),
  html.indexOf('<!-- SUMMARY (placeholder) -->')
);

console.log('===== v113-3-50 real estate area price rent estimate lite smoke =====');

assert.strictEqual(pkg.version, '113.3.50', 'package version must be 113.3.50');
assert.ok(pkg.scripts['smoke:v113-3-50'], 'smoke:v113-3-50 script must exist');

assert.ok(html.includes('エリア選択 価格・賃料推定 Lite'), 'must expose area estimate section');
assert.ok(html.includes('さいたま市大宮区 桜木町'), 'must include 桜木町 area');
assert.ok(html.includes('さいたま市大宮区 大門町'), 'must include 大門町 area');
assert.ok(html.includes('さいたま市大宮区 吉敷町'), 'must include 吉敷町 area');
assert.ok(html.includes('さいたま市中央区 新都心'), 'must include 新都心 area');
assert.ok(html.includes('さいたま市北区 土呂町'), 'must include 土呂町 area');
assert.ok(html.includes('最寄駅'), 'must include station input');
assert.ok(html.includes('駅徒歩'), 'must include walk input');
assert.ok(html.includes('築年数'), 'must include age input');
assert.ok(html.includes('面積'), 'must include size input');
assert.ok(html.includes('物件種別'), 'must include property type input');
assert.ok(html.includes('間取り'), 'must include room input');
assert.ok(html.includes('売買 / 賃貸 / 両方'), 'must include mode input');
assert.ok(html.includes('推定成約価格'), 'must include sale estimate');
assert.ok(html.includes('参考月額賃料'), 'must include rent estimate');
assert.ok(html.includes('賃料レンジ / 年間賃料'), 'must include rent range and annual rent');
assert.ok(html.includes('表面利回り'), 'must include yield estimate');
assert.ok(html.includes('国交省データだけでは現在募集家賃の網羅は難しい'), 'must warn about rent data coverage limits');
assert.ok(html.includes('地図クリック時は町名 / 町丁目を判定して同じ推定ロジックへ流します'), 'must describe map-click to area logic');
assert.ok(html.includes('Google Maps を使う場合は'), 'must mention Google Maps design note');
assert.ok(html.includes('Leaflet + 国土地理院タイル'), 'must mention GSI tile design note');
assert.ok(html.includes('API key は Secret Manager または <code>.env</code> 側に閉じます'), 'must keep API key outside browser');
assert.ok(html.includes('Browserから API key は直打ちしません') || html.includes('ブラウザから API key は直打ちしません'), 'must warn about browser API keys');
assert.ok(html.includes('/api/fk-omiya/realestate/cases'), 'must preserve future server endpoint path');
assert.ok(html.includes('data-estimated-rent=""'), 'must expose rent dataset attribute');
assert.ok(html.includes('data-estimated-yield=""'), 'must expose yield dataset attribute');
assert.ok(html.includes('data-area-key=""'), 'must expose area key dataset attribute');
assert.ok(html.includes('fkOmiyaSelectedAreaPrice'), 'must persist area sale key');
assert.ok(html.includes('fkOmiyaSelectedAreaRent'), 'must persist area rent key');
assert.ok(html.includes('fkOmiyaSelectedAreaYield'), 'must persist area yield key');
assert.ok(html.includes('selectRealestateArea'), 'must define area select handler');
assert.ok(html.includes('applyRealestateAreaEstimateToMortgage'), 'must define area mortgage handoff');
assert.ok(html.includes('localStorage.setItem(RE_AREA_PRICE_LS_KEY'), 'must save area sale estimate to localStorage');
assert.ok(html.includes('localStorage.setItem(RE_AREA_RENT_LS_KEY'), 'must save area rent estimate to localStorage');
assert.ok(html.includes('localStorage.setItem(RE_AREA_YIELD_LS_KEY'), 'must save area yield estimate to localStorage');

assert.ok(!realestateSection.includes('google.maps.'), 'must not use live Google Maps API');
assert.ok(!realestateSection.includes('cyberjapandata.gsi.go.jp'), 'must not use live GSI tile endpoint');
assert.ok(!realestateSection.includes('tile.gsi.go.jp'), 'must not use live GSI tile endpoint');
assert.ok(!realestateSection.includes('fetch('), 'must not perform direct external fetch in real estate section');

assert.ok(html.includes('地図クリック価格推定 Lite'), 'must preserve v113.3.49 map click UI');
assert.ok(html.includes('FK Omiya Real Estate Pricing Score Lite'), 'must preserve v113.3.48 price score lite');

console.log('PASS: v113.3.50 area price rent estimate lite UI and wiring checks');
