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
// 全カテゴリに分散して合計約290点。1キーワードから複数点を取得（重複はitemCodeで除去）
const TAKE_DEFAULT = 4;
// カテゴリ別の上限（合計約296点。分散を保つため上限に達したらそのカテゴリは以降スキップ）
const CAP = { "BIG THREE": 112, "LAYERING": 108, "SAFETY": 100, "NAVIGATION": 46, "ACCESSORIES": 122, "ADVANCED": 112 };
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
  // ===== 第2弾（+約150点） =====
  // BIG THREE
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "登山靴 防水 ゴアテックス",          e: "Waterproof Boots" },
  { cat: "BIG THREE", lv: 3, ic: "🥾", q: "登山靴 ハイカット 縦走",           e: "High-cut Boots" },
  { cat: "BIG THREE", lv: 2, ic: "🥾", q: "アプローチシューズ クライミング",    e: "Approach Shoes" },
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "トレイルランニングシューズ",         e: "Trail Running Shoes" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "登山 ザック 20L 日帰り",           e: "Daypack (~20L)" },
  { cat: "BIG THREE", lv: 2, ic: "🎒", q: "登山 ザック 40L",                 e: "Backpack (~40L)" },
  { cat: "BIG THREE", lv: 3, ic: "🎒", q: "大型ザック 65L 登山",             e: "Backpack (~65L)" },
  { cat: "BIG THREE", lv: 1, ic: "🌧", q: "レインジャケット 登山 メンズ",       e: "Rain Jacket (men)" },
  { cat: "BIG THREE", lv: 1, ic: "🌧", q: "レインパンツ 登山",               e: "Rain Pants" },
  { cat: "BIG THREE", lv: 1, ic: "🎽", q: "ヒップバッグ 登山 ウエストポーチ",   e: "Hip Pack" },
  // LAYERING
  { cat: "LAYERING", lv: 2, ic: "🧥", q: "ソフトシェル ジャケット 登山",       e: "Softshell Jacket" },
  { cat: "LAYERING", lv: 1, ic: "🌬", q: "ウインドシェル 登山 軽量",          e: "Windshell" },
  { cat: "LAYERING", lv: 1, ic: "👕", q: "登山 半袖Tシャツ 速乾",            e: "Tee (quick-dry)" },
  { cat: "LAYERING", lv: 1, ic: "👕", q: "登山 ロングスリーブ 化繊",          e: "Long-sleeve (synthetic)" },
  { cat: "LAYERING", lv: 1, ic: "🩳", q: "登山 ハーフパンツ ショートパンツ",   e: "Hiking Shorts" },
  { cat: "LAYERING", lv: 2, ic: "🪶", q: "インナーダウン 軽量",              e: "Inner Down" },
  { cat: "LAYERING", lv: 3, ic: "🧣", q: "メリノウール タートルネック",        e: "Merino Turtleneck" },
  { cat: "LAYERING", lv: 1, ic: "🧦", q: "登山 靴下 5本指",                 e: "Toe Socks" },
  { cat: "LAYERING", lv: 2, ic: "🧤", q: "登山 レインハット 防水帽子",        e: "Rain Hat" },
  // SAFETY
  { cat: "SAFETY", lv: 1, ic: "🔦", q: "ランタン LED 登山 軽量",            e: "Lantern" },
  { cat: "SAFETY", lv: 1, ic: "🩹", q: "テーピング テープ スポーツ",          e: "Athletic Tape" },
  { cat: "SAFETY", lv: 1, ic: "💊", q: "ポイズンリムーバー 虫刺され",         e: "Poison Remover" },
  { cat: "SAFETY", lv: 2, ic: "💧", q: "携帯浄水器 アウトドア",             e: "Water Filter" },
  { cat: "SAFETY", lv: 1, ic: "🧂", q: "塩分タブレット 熱中症対策", take: 2, e: "Salt Tablets" },
  { cat: "SAFETY", lv: 1, ic: "🩹", q: "救急セット 登山 大容量",            e: "First Aid (large)" },
  { cat: "SAFETY", lv: 3, ic: "⛑", q: "登山 ヘルメット 軽量 女性",          e: "Helmet (light)" },
  { cat: "SAFETY", lv: 1, ic: "🔦", q: "ヘッドライト 電池式 明るい",         e: "Headlamp (AA)" },
  { cat: "SAFETY", lv: 2, ic: "🔥", q: "マッチ 防水 火起こし", take: 2,     e: "Waterproof Matches" },
  // NAVIGATION
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "ソーラー 腕時計 アウトドア",       e: "Solar Watch" },
  { cat: "NAVIGATION", lv: 2, ic: "🔭", q: "双眼鏡 コンパクト 登山",         e: "Binoculars" },
  { cat: "NAVIGATION", lv: 1, ic: "🧭", q: "コンパス プレート型 地図",        e: "Baseplate Compass" },
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "デジタルコンパス 高度計 気温",     e: "Digital Compass" },
  { cat: "NAVIGATION", lv: 1, ic: "🔍", q: "ルーペ 地図 携帯", take: 2,     e: "Map Loupe" },
  // ACCESSORIES
  { cat: "ACCESSORIES", lv: 1, ic: "🥢", q: "トレッキングポール 折りたたみ",   e: "Folding Poles" },
  { cat: "ACCESSORIES", lv: 1, ic: "👟", q: "インソール 登山 衝撃吸収",       e: "Insoles" },
  { cat: "ACCESSORIES", lv: 1, ic: "🌂", q: "アームカバー UV 登山",         e: "Arm Sleeves" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧻", q: "手ぬぐい 登山 アウトドア", take: 2, e: "Tenugui" },
  { cat: "ACCESSORIES", lv: 1, ic: "🔗", q: "カラビナ アウトドア 登山",       e: "Carabiner" },
  { cat: "ACCESSORIES", lv: 1, ic: "🎒", q: "スタッフサック 圧縮袋 登山",     e: "Stuff Sack" },
  { cat: "ACCESSORIES", lv: 1, ic: "🍫", q: "行動食 エナジーバー アウトドア",   e: "Energy Bars" },
  { cat: "ACCESSORIES", lv: 1, ic: "🍶", q: "サーモボトル 保温 山専",        e: "Thermo Bottle" },
  { cat: "ACCESSORIES", lv: 1, ic: "🥤", q: "折りたたみ コップ シリコン", take: 2, e: "Folding Cup" },
  { cat: "ACCESSORIES", lv: 1, ic: "🦟", q: "虫除け アウトドア 携帯", take: 2, e: "Insect Repellent" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧴", q: "日焼け止め スポーツ 汗", take: 2, e: "Sunscreen" },
  { cat: "ACCESSORIES", lv: 1, ic: "🕶", q: "サングラス スポーツ 調光",       e: "Sunglasses (photochromic)" },
  // ADVANCED
  { cat: "ADVANCED", lv: 3, ic: "⛺", q: "テント グランドシート 登山", take: 2, e: "Groundsheet" },
  { cat: "ADVANCED", lv: 3, ic: "📌", q: "ペグ アルミ 軽量 テント", take: 2, e: "Tent Pegs" },
  { cat: "ADVANCED", lv: 3, ic: "🪑", q: "アウトドア チェア コンパクト",      e: "Camp Chair" },
  { cat: "ADVANCED", lv: 3, ic: "🔥", q: "ガスバーナー CB缶 アウトドア",      e: "Stove (CB)" },
  { cat: "ADVANCED", lv: 3, ic: "☕", q: "チタン マグカップ 登山",           e: "Titanium Mug" },
  { cat: "ADVANCED", lv: 3, ic: "🍳", q: "メスティン 飯盒 登山",            e: "Mess Tin" },
  { cat: "ADVANCED", lv: 4, ic: "🧤", q: "冬用 グローブ 登山 防水",          e: "Winter Gloves" },
  { cat: "ADVANCED", lv: 4, ic: "🥶", q: "バラクラバ 目出し帽 登山", take: 2, e: "Balaclava" },
  { cat: "ADVANCED", lv: 3, ic: "🌂", q: "ワカン スノーシュー 登山", take: 2, e: "Snowshoes/Wakan" },
  { cat: "ADVANCED", lv: 4, ic: "⛏", q: "ピッケル カバー プロテクター", take: 2, e: "Axe Guard" },
  { cat: "ADVANCED", lv: 4, ic: "🦿", q: "ロングスパッツ 雪山 ゲイター",      e: "Snow Gaiters" },
  // ===== 第3弾（+約150点。ブランド・派生ニッチ） =====
  // BIG THREE
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "モンベル 登山靴",                 e: "Boots (mont-bell)" },
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "キャラバン 登山靴 初心者",         e: "Boots (Caravan)" },
  { cat: "BIG THREE", lv: 2, ic: "🥾", q: "サロモン トレッキングシューズ",     e: "Shoes (Salomon)" },
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "メレル トレッキングシューズ",       e: "Shoes (Merrell)" },
  { cat: "BIG THREE", lv: 2, ic: "🎒", q: "ザック 登山 メンズ 大容量",        e: "Backpack (large)" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "ノースフェイス リュック 登山",      e: "Backpack (TNF)" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "サブバッグ 折りたたみ リュック",    e: "Packable Daypack" },
  { cat: "BIG THREE", lv: 1, ic: "🌧", q: "レインウェア 上下 レディース おしゃれ", e: "Rain Set (women)" },
  { cat: "BIG THREE", lv: 1, ic: "🌧", q: "レインポンチョ 登山 自転車",        e: "Rain Poncho" },
  // LAYERING
  { cat: "LAYERING", lv: 1, ic: "👕", q: "モンベル ジオライン ベースレイヤー",  e: "Base Layer (Geoline)" },
  { cat: "LAYERING", lv: 1, ic: "👖", q: "登山 ロングパンツ 撥水 メンズ",      e: "Pants (water-repel)" },
  { cat: "LAYERING", lv: 1, ic: "👗", q: "登山 スカート レディース",           e: "Hiking Skirt" },
  { cat: "LAYERING", lv: 1, ic: "🦺", q: "フリースベスト アウトドア",          e: "Fleece Vest" },
  { cat: "LAYERING", lv: 2, ic: "🦺", q: "化繊 ベスト 中綿 登山",             e: "Insulated Vest" },
  { cat: "LAYERING", lv: 2, ic: "🧣", q: "登山 ネックウォーマー 防寒",         e: "Neck Warmer" },
  { cat: "LAYERING", lv: 1, ic: "🩱", q: "登山 レギンス サポート メンズ",       e: "Leggings" },
  { cat: "LAYERING", lv: 1, ic: "🧦", q: "登山 靴下 厚手 クッション",          e: "Cushioned Socks" },
  // SAFETY
  { cat: "SAFETY", lv: 1, ic: "💊", q: "携帯 ピルケース 常備薬", take: 2,     e: "Pill Case" },
  { cat: "SAFETY", lv: 1, ic: "🧴", q: "消毒 アルコール 携帯 スプレー", take: 2, e: "Hand Sanitizer" },
  { cat: "SAFETY", lv: 2, ic: "❄", q: "冷却スプレー 熱中症 携帯", take: 2,   e: "Cooling Spray" },
  { cat: "SAFETY", lv: 1, ic: "🚻", q: "携帯トイレ 非常用 登山",             e: "Portable Toilet" },
  { cat: "SAFETY", lv: 1, ic: "🩹", q: "虫刺され 薬 携帯 かゆみ止め", take: 2, e: "Bite Relief" },
  { cat: "SAFETY", lv: 1, ic: "🔦", q: "ヘッドライト 防水 高輝度 USB",        e: "Headlamp (USB)" },
  { cat: "SAFETY", lv: 1, ic: "🪫", q: "乾電池 単4 アルカリ 登山", take: 2,  e: "Batteries" },
  // NAVIGATION
  { cat: "NAVIGATION", lv: 3, ic: "📡", q: "ガーミン GPS 登山",              e: "Garmin GPS" },
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "SUUNTO 腕時計 アウトドア",        e: "Suunto Watch" },
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "カシオ プロトレック",             e: "Casio Pro Trek" },
  { cat: "NAVIGATION", lv: 1, ic: "🌡", q: "温度計 携帯 アウトドア", take: 2, e: "Thermometer" },
  { cat: "NAVIGATION", lv: 1, ic: "🧭", q: "方位磁石 キーホルダー コンパス", take: 2, e: "Keychain Compass" },
  // ACCESSORIES
  { cat: "ACCESSORIES", lv: 2, ic: "🦵", q: "膝サポーター 登山",              e: "Knee Support" },
  { cat: "ACCESSORIES", lv: 1, ic: "📱", q: "スマホ ショルダー 登山",          e: "Phone Lanyard" },
  { cat: "ACCESSORIES", lv: 1, ic: "☔", q: "レインカバー リュック 防水",       e: "Rain Cover" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧻", q: "携帯 ウェットティッシュ アウトドア", take: 2, e: "Wet Wipes" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧴", q: "ボトルホルダー ポーチ 登山", take: 2, e: "Bottle Holder" },
  { cat: "ACCESSORIES", lv: 1, ic: "🔗", q: "ミニカラビナ セット アウトドア",   e: "Mini Carabiners" },
  { cat: "ACCESSORIES", lv: 1, ic: "🎒", q: "コンプレッションバッグ 圧縮袋",    e: "Compression Bag" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧻", q: "速乾 タオル マイクロファイバー",   e: "Quick-dry Towel" },
  { cat: "ACCESSORIES", lv: 2, ic: "🕶", q: "オーバーサングラス 眼鏡の上",     e: "Over-glasses Shades" },
  // ADVANCED
  { cat: "ADVANCED", lv: 3, ic: "🛏", q: "コット アウトドア 軽量 折りたたみ",   e: "Camp Cot" },
  { cat: "ADVANCED", lv: 3, ic: "🔨", q: "ペグハンマー テント", take: 2,     e: "Peg Hammer" },
  { cat: "ADVANCED", lv: 3, ic: "🏮", q: "LEDランタン 充電式 キャンプ",       e: "LED Lantern" },
  { cat: "ADVANCED", lv: 3, ic: "🍴", q: "カトラリー スポーク アウトドア", take: 2, e: "Spork/Cutlery" },
  { cat: "ADVANCED", lv: 4, ic: "🧥", q: "ダウンパンツ 登山 防寒",           e: "Down Pants" },
  { cat: "ADVANCED", lv: 3, ic: "⛺", q: "登山 テント 3人用",               e: "Tent (3p)" },
  { cat: "ADVANCED", lv: 3, ic: "🛡", q: "シュラフカバー 防水 登山", take: 2, e: "Bivy/Bag Cover" },
  { cat: "ADVANCED", lv: 3, ic: "🍵", q: "チタン クッカー コッヘル 登山",      e: "Titanium Cookset" },
  // ===== 第4弾（+約150点。さらにブランド・派生） =====
  // BIG THREE
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "登山靴 ゴアテックス レディース",     e: "Boots GTX (women)" },
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "トレッキングシューズ 幅広 3E",       e: "Wide Trail Shoes" },
  { cat: "BIG THREE", lv: 1, ic: "🥾", q: "キーン トレッキングシューズ",         e: "Shoes (KEEN)" },
  { cat: "BIG THREE", lv: 2, ic: "🎒", q: "ザック 45L 登山",                  e: "Backpack (45L)" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "ザック 25L 登山 レディース",         e: "Daypack (25L)" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "グレゴリー ザック 登山",             e: "Backpack (Gregory)" },
  { cat: "BIG THREE", lv: 1, ic: "🎒", q: "ミレー リュック 登山",              e: "Backpack (Millet)" },
  { cat: "BIG THREE", lv: 1, ic: "🌧", q: "レインスーツ アウトドア 上下 軽量",   e: "Rain Suit" },
  { cat: "BIG THREE", lv: 2, ic: "🎒", q: "アタックザック 軽量 折りたたみ",     e: "Summit Pack" },
  // LAYERING
  { cat: "LAYERING", lv: 1, ic: "👕", q: "ジオライン 中厚手 モンベル",          e: "Base Layer (midweight)" },
  { cat: "LAYERING", lv: 1, ic: "👕", q: "登山 Tシャツ レディース 速乾 UV",     e: "Tee (women, UV)" },
  { cat: "LAYERING", lv: 1, ic: "👔", q: "登山 長袖シャツ チェック アウトドア",  e: "Flannel Shirt" },
  { cat: "LAYERING", lv: 2, ic: "🦺", q: "ダウンベスト 軽量 アウトドア",        e: "Down Vest" },
  { cat: "LAYERING", lv: 2, ic: "👖", q: "ソフトシェル パンツ 登山 撥水",       e: "Softshell Pants" },
  { cat: "LAYERING", lv: 1, ic: "🩳", q: "登山 ズボン 夏 通気 メンズ",         e: "Summer Pants" },
  { cat: "LAYERING", lv: 2, ic: "🩱", q: "コンプレッションタイツ 登山 メンズ",   e: "Compression Tights" },
  { cat: "LAYERING", lv: 3, ic: "🧦", q: "登山 アンダーウェア 冬 防寒",         e: "Winter Underwear" },
  { cat: "LAYERING", lv: 1, ic: "🧤", q: "登山 インナーグローブ 薄手",          e: "Liner Gloves" },
  // SAFETY
  { cat: "SAFETY", lv: 1, ic: "🔦", q: "ヘッドランプ COB 広範囲 充電",         e: "Headlamp (COB)" },
  { cat: "SAFETY", lv: 1, ic: "🩹", q: "救急セット 携帯 コンパクト アウトドア",  e: "First Aid (compact)" },
  { cat: "SAFETY", lv: 1, ic: "💊", q: "常備薬 ケース 防水 携帯", take: 2,    e: "Med Case (waterproof)" },
  { cat: "SAFETY", lv: 2, ic: "❄", q: "冷感タオル 熱中症 ひんやり", take: 2,  e: "Cooling Towel" },
  { cat: "SAFETY", lv: 2, ic: "🫁", q: "携帯 酸素 スプレー 登山", take: 2,    e: "Oxygen Spray" },
  { cat: "SAFETY", lv: 1, ic: "📣", q: "遭難 ホイッスル 大音量 防災", take: 2, e: "Loud Whistle" },
  { cat: "SAFETY", lv: 1, ic: "🩹", q: "ばんそうこう 大容量 防水",             e: "Plasters (bulk)" },
  { cat: "SAFETY", lv: 1, ic: "🛟", q: "保温 アルミシート 防災 レスキュー", take: 2, e: "Foil Blanket" },
  // NAVIGATION
  { cat: "NAVIGATION", lv: 3, ic: "📡", q: "ガーミン インスティンクト",         e: "Garmin Instinct" },
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "スント コア アウトドア",            e: "Suunto Core" },
  { cat: "NAVIGATION", lv: 2, ic: "⌚", q: "登山 時計 気圧 高度 方位 デジタル",  e: "ABC Watch" },
  { cat: "NAVIGATION", lv: 1, ic: "🧭", q: "コンパス 軍用 サバイバル",          e: "Survival Compass" },
  { cat: "NAVIGATION", lv: 2, ic: "🔭", q: "双眼鏡 8倍 防水 コンパクト",        e: "Binoculars (8x)" },
  { cat: "NAVIGATION", lv: 1, ic: "🌡", q: "温湿度計 携帯 アウトドア", take: 2, e: "Thermo-Hygrometer" },
  // ACCESSORIES
  { cat: "ACCESSORIES", lv: 1, ic: "🥢", q: "トレッキングポール レディース 軽量", e: "Poles (women)" },
  { cat: "ACCESSORIES", lv: 1, ic: "☔", q: "折りたたみ傘 軽量 アウトドア",      e: "Folding Umbrella" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧣", q: "冷感 ネックゲイター 夏 UV",        e: "Cooling Gaiter" },
  { cat: "ACCESSORIES", lv: 1, ic: "🔗", q: "カラビナ ロック式 大型 アウトドア", e: "Locking Carabiner" },
  { cat: "ACCESSORIES", lv: 1, ic: "📱", q: "スマホ 防水ケース アウトドア",     e: "Waterproof Phone Case" },
  { cat: "ACCESSORIES", lv: 1, ic: "👛", q: "アウトドア 財布 コインケース", take: 2, e: "Trail Wallet" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧢", q: "帽子 折りたたみ 登山 撥水",        e: "Packable Hat" },
  { cat: "ACCESSORIES", lv: 1, ic: "🧤", q: "登山 手袋 タッチパネル 防風",       e: "Touch Gloves" },
  { cat: "ACCESSORIES", lv: 1, ic: "💧", q: "ボトル 1L 登山 軽量",            e: "1L Bottle" },
  { cat: "ACCESSORIES", lv: 1, ic: "🎒", q: "ザックカバー 大型 60L 防水",       e: "Pack Cover (large)" },
  // ADVANCED
  { cat: "ADVANCED", lv: 3, ic: "⛺", q: "テント 1人用 自立式 軽量",          e: "Tent (1p freestanding)" },
  { cat: "ADVANCED", lv: 3, ic: "⛺", q: "タープ アウトドア 軽量 登山", take: 2, e: "Tarp" },
  { cat: "ADVANCED", lv: 3, ic: "🛏", q: "インフレーターマット 登山",           e: "Inflatable Mat" },
  { cat: "ADVANCED", lv: 3, ic: "🛏", q: "クローズドセルマット 登山", take: 2,  e: "Foam Mat" },
  { cat: "ADVANCED", lv: 3, ic: "🏮", q: "ガスランタン アウトドア", take: 2,   e: "Gas Lantern" },
  { cat: "ADVANCED", lv: 3, ic: "🥣", q: "チタン シェラカップ 登山",           e: "Sierra Cup" },
  { cat: "ADVANCED", lv: 4, ic: "🛌", q: "ダウンシュラフ 800FP 冬",           e: "Down Bag (800FP)" },
  { cat: "ADVANCED", lv: 4, ic: "⛺", q: "冬用 テント 4シーズン 登山", take: 2, e: "4-Season Tent" },
  { cat: "ADVANCED", lv: 4, ic: "🧥", q: "ダウンパンツ 冬 登山 防寒",          e: "Down Pants (winter)" },
];

const shorten = (s) => ((s.split(/[【\[]/)[0].trim() || s).slice(0, 34));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = [];
const seen = new Set(); // itemCode で全体重複除去
const catCount = {};
for (const k of KEYWORDS) {
  const cap = CAP[k.cat] || 40;
  if ((catCount[k.cat] || 0) >= cap) continue; // カテゴリ上限に達したらAPIを叩かずスキップ
  const take = k.take || TAKE_DEFAULT;
  try {
    const { status, json, raw } = await apiGet({ keyword: k.q, hits: String(Math.min(30, take + 8)), imageFlag: "1", sort: "-reviewCount", availability: "1" });
    if (status !== 200 || !json) { console.error(k.q + " HTTP" + status + " " + (json ? JSON.stringify(json.errors || json).slice(0, 120) : (raw || "").slice(0, 120))); await sleep(1200); continue; }
    const items = (json.Items || []).filter((x) => x.affiliateUrl && (x.mediumImageUrls || [])[0]);
    let n = 0;
    for (const it of items) {
      if (n >= take || (catCount[k.cat] || 0) >= cap) break;
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
      catCount[k.cat] = (catCount[k.cat] || 0) + 1;
      n++;
    }
    console.log("ok: " + k.q + " +" + n + " (" + k.cat + ":" + (catCount[k.cat] || 0) + ")");
  } catch (e) {
    console.error(k.q + " 失敗: " + e.message);
  }
  await sleep(1200); // レート制限対策(約1req/sec)
}
console.log("合計 " + out.length + " 点取得 " + JSON.stringify(catCount));

if (!out.length) { console.error("1件も取得できず — 既存ブロックを保持"); process.exit(1); }

// 自動取得商品は別ファイル rakuten.js に出力（1150静的ページへの複製を回避）
writeFileSync(join(ROOT, "rakuten.js"), "var AF_RAKU_AUTO=" + JSON.stringify(out) + ";\n", "utf-8");
// index.html の rakuten.js?v=N をインクリメントしてキャッシュを更新
const idxPath = join(ROOT, "index.html");
let idx = readFileSync(idxPath, "utf-8");
const bumped = idx.replace(/rakuten\.js\?v=(\d+)/, (mm, n) => "rakuten.js?v=" + (Number(n) + 1));
if (bumped === idx) console.warn("警告: index.html の rakuten.js?v= が見つからず、バージョンをbumpできませんでした");
else writeFileSync(idxPath, bumped, "utf-8");
console.log("rakuten.js を更新: " + out.length + "点。index.htmlの?v=も更新。この後 node build.mjs → デプロイ");
