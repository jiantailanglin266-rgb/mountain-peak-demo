// 登山家マニフェスト生成: 厳選リスト + ja.wikipedia カテゴリ自動収集 → tools/climbers-manifest.json（目標~300名）
// 実行: node tools/climbers-manifest.mjs
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { WORLD_CLIMBERS } from "./gen/climbers-world.mjs";
import { JP_CLIMBERS } from "./gen/climbers-jp.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "User-Agent": "MountainPeakDemoBot/1.0 (contact: jiantailanglin266@gmail.com)" };
const TARGET = 300;

const CATS = [
  ["Category:日本の登山家", "jp"],
  ["Category:イタリアの登山家", "it"],
  ["Category:フランスの登山家", "fr"],
  ["Category:イギリスの登山家", "gb"],
  ["Category:ドイツの登山家", "de"],
  ["Category:スイスの登山家", "ch"],
  ["Category:オーストリアの登山家", "at"],
  ["Category:ポーランドの登山家", "pl"],
  ["Category:アメリカ合衆国の登山家", "us"],
  ["Category:ネパールの登山家", "np"],
  ["Category:韓国の登山家", "kr"],
  ["Category:スペインの登山家", "es"],
  ["Category:ロシアの登山家", "ru"],
  ["Category:中国の登山家", "cn"],
  ["Category:インドの登山家", "in"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function categoryMembers(cat) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(cat)}&cmlimit=200&cmnamespace=0&format=json&origin=*`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.query?.categorymembers || []).map((m) => m.title);
}

const entries = [];
const seenJa = new Set();
const seenEn = new Set();
let seq = 0;
function push(nameJa, nameEn, wikiJa, wikiEn, nat, tags, featured, auto) {
  if (wikiJa && seenJa.has(wikiJa)) return;
  if (wikiEn && seenEn.has(wikiEn)) return;
  if (wikiJa) seenJa.add(wikiJa);
  if (wikiEn) seenEn.add(wikiEn);
  seq++;
  entries.push({ id: "cl_" + String(seq).padStart(3, "0"), nameJa, nameEn, wikiJa, wikiEn, nat, tags, featured: !!featured, auto: !!auto });
}

for (const [nameJa, nameEn, wikiJa, wikiEn, nat, tags, feat] of WORLD_CLIMBERS) push(nameJa, nameEn, wikiJa, wikiEn, nat, tags, feat, false);
for (const [nameJa, nameEn, wikiJa, wikiEn, nat, tags, feat] of JP_CLIMBERS) push(nameJa, nameEn, wikiJa, wikiEn, nat, tags, feat, false);
console.log("curated: " + entries.length);

// カテゴリから不足分を自動補充
outer: for (const [cat, nat] of CATS) {
  if (entries.length >= TARGET) break;
  await sleep(1500);
  let titles = [];
  try { titles = await categoryMembers(cat); } catch (e) { console.log("cat fail: " + cat); continue; }
  for (const t of titles) {
    if (entries.length >= TARGET) break outer;
    if (/一覧|Category|Template|遭難|事故|山岳会|クラブ|隊$/.test(t)) continue;
    const nameJa = t.replace(/\s*\(.*?\)$/, "").replace(/\s*（.*?）$/, "");
    push(nameJa, "", t, null, nat, [], false, true);
  }
  console.log(cat + " -> total " + entries.length);
}

writeFileSync(join(ROOT, "tools", "climbers-manifest.json"), JSON.stringify({ entries }, null, 1), "utf-8");
console.log("manifest: " + entries.length + " climbers");
