// データ拡充ジェネレータ: index.html内の既存DATA + 追加テーブル(jp/world/geo/batch1) → data.js を生成
// 実行: node tools/expand-data.mjs
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { NEW_COUNTRIES, NEW_REGIONS } from "./gen/geo.mjs";
import { JP } from "./gen/jp.mjs";
import { WORLD } from "./gen/world.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-07-06T12:00:00.000Z";

const src = readFileSync(join(ROOT, "index.html"), "utf-8");
const m = src.match(/^var DATA=(.*);$/m) || src.match(/^var DATA = (.*);$/m);
let DATA;
if (m) {
  DATA = JSON.parse(m[1]);
} else {
  DATA = JSON.parse(readFileSync(join(ROOT, "data.js"), "utf-8").match(/^var DATA=(.*);$/m)[1]);
}

const batch1 = JSON.parse(readFileSync(join(ROOT, "tools", "gen", "batch1.json"), "utf-8"));

const slugSet = new Set(DATA.mountains.map((x) => x.slug));
const idSet = new Set(DATA.mountains.map((x) => x.id));
function assertNew(slug, id) {
  if (slugSet.has(slug)) throw new Error("dup slug: " + slug);
  if (idSet.has(id)) throw new Error("dup id: " + id);
  slugSet.add(slug); idSet.add(id);
}

// --- 国・山域 ---
for (const [id, iso, slug, continent, ja, en, sja, sen] of NEW_COUNTRIES) {
  if (DATA.countries.find((c) => c.id === id)) continue;
  DATA.countries.push({ id, isoCode: iso, slug, continent, names: { ja, en }, summaries: { ja: sja, en: sen } });
}
for (const r of batch1.regions) {
  if (!DATA.regions.find((x) => x.id === r.id)) DATA.regions.push(r);
}
for (const [id, slug, countryId, ja, en, sja, sen] of NEW_REGIONS) {
  if (DATA.regions.find((x) => x.id === id)) continue;
  DATA.regions.push({ id, slug, countryId, names: { ja, en }, summaries: { ja: sja, en: sen } });
}

// --- batch1 の山（レビュー用下書き → 公開。reviewedフラグは false のまま保持） ---
for (const mt of batch1.mountains) {
  assertNew(mt.slug, mt.id);
  mt.status = "published";
  for (const loc of Object.keys(mt.translations)) delete mt.translations[loc]._review_note;
  DATA.mountains.push(mt);
}

// --- 追加テーブル（要約のみのカタログ級。安全記述(hazards等)は捏造せず空欄） ---
function catalogEntry({ slug, nameJa, reading, nameEn, localName, elev, lat, lng, country, region, diff, seasons, tags, sja, sen }) {
  const id = "mt_" + slug.replace(/-/g, "_");
  assertNew(slug, id);
  const empty = { features: "", history: "", access: "", equipment: "", hazards: "", reviewed: false };
  return {
    id, slug, elevationM: elev, lat, lng, countryId: country, regionId: region,
    difficultyLevel: diff, bestSeasons: seasons, tags, status: "published", updatedAt: NOW,
    translations: {
      ja: { name: nameJa, localName: localName || (reading ? nameJa + "（" + reading + "）" : undefined), summary: sja, ...empty },
      en: { name: nameEn, localName: localName || undefined, summary: sen, ...empty },
    },
  };
}
for (const [slug, nameJa, reading, nameEn, elev, lat, lng, region, diff, seasons, extraTags, sja, sen] of JP) {
  DATA.mountains.push(catalogEntry({ slug, nameJa, reading, nameEn, elev, lat, lng, country: "c_jp", region, diff, seasons, tags: ["hyakumeizan", ...extraTags], sja, sen }));
}
for (const [slug, nameJa, nameEn, localName, elev, lat, lng, country, region, diff, seasons, tags, sja, sen] of WORLD) {
  DATA.mountains.push(catalogEntry({ slug, nameJa, reading: null, nameEn, localName, elev, lat, lng, country, region, diff, seasons, tags, sja, sen }));
}

// --- ランキング更新 ---
const byElev = (a, b) => b.elevationM - a.elevationM;
const hyaku = DATA.mountains.filter((x) => x.tags.includes("hyakumeizan")).sort(byElev);
const r8000 = DATA.mountains.filter((x) => x.tags.includes("8000m")).sort(byElev);
if (hyaku.length !== 100) throw new Error("hyakumeizan != 100: " + hyaku.length);
if (r8000.length !== 14) throw new Error("8000m != 14: " + r8000.length);
const rankH = DATA.rankings.find((r) => r.slug === "hyakumeizan");
rankH.mountainIds = hyaku.map((x) => x.id);
rankH.descriptions = {
  ja: "深田久弥『日本百名山』に基づく日本を代表する100座。全100座を収録しています。",
  en: "The 100 celebrated peaks selected by Kyuya Fukada — the complete list.",
};
const rank8 = DATA.rankings.find((r) => r.slug === "8000m-peaks");
rank8.mountainIds = r8000.map((x) => x.id);
rank8.descriptions = {
  ja: "地球上に14座しかない標高8000mを超える高峰。全14座を収録しています。",
  en: "All fourteen peaks on Earth above 8,000m — the complete list.",
};

// --- 検証 ---
for (const mt of DATA.mountains) {
  if (!DATA.countries.find((c) => c.id === mt.countryId)) throw new Error("bad country: " + mt.slug + " " + mt.countryId);
  if (!DATA.regions.find((r) => r.id === mt.regionId)) throw new Error("bad region: " + mt.slug + " " + mt.regionId);
  if (!(mt.lat >= -90 && mt.lat <= 90 && mt.lng >= -180 && mt.lng <= 180)) throw new Error("bad coords: " + mt.slug);
}

writeFileSync(join(ROOT, "data.js"), "var DATA=" + JSON.stringify(DATA) + ";\n", "utf-8");
console.log(`mountains=${DATA.mountains.length} (jp=${DATA.mountains.filter((x) => x.countryId === "c_jp").length}, hyakumeizan=${hyaku.length}, 8000m=${r8000.length}) countries=${DATA.countries.length} regions=${DATA.regions.length}`);
