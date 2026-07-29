// 楽天ウェブサービス Ichiba Item Search API で装備商品を取得し、
// index.html の AF_RAKU_AUTO ブロックを書き換える（各商品に楽天のアフィリリンクが付く）。
// 実行:  RAKUTEN_APP_ID=xxxx RAKUTEN_AFFILIATE_ID=yyyy node tools/fetch-rakuten.mjs
//   Windows PowerShell:  $env:RAKUTEN_APP_ID="xxxx"; $env:RAKUTEN_AFFILIATE_ID="yyyy"; node tools/fetch-rakuten.mjs
// 方針: 手動AF_RAKUで未カバーの装備だけをAPIで補完。レビュー数の多い定番を1点/キーワード。
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_ID = process.env.RAKUTEN_APP_ID;
const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID;
if (!APP_ID || !AFF_ID) {
  console.error("環境変数 RAKUTEN_APP_ID と RAKUTEN_AFFILIATE_ID を設定してください");
  process.exit(1);
}

// cat = AF_GEARカテゴリ(eb) / lv = 難易度ゲート(山詳細ボックス用) / q = 検索語 / e = 英語ラベル / ic = 絵文字
const KEYWORDS = [
  { cat: "BIG THREE",   lv: 1, ic: "🎒", q: "登山 ザック 30L",               e: "Backpack (20–35L)" },
  { cat: "LAYERING",    lv: 1, ic: "👕", q: "登山 ベースレイヤー メリノウール", e: "Base Layer (merino)" },
  { cat: "LAYERING",    lv: 1, ic: "🧥", q: "登山 フリース ミドルレイヤー",     e: "Fleece / Midlayer" },
  { cat: "LAYERING",    lv: 2, ic: "🪶", q: "登山 ダウンジャケット 軽量",       e: "Insulated Jacket" },
  { cat: "SAFETY",      lv: 1, ic: "🔦", q: "登山 ヘッドランプ 防水",           e: "Headlamp" },
  { cat: "SAFETY",      lv: 1, ic: "🩹", q: "ファーストエイドキット 登山",       e: "First Aid Kit" },
  { cat: "SAFETY",      lv: 1, ic: "🔋", q: "モバイルバッテリー 10000mAh 軽量",  e: "Power Bank" },
  { cat: "NAVIGATION",  lv: 2, ic: "⌚", q: "GPSウォッチ 登山",                e: "GPS Watch" },
  { cat: "ACCESSORIES", lv: 2, ic: "🕶", q: "登山 サングラス UVカット",         e: "Sunglasses" },
  { cat: "ADVANCED",    lv: 3, ic: "⛺", q: "登山 テント 軽量 ソロ",           e: "Tent (solo)" },
  { cat: "ADVANCED",    lv: 3, ic: "🛌", q: "シュラフ 登山 3シーズン",          e: "Sleeping Bag" },
];

const API = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";
const shorten = (s) => ((s.split(/[【\[]/)[0].trim() || s).slice(0, 34));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = [];
for (const k of KEYWORDS) {
  const u = new URL(API);
  u.searchParams.set("applicationId", APP_ID);
  u.searchParams.set("affiliateId", AFF_ID);
  u.searchParams.set("keyword", k.q);
  u.searchParams.set("hits", "5");
  u.searchParams.set("sort", "-reviewCount"); // レビュー数の多い順＝定番
  u.searchParams.set("imageFlag", "1");       // 画像あり商品のみ
  u.searchParams.set("availability", "1");     // 在庫あり
  u.searchParams.set("format", "json");
  u.searchParams.set("formatVersion", "2");
  try {
    const res = await fetch(u, { headers: { "User-Agent": "MountainPeakGearBot/1.0" } });
    if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 200));
    const data = await res.json();
    const items = data.Items || [];
    const it = items.find((x) => x.affiliateUrl && (x.mediumImageUrls || [])[0]);
    if (!it) { console.error("該当なし: " + k.q); continue; }
    const raw = typeof it.mediumImageUrls[0] === "string" ? it.mediumImageUrls[0] : it.mediumImageUrls[0].imageUrl;
    const img = raw.replace(/\?_ex=\d+x\d+$/, "") + "?_ex=240x240";
    out.push({
      id: "rk_" + k.q.replace(/\s+/g, "_"),
      cat: k.cat, lv: k.lv, ic: k.ic,
      j: shorten(it.itemName), e: k.e,
      p: Number(it.itemPrice).toLocaleString() + "円",
      img, url: it.affiliateUrl,
    });
    console.log("ok: " + k.q + " → " + shorten(it.itemName) + " (" + Number(it.itemPrice).toLocaleString() + "円)");
  } catch (e) {
    console.error(k.q + " 失敗: " + e.message);
  }
  await sleep(1100); // 楽天APIのレート制限(約1req/sec)対策
}

if (!out.length) { console.error("1件も取得できず — 既存ブロックを保持"); process.exit(1); }

const file = join(ROOT, "index.html");
const src = readFileSync(file, "utf-8");
const re = /var AF_RAKU_AUTO=[\s\S]*?\/\*END_AF_RAKU_AUTO\*\//;
if (!re.test(src)) throw new Error("AF_RAKU_AUTO ブロックが index.html に見つかりません");
writeFileSync(file, src.replace(re, "var AF_RAKU_AUTO=" + JSON.stringify(out) + "; /*END_AF_RAKU_AUTO*/"), "utf-8");
console.log("AF_RAKU_AUTO を更新: " + out.length + "点（この後 node build.mjs → デプロイ）");
