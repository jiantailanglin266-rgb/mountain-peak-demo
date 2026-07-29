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

// cat = AF_GEARカテゴリ(eb) / lv = 難易度ゲート / q = 検索語 / e = 英語ラベル / ic = 絵文字 / take = 取得点数
// 全カテゴリに分散して合計約150点。1キーワードから複数点を取得（重複はitemCodeで除去）
const TAKE_DEFAULT = 3;
const KEYWORDS = [
  // ===== BIG THREE（登山靴・ザック・レインウェア）約25 =====
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "登山靴 メンズ ミッドカット",        e: "Hiking Boots (men)" },
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "登山靴 レディース",                e: "Hiking Boots (women)" },
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "トレッキングシューズ ローカット 防水", e: "Trail Shoes (low-cut)" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "登山 ザック 30L",                  e: "Backpack (~30L)" },
  { cat: "BIG THREE", lv: 2, ic: "🎒", q: "登山 ザック 50L 縦走",             e: "Backpack (~50L)" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "ザック レディース 登山",            e: "Backpack (women)" },
  { cat: "BIG THREE", lv: 1, ic: "🌧", q: "レインウェア 上下 ゴアテックス メンズ", e: "Rain Shell Set (men)" },
  { cat: "BIG THREE", lv: 1, ic: "🌧", q: "レインウェア レディース 登山 上下",  e: "Rain Shell Set (women)" },
  { cat: "BIG THREE", lv: 1, ic: "☔", q: "ザックカバー 防水 登山", take: 2,   e: "Pack Cover" },
  // ===== LAYERING（ウェア・レイヤリング）約25 =====
  { cat: "LAYERING", lv: 1, ic: "👕", q: "登山 ベースレイヤー メリノウール",    e: "Base Layer (merino)" },
  { cat: "LAYERING", lv: 1, ic: "👕", q: "登山 ベースレイヤー 化繊 半袖",       e: "Base Layer (synthetic)" },
  { cat: "LAYERING", lv: 1, ic: "🧥", q: "登山 フリース ジャケット",           e: "Fleece Jacket" },
  { cat: "LAYERING", lv: 2, ic: "🪶", q: "登山 ダウンジャケット 軽量",         e: "Down Jacket" },
  { cat: "LAYERING", lv: 2, ic: "🪶", q: "化繊 インサレーション ジャケット 登山", take: 2, e: "Synthetic Insulation" },
  { cat: "LAYERING", lv: 1, ic: "👖", q: "トレッキングパンツ メンズ",          e: "Trekking Pants (men)" },
  { cat: "LAYERING", lv: 1, ic: "👖", q: "トレッキングパンツ レディース",       e: "Trekking Pants (women)" },
  { cat: "LAYERING", lv: 2, ic: "🩳", q: "登山 タイツ サポート", take: 2,     e: "Support Tights" },
  { cat: "LAYERING", lv: 1, ic: "🧦", q: "登山 靴下 メリノウール",            e: "Hiking Socks (merino)" },
  // ===== SAFETY（安全装備）約25 =====
  { cat: "SAFETY", lv: 1, ic: "🔦", q: "登山 ヘッドランプ 充電式",            e: "Headlamp" },
  { cat: "SAFETY", lv: 1, ic: "🩹", q: "ファーストエイドキット 登山",          e: "First Aid Kit" },
  { cat: "SAFETY", lv: 1, ic: "🛟", q: "エマージェンシーシート サバイバル", take: 2, e: "Emergency Blanket" },
  { cat: "SAFETY", lv: 3, ic: "⛑", q: "登山 ヘルメット クライミング",         e: "Climbing Helmet" },
  { cat: "SAFETY", lv: 1, ic: "🔋", q: "モバイルバッテリー 10000mAh 軽量",     e: "Power Bank" },
  { cat: "SAFETY", lv: 2, ic: "🔔", q: "熊鈴 登山", take: 2,                 e: "Bear Bell" },
  { cat: "SAFETY", lv: 3, ic: "🐻", q: "熊除けスプレー", take: 2,            e: "Bear Spray" },
  { cat: "SAFETY", lv: 1, ic: "📣", q: "ホイッスル 防災 登山", take: 2,       e: "Whistle" },
  { cat: "SAFETY", lv: 2, ic: "🔥", q: "ライター 防水 ファイヤースターター", take: 2, e: "Fire Starter" },
  // ===== NAVIGATION（ナビゲーション）約16 =====
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "GPSウォッチ 登山",                e: "GPS Watch" },
  { cat: "NAVIGATION", lv: 1, ic: "🧭", q: "コンパス 登山 オイル式",           e: "Compass" },
  { cat: "NAVIGATION", lv: 1, ic: "🗺", q: "山と高原地図", take: 2,          e: "Hiking Map" },
  { cat: "NAVIGATION", lv: 1, ic: "🗺", q: "地図ケース 登山 防水", take: 2,   e: "Map Case" },
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "高度計 腕時計 気圧",              e: "Altimeter Watch" },
  { cat: "NAVIGATION", lv: 2, ic: "🧭", q: "サイティングコンパス 登山", take: 2, e: "Sighting Compass" },
  // ===== ACCESSORIES（小物・行動用品）約30 =====
  { cat: "ACCESSORIES", lv: 1, ic: "🥢", q: "トレッキングポール カーボン",      e: "Poles (carbon)" },
  { cat: "ACCESSORIES", lv: 1, ic: "🥢", q: "トレッキングポール アルミ 軽量",   e: "Poles (aluminum)" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧤", q: "登山 グローブ 夏 速乾",          e: "Gloves (summer)" },
  { cat: "ACCESSORIES", lv: 2, ic: "🧤", q: "登山 グローブ 防寒 冬", take: 2, e: "Gloves (winter)" },
  { cat: "ACCESSORIES", lv: 2, ic: "🕶", q: "登山 サングラス 偏光",           e: "Sunglasses" },
  { cat: "ACCESSORIES", lv: 1, ic: "💧", q: "ハイドレーション 2L 登山",        e: "Hydration Pack" },
  { cat: "ACCESSORIES", lv: 1, ic: "🍶", q: "山専用ボトル 保温 山専", take: 2, e: "Insulated Bottle" },
  { cat: "ACCESSORIES", lv: 2, ic: "🦿", q: "ゲイター 登山 スパッツ", take: 2, e: "Gaiters" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧢", q: "登山 帽子 ハット つば広",         e: "Hat" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧣", q: "ネックゲイター 登山", take: 2,   e: "Neck Gaiter" },
  { cat: "ACCESSORIES", lv: 1, ic: "🪑", q: "折りたたみ 座布団 登山", take: 2, e: "Sit Pad" },
  { cat: "ACCESSORIES", lv: 1, ic: "👜", q: "サコッシュ 登山", take: 2,      e: "Sacoche" },
  // ===== ADVANCED（テント泊・雪山装備）約30 =====
  { cat: "ADVANCED", lv: 3, ic: "⛺", q: "登山 テント 軽量 ソロ",            e: "Tent (solo)" },
  { cat: "ADVANCED", lv: 3, ic: "⛺", q: "登山 テント 2人用", take: 2,      e: "Tent (2p)" },
  { cat: "ADVANCED", lv: 3, ic: "🛌", q: "シュラフ 3シーズン 登山",          e: "Sleeping Bag (3-season)" },
  { cat: "ADVANCED", lv: 4, ic: "🛌", q: "シュラフ 冬用 ダウン", take: 2,    e: "Sleeping Bag (winter)" },
  { cat: "ADVANCED", lv: 3, ic: "🛏", q: "スリーピングマット 登山",           e: "Sleeping Pad" },
  { cat: "ADVANCED", lv: 3, ic: "🔥", q: "シングルバーナー 登山",            e: "Stove" },
  { cat: "ADVANCED", lv: 3, ic: "🍳", q: "クッカー セット 登山", take: 2,    e: "Cookset" },
  { cat: "ADVANCED", lv: 4, ic: "🧗", q: "アイゼン 12本爪",                 e: "Crampons (12-pt)" },
  { cat: "ADVANCED", lv: 3, ic: "🥾", q: "チェーンスパイク 軽アイゼン",        e: "Chain Spikes" },
  { cat: "ADVANCED", lv: 4, ic: "⛏", q: "ピッケル 登山", take: 2,          e: "Ice Axe" },
  { cat: "ADVANCED", lv: 3, ic: "❄", q: "スノーシュー", take: 2,           e: "Snowshoes" },
  { cat: "ADVANCED", lv: 3, ic: "🧴", q: "OD缶 ガス カートリッジ", take: 2,  e: "Gas Canister" },
];

const shorten = (s) => ((s.split(/[【\[]/)[0].trim() || s).slice(0, 34));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = [];
const seen = new Set(); // itemCode で全体重複除去
for (const k of KEYWORDS) {
  const take = k.take || TAKE_DEFAULT;
  try {
    const { status, json, raw } = await apiGet({ keyword: k.q, hits: String(Math.min(30, take + 6)), imageFlag: "1", sort: "-reviewCount", availability: "1" });
    if (status !== 200 || !json) { console.error(k.q + " HTTP" + status + " " + (json ? JSON.stringify(json.errors || json).slice(0, 120) : (raw || "").slice(0, 120))); await sleep(1200); continue; }
    const items = (json.Items || []).filter((x) => x.affiliateUrl && (x.mediumImageUrls || [])[0]);
    let n = 0;
    for (const it of items) {
      if (n >= take) break;
      const code = it.itemCode || it.affiliateUrl;
      if (seen.has(code)) continue;
      seen.add(code);
      const raw0 = typeof it.mediumImageUrls[0] === "string" ? it.mediumImageUrls[0] : it.mediumImageUrls[0].imageUrl;
      const img = raw0.replace(/\?_ex=\d+x\d+$/, "") + "?_ex=240x240";
      out.push({
        id: "rk_" + String(out.length + 1).padStart(3, "0"),
        cat: k.cat, lv: k.lv, ic: k.ic,
        j: shorten(it.itemName), e: k.e,
        p: Number(it.itemPrice).toLocaleString() + "円",
        img, url: it.affiliateUrl,
      });
      n++;
    }
    console.log("ok: " + k.q + " +" + n + "点");
  } catch (e) {
    console.error(k.q + " 失敗: " + e.message);
  }
  await sleep(1200); // レート制限対策(約1req/sec)
}
console.log("合計 " + out.length + " 点取得");

if (!out.length) { console.error("1件も取得できず — 既存ブロックを保持"); process.exit(1); }

const file = join(ROOT, "index.html");
const src = readFileSync(file, "utf-8");
const re = /var AF_RAKU_AUTO=[\s\S]*?\/\*END_AF_RAKU_AUTO\*\//;
if (!re.test(src)) throw new Error("AF_RAKU_AUTO ブロックが index.html に見つかりません");
writeFileSync(file, src.replace(re, "var AF_RAKU_AUTO=" + JSON.stringify(out) + "; /*END_AF_RAKU_AUTO*/"), "utf-8");
console.log("AF_RAKU_AUTO を更新: " + out.length + "点（この後 node build.mjs → デプロイ）");
