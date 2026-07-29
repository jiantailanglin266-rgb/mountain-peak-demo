// 楽天ウェブサービス Ichiba Item Search API（2026新基盤）で装備商品を取得し、
// index.html の AF_RAKU_AUTO ブロックを書き換える（各商品に楽天のアフィリリンクが付く）。
//
// 新基盤の要点（2026/2 リニューアル）:
//  - エンドポイント: https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401
//  - applicationId(UUID) + accessKey + affiliateId をクエリパラメータで渡す
//  - 「許可Webサイト」に登録したドメインと一致する Origin / Referer ヘッダーが必須（403 REFERRER対策）
//  - Node標準の fetch は Origin/Referer が禁止ヘッダーで送れないため https モジュールを使う
//
// 実行(PowerShell):
//   $env:RAKUTEN_APP_ID="xxxxxxxx-...";  $env:RAKUTEN_ACCESS_KEY="pk_xxxx";
//   $env:RAKUTEN_AFFILIATE_ID="xxxx.xxxx.xxxx.xxxx";  node tools/fetch-rakuten.mjs
//   （REFERERを変えたい場合のみ $env:RAKUTEN_REFERER="https://mountain-peak.jp/"）
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_ID = process.env.RAKUTEN_APP_ID;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID;
// 楽天Developersの「許可されたWebサイト」に登録したドメインと一致必須
const REFERER = process.env.RAKUTEN_REFERER || "https://mountain-peak.jp/";
if (!APP_ID || !ACCESS_KEY || !AFF_ID) {
  console.error("環境変数 RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY / RAKUTEN_AFFILIATE_ID を設定してください");
  process.exit(1);
}
const ORIGIN = (REFERER.match(/^https?:\/\/[^/]+/) || ["https://mountain-peak.jp"])[0];

const HOST = "openapi.rakuten.co.jp";
const PATH = "/ichibams/api/IchibaItem/Search/20260401";

function apiGet(params) {
  const qs = new URLSearchParams(Object.assign(
    { applicationId: APP_ID, accessKey: ACCESS_KEY, affiliateId: AFF_ID, format: "json", formatVersion: "2" },
    params
  )).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: HOST, path: PATH + "?" + qs, method: "GET",
        headers: { Origin: ORIGIN, Referer: REFERER, "User-Agent": "Mozilla/5.0 MountainPeakGearBot/1.0" } },
      (resp) => { let d = ""; resp.on("data", (c) => (d += c)); resp.on("end", () => {
        try { resolve({ status: resp.statusCode, json: JSON.parse(d) }); }
        catch { resolve({ status: resp.statusCode, json: null, raw: d }); }
      }); });
    req.on("error", reject);
    req.end();
  });
}

// cat = AF_GEARカテゴリ(eb) / lv = 難易度ゲート / q = 検索語 / e = 英語ラベル / ic = 絵文字
// 手動AF_RAKU（レインウェア/シューズ/グローブ/ポール/ハイドレ/ゲイター）で未カバーの装備を補完
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

const shorten = (s) => ((s.split(/[【\[]/)[0].trim() || s).slice(0, 34));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = [];
for (const k of KEYWORDS) {
  try {
    const { status, json, raw } = await apiGet({ keyword: k.q, hits: "5", imageFlag: "1", sort: "-reviewCount", availability: "1" });
    if (status !== 200 || !json) { console.error(k.q + " HTTP" + status + " " + (json ? JSON.stringify(json.errors || json).slice(0, 120) : (raw || "").slice(0, 120))); await sleep(1200); continue; }
    const items = json.Items || [];
    const it = items.find((x) => x.affiliateUrl && (x.mediumImageUrls || [])[0]);
    if (!it) { console.error("該当なし: " + k.q); await sleep(1200); continue; }
    const raw0 = typeof it.mediumImageUrls[0] === "string" ? it.mediumImageUrls[0] : it.mediumImageUrls[0].imageUrl;
    const img = raw0.replace(/\?_ex=\d+x\d+$/, "") + "?_ex=240x240";
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
  await sleep(1200); // レート制限対策(約1req/sec)
}

if (!out.length) { console.error("1件も取得できず — 既存ブロックを保持"); process.exit(1); }

const file = join(ROOT, "index.html");
const src = readFileSync(file, "utf-8");
const re = /var AF_RAKU_AUTO=[\s\S]*?\/\*END_AF_RAKU_AUTO\*\//;
if (!re.test(src)) throw new Error("AF_RAKU_AUTO ブロックが index.html に見つかりません");
writeFileSync(file, src.replace(re, "var AF_RAKU_AUTO=" + JSON.stringify(out) + "; /*END_AF_RAKU_AUTO*/"), "utf-8");
console.log("AF_RAKU_AUTO を更新: " + out.length + "点（この後 node build.mjs → デプロイ）");
