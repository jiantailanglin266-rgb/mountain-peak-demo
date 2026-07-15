// Wikidata取得データ（wikidata-mountains.json）を data.js に統合して約2000山へ拡張する
// 実行: node tools/import-wikidata.mjs <wikidata-mountains.json>
// 方針: 事実データ（名称/標高/座標/国）のみ収録。難易度=0（未評価）・シーズン/危険箇所は
//       空欄のまま=捏造しない。cat:1 フラグでカタログ級と明示（SSG個別ページは生成しない）
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-07-16T12:00:00.000Z";
const CAP_JP = 1100;    // 日本の追加上限（標高降順で採用）
const CAP_TOTAL = 2000; // 全体目標

const src = process.argv[2];
if (!src) { console.error("usage: node tools/import-wikidata.mjs <json>"); process.exit(1); }
const W = JSON.parse(readFileSync(src, "utf-8"));
const DATA = JSON.parse(readFileSync(join(ROOT, "data.js"), "utf-8").match(/^var DATA=(.*);$/m)[1]);

// 既存カタログ（wd_）は一旦除去して再構築（冪等）
DATA.mountains = DATA.mountains.filter((m) => !m.cat);
DATA.regions = DATA.regions.filter((r) => !/^r_wd_/.test(r.id));

const isoToCountry = {};
for (const c of DATA.countries) isoToCountry[(c.isoCode || "").toUpperCase()] = c;

const slugSet = new Set(DATA.mountains.map((m) => m.slug));
const idSet = new Set(DATA.mountains.map((m) => m.id));
const nameJaSet = new Set(); const nameEnSet = new Set();
const coordList = [];
for (const m of DATA.mountains) {
  for (const loc of ["ja", "en"]) {
    const t = m.translations[loc];
    if (!t) continue;
    const n = t.name.toLowerCase();
    (loc === "ja" ? nameJaSet : nameEnSet).add(n);
    // 「水晶岳（黒岳）」→「水晶岳」のような括弧付き表記も照合対象に
    const stripped = n.replace(/（.*?）|\(.*?\)/g, "").trim();
    if (stripped && stripped !== n) (loc === "ja" ? nameJaSet : nameEnSet).add(stripped);
  }
  coordList.push([m.lat, m.lng, m.elevationM]);
}
// 同一峰判定: 近接+標高類似、または少し広い範囲+標高ほぼ一致（座標精度ずれ対策）
const nearExisting = (lat, lon, elev) =>
  coordList.some(([a, b, e]) =>
    (Math.abs(a - lat) < 0.03 && Math.abs(b - lon) < 0.03 && Math.abs(e - elev) < 400) ||
    (Math.abs(a - lat) < 0.08 && Math.abs(b - lon) < 0.08 && Math.abs(e - elev) < 60));

const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/['’.()]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function regionFor(c) {
  const rid = "r_wd_" + c.isoCode.toLowerCase();
  if (!DATA.regions.find((r) => r.id === rid)) {
    DATA.regions.push({ id: rid, slug: "more-" + c.isoCode.toLowerCase(), countryId: c.id,
      names: { ja: c.names.ja + "のその他の山", en: "More mountains in " + c.names.en },
      summaries: { ja: c.names.ja + "の山のうち、個別の山域分類が未整理のものをまとめています（Wikidata/Wikipedia由来の基礎データ）。",
                   en: "Peaks in " + c.names.en + " not yet assigned to a specific range (base data from Wikidata/Wikipedia)." } });
  }
  return rid;
}

function makeEntry(r, c) {
  const enName = r.en || r.ja;
  const jaName = r.ja || r.en;
  let slug = slugify(r.en) || ("jp-" + r.qid.toLowerCase());
  if (slugSet.has(slug)) slug = slug + "-" + r.qid.toLowerCase();
  if (slugSet.has(slug)) return null;
  const id = "wd_" + r.qid.toLowerCase();
  if (idSet.has(id)) return null;
  slugSet.add(slug); idSet.add(id);
  const sja = c.names.ja + "にある標高" + r.elev.toLocaleString() + "mの山。基礎データ（名称・標高・座標）を収録しています。";
  const sen = "A " + r.elev.toLocaleString() + " m peak in " + c.names.en + ". Base data (name, elevation, coordinates) only for now.";
  return { id, slug, elevationM: r.elev, lat: +r.lat.toFixed(4), lng: +r.lon.toFixed(4),
    countryId: c.id, regionId: regionFor(c), difficultyLevel: 0, bestSeasons: [], tags: [],
    status: "published", cat: 1, updatedAt: NOW,
    translations: { ja: { name: jaName, summary: sja }, en: { name: enName, summary: sen } } };
}

function usable(r) {
  if (!(r.lat >= -90 && r.lat <= 90 && r.lon >= -180 && r.lon <= 180)) return false;
  if (!(r.elev >= 300 && r.elev < 9000)) return false;
  const c = isoToCountry[(r.iso || "").toUpperCase()];
  if (!c) return false;
  if (nearExisting(r.lat, r.lon, r.elev)) return false;
  if (r.ja && nameJaSet.has(r.ja.toLowerCase())) return false;
  if (r.en && nameEnSet.has(r.en.toLowerCase())) return false;
  return true;
}

// 取得データ内の重複（QID/名前+近接座標）を除去
function dedupeFetched(rows) {
  const seenQ = new Set(); const out = []; const pts = [];
  for (const r of rows) {
    if (seenQ.has(r.qid)) continue; seenQ.add(r.qid);
    if (pts.some(([a, b, e]) => Math.abs(a - r.lat) < 0.005 && Math.abs(b - r.lon) < 0.005 && Math.abs(e - r.elev) < 100)) continue;
    pts.push([r.lat, r.lon, r.elev]); out.push(r);
  }
  return out;
}

let added = 0, skipped = 0;
const jp = dedupeFetched(W.jp).filter(usable).sort((a, b) => b.elev - a.elev).slice(0, CAP_JP);
for (const r of jp) {
  const e = makeEntry(r, isoToCountry.JP);
  if (e) { DATA.mountains.push(e); coordList.push([e.lat, e.lng, e.elevationM]); added++; } else skipped++;
}
const room = CAP_TOTAL - DATA.mountains.length;
const world = dedupeFetched(W.world).filter(usable).sort((a, b) => b.elev - a.elev).slice(0, Math.max(0, room));
for (const r of world) {
  const c = isoToCountry[r.iso.toUpperCase()];
  const e = makeEntry(r, c);
  if (e) { DATA.mountains.push(e); coordList.push([e.lat, e.lng, e.elevationM]); added++; } else skipped++;
}

// 検証
for (const m of DATA.mountains) {
  if (!DATA.countries.find((c) => c.id === m.countryId)) throw new Error("bad country " + m.slug);
  if (!DATA.regions.find((r) => r.id === m.regionId)) throw new Error("bad region " + m.slug);
}

writeFileSync(join(ROOT, "data.js"), "var DATA=" + JSON.stringify(DATA) + ";\n", "utf-8");
const jpN = DATA.mountains.filter((m) => m.countryId === "c_jp").length;
console.log(`total=${DATA.mountains.length} (jp=${jpN}) added=${added} skippedDup=${skipped} regions=${DATA.regions.length} sizeKB=${Math.round(JSON.stringify(DATA).length / 1024)}`);
