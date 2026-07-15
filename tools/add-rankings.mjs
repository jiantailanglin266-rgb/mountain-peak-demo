// リスト（rankings）拡充: data.js を読み、基本3リスト+テーマ別リストを再生成して書き戻す
// 収録データの属性（山域・国・標高・難易度・ベストシーズン）から機械的に抽出するため捏造なし
// 実行: node tools/add-rankings.mjs（冪等: 毎回ゼロから再構築）
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(readFileSync(join(ROOT, "data.js"), "utf-8").match(/^var DATA=(.*);$/m)[1]);

const M = DATA.mountains.filter((x) => x.status === "published");
const jp = (m) => m.countryId === "c_jp";
const inR = (...rs) => (m) => rs.includes(m.regionId);
const inC = (...cs) => (m) => cs.includes(m.countryId);
const season = (...mo) => (m) => (m.bestSeasons || []).some((s) => mo.includes(s));
const byElevD = (a, b) => b.elevationM - a.elevationM;
const byElevA = (a, b) => a.elevationM - b.elevationM;

// 既存の基本3リストは維持（順序: 百名山 → セブンサミッツ → 8000m峰）
const keep = ["hyakumeizan", "seven-summits", "8000m-peaks"].map((s) => {
  const r = DATA.rankings.find((x) => x.slug === s);
  if (!r) throw new Error("missing base ranking: " + s);
  return r;
});

// [slug, 名ja, 名en, 説明ja, 説明en, filter, sort?]
const DEFS = [
  // --- 日本: 山域別 ---
  ["japan-alps", "日本アルプス全山", "The Japan Alps",
    "北アルプス・中央アルプス・南アルプスの収録全山。3000m級が連なる日本登山の中心舞台です。",
    "Every listed peak of the Northern, Central and Southern Japan Alps — the heartland of Japanese alpinism.",
    (m) => jp(m) && inR("r_kita_alps", "r_chuo_alps", "r_minami_alps")(m)],
  ["kita-alps", "北アルプス（飛騨山脈）の名峰", "Northern Japan Alps",
    "槍・穂高から立山・白馬まで。岩と雪の殿堂、北アルプスの収録全山です。",
    "From Yari-Hotaka to Tateyama and Shirouma — the granite-and-snow showcase of the Northern Alps.",
    inR("r_kita_alps")],
  ["minami-alps", "南アルプス（赤石山脈）の名峰", "Southern Japan Alps",
    "北岳・甲斐駒・仙丈など、深い森と大きな山容が魅力の南アルプスの収録全山です。",
    "Kita-dake, Kaikoma, Senjō and more — the deep forests and huge massifs of the Southern Alps.",
    inR("r_minami_alps")],
  ["yatsu-okuchichibu", "八ヶ岳・奥秩父・丹沢", "Yatsugatake & Oku-Chichibu",
    "首都圏からアクセスしやすい八ヶ岳・奥秩父・丹沢エリアの収録山をまとめました。",
    "The Yatsugatake, Oku-Chichibu and Tanzawa areas — big mountains within easy reach of Tokyo.",
    inR("r_yatsugatake", "r_okuchichibu")],
  ["hokkaido", "北海道の名峰", "Mountains of Hokkaido",
    "利尻岳から大雪山・トムラウシまで。雄大な北の大地の収録全山です。",
    "From Rishiri to the Daisetsuzan group — the great peaks of Japan's northern island.",
    inR("r_hokkaido")],
  ["tohoku", "東北の名峰", "Mountains of Tōhoku",
    "八甲田・岩手山・鳥海山・蔵王など、山毛欅の森と温泉に恵まれた東北の収録全山です。",
    "Hakkōda, Iwate-san, Chōkai and Zaō — beech forests and hot springs of northern Honshū.",
    inR("r_tohoku")],
  ["joshinetsu", "上信越の名峰", "Jōshin'etsu Highlands",
    "谷川岳・苗場山・妙高山など、豪雪地帯ならではの山々が揃う上信越エリアの収録全山です。",
    "Tanigawa, Naeba and Myōkō — the deep-snow country where Gunma, Nagano and Niigata meet.",
    inR("r_joshinetsu")],
  ["nikko-kanto", "関東・日光周辺の山", "Kantō & Nikkō Area",
    "日光白根山・男体山・筑波山・高尾山など、関東平野を取り囲む収録山をまとめました。",
    "Nikkō-Shirane, Nantai, Tsukuba and Takao — the peaks ringing the Kantō plain.",
    inR("r_nikko_kanto", "r_kanto", "r_fuji")],
  ["west-japan", "西日本の名峰", "Mountains of Western Japan",
    "白山・大山・石鎚山・剣山など、北陸から中国・四国にかけての収録山をまとめました。",
    "Hakusan, Daisen, Ishizuchi and Tsurugi-san — the celebrated peaks of western Honshū and Shikoku.",
    inR("r_hakusan_hokuriku", "r_chugoku", "r_kinki_shikoku")],
  ["kyushu-yakushima", "九州・屋久島の山", "Kyūshū & Yakushima",
    "阿蘇・霧島・開聞岳、そして屋久島の宮之浦岳。火の国と杉の島の収録全山です。",
    "Aso, Kirishima, Kaimon and Yakushima's Miyanoura-dake — volcanoes and cedar-clad island peaks.",
    inR("r_kyushu_yakushima")],
  // --- 日本: テーマ別 ---
  ["japan-3000m", "日本の3000m峰", "Japan's 3,000m Peaks",
    "収録データから標高3,000m以上の日本の山を集めました。日本の屋根を制覇しよう。",
    "Every listed Japanese peak at or above 3,000m — the roof of Japan.",
    (m) => jp(m) && m.elevationM >= 3000],
  ["japan-beginner", "初心者におすすめの日本の山", "Beginner-friendly Peaks in Japan",
    "難易度1（初級）の日本の山を集めました。登山道が整備され、最初の一座に選びやすい山々です。",
    "Japanese mountains rated difficulty 1 — well-maintained trails, ideal for your first summits.",
    (m) => jp(m) && m.difficultyLevel === 1, byElevA],
  ["japan-low-hike", "低山ハイクの山（2000m未満）", "Low-mountain Hikes (under 2,000m)",
    "標高2,000m未満・難易度1〜2の日本の山。日帰りで四季を楽しめる身近なフィールドです。",
    "Japanese peaks under 2,000m at difficulty 1–2 — day-hike territory for every season.",
    (m) => jp(m) && m.elevationM < 2000 && m.difficultyLevel <= 2, byElevA],
  ["japan-winter", "冬も楽しめる山", "Winter-friendly Mountains",
    "ベストシーズンに12〜2月を含む難易度1〜2の日本の山。雪景色や樹氷を安全寄りに楽しめます（冬山は必ず冬装備で）。",
    "Japanese peaks whose best season includes December–February at difficulty 1–2. Winter gear is still essential.",
    (m) => jp(m) && m.difficultyLevel <= 2 && season(12, 1, 2)(m), byElevA],
  ["japan-autumn", "紅葉の名山", "Autumn-color Classics",
    "ベストシーズンに10月を含む日本の山。涸沢や栗駒など、日本の秋を代表する山岳紅葉へ。",
    "Japanese peaks whose best season includes October — prime autumn-foliage mountains.",
    (m) => jp(m) && season(10)(m)],
  ["japan-fresh-green", "残雪と新緑の5月の山", "May: Snow Patches & Fresh Green",
    "ベストシーズンに5月を含む難易度1〜2の日本の山。残雪の白と新緑のコントラストが美しい季節です。",
    "Japanese peaks at difficulty 1–2 whose best season includes May — lingering snow meets fresh green.",
    (m) => jp(m) && m.difficultyLevel <= 2 && season(5)(m), byElevA],
  ["japan-advanced", "岩と鎖の上級の山（日本）", "Japan's Advanced Peaks",
    "難易度4以上の日本の山。剱岳や穂高など、岩稜・鎖場の経験が問われる上級者の領域です。",
    "Japanese mountains rated difficulty 4+ — Tsurugi, Hotaka and other serious rock-and-chain terrain.",
    (m) => jp(m) && m.difficultyLevel >= 4],
  // --- 世界: 山域別 ---
  ["himalaya", "ヒマラヤの巨峰", "Giants of the Himalaya",
    "エベレストをはじめとするヒマラヤ山脈の収録全山。地球の最高所が連なる白き山嶺です。",
    "Every listed peak of the Himalaya, Everest included — the highest ground on Earth.",
    inR("r_himalaya")],
  ["karakoram", "カラコルムの峻峰", "The Karakoram",
    "K2・ガッシャーブルムなど、急峻さで知られるカラコルム山脈の収録全山です。",
    "K2, the Gasherbrums and more — the steepest great range on the planet.",
    inR("r_karakoram")],
  ["european-alps", "ヨーロッパアルプスの名峰", "The European Alps",
    "モンブラン・マッターホルン・アイガー。近代登山発祥の舞台、アルプスの収録全山です。",
    "Mont Blanc, the Matterhorn and the Eiger — the birthplace of modern alpinism.",
    inR("r_alps")],
  ["andes", "アンデスの高峰", "The Andes",
    "アコンカグアからワスカラン・コトパクシまで、南米大陸を貫くアンデス山脈の収録全山です。",
    "From Aconcagua to Huascarán and beyond — the spine of South America.",
    inR("r_andes")],
  ["north-america", "北米の名峰", "North American Classics",
    "デナリ・レーニア・ローガンなど、アメリカ・カナダ・メキシコの収録全山です。",
    "Denali, Rainier, Logan and more — the great peaks of the USA, Canada and Mexico.",
    inC("c_us", "c_ca", "c_mx")],
  ["africa-middle-east", "アフリカ・中東の山", "Africa & the Middle East",
    "キリマンジャロ・ケニア山からダマヴァンド・アララトまで。赤道の氷河と高原の火山を巡ります。",
    "Kilimanjaro and Mount Kenya to Damavand and Ararat — equatorial glaciers and highland volcanoes.",
    (m) => inC("c_tz", "c_ke", "c_et", "c_ma", "c_ir", "c_tr")(m)],
  ["southern-hemisphere", "パタゴニアとサザンアルプス", "Patagonia & the Southern Alps",
    "フィッツロイ・トーレス・デル・パイネ、そしてアオラキ。南半球の風の大地に立つ絶景峰です。",
    "Fitz Roy, the Paine towers and Aoraki — wind-carved icons of the southern hemisphere.",
    inR("r_patagonia", "r_nz_alps")],
  ["central-asia", "中央アジア・コーカサスの高峰", "Central Asia & the Caucasus",
    "天山・パミール・コーカサス。シルクロードを見下ろす7000m級の収録全山です。",
    "The Tien Shan, Pamir and Caucasus — 7,000m-class peaks above the Silk Road.",
    inR("r_tienshan", "r_pamir", "r_caucasus")],
  ["east-se-asia", "東・東南アジアの名峰", "East & Southeast Asia",
    "玉山・ハンラサン・キナバル・ファンシーパンなど、アジアの多彩な収録山をまとめました。",
    "Yushan, Hallasan, Kinabalu and Fansipan — the varied great peaks of East and Southeast Asia.",
    (m) => !jp(m) && (inR("r_east_asia", "r_sudirman")(m) || inC("c_tw", "c_kr", "c_my", "c_vn", "c_id")(m))],
  ["europe-beyond-alps", "アルプス以外のヨーロッパの山", "Europe Beyond the Alps",
    "オリンポス・ベンネビス・トリグラウから北欧の山まで。アルプスの外に広がるヨーロッパの名峰です。",
    "Olympus, Ben Nevis, Triglav and the Nordic peaks — Europe's classics outside the Alps.",
    inR("r_europe_other", "r_scandinavia")],
  // --- 世界: テーマ別 ---
  ["world-7000m", "世界の7000m峰", "The 7,000m Peaks",
    "収録データから標高7,000〜7,999mの山を集めました。8000m峰に次ぐ高所の世界です。",
    "Every listed peak between 7,000m and 7,999m — the tier just below the 8000ers.",
    (m) => m.elevationM >= 7000 && m.elevationM < 8000],
  ["world-6000m", "世界の6000m峰", "The 6,000m Peaks",
    "収録データから標高6,000〜6,999mの山を集めました。アンデスやヒマラヤの入門高峰が並びます。",
    "Every listed peak between 6,000m and 6,999m — classic high-altitude objectives.",
    (m) => m.elevationM >= 6000 && m.elevationM < 7000],
  ["world-5000m", "世界の5000m峰", "The 5,000m Peaks",
    "収録データから標高5,000〜5,999mの山を集めました。キリマンジャロやエルブルスなど人気峰が中心です。",
    "Every listed peak between 5,000m and 5,999m — Kilimanjaro, Elbrus and other bucket-list summits.",
    (m) => m.elevationM >= 5000 && m.elevationM < 6000],
  ["expert-peaks", "エキスパートの領域", "Expert Territory",
    "難易度5（エキスパート）の収録全山。高度な登攀技術と遠征経験が求められる世界です。",
    "Every peak rated difficulty 5 — expedition-grade mountains demanding advanced technical skill.",
    (m) => m.difficultyLevel === 5],
  ["first-overseas", "初めての海外名峰", "Your First Overseas Peak",
    "難易度1〜2の海外の山を集めました。旅行と組み合わせて挑戦しやすい世界の名峰です。",
    "Non-Japanese peaks at difficulty 1–2 — famous summits you can pair with a holiday.",
    (m) => !jp(m) && m.difficultyLevel <= 2, byElevA],
];

const rankings = [...keep];
for (const [slug, ja, en, dja, den, filter, sort] of DEFS) {
  const ms = M.filter(filter).sort(sort || byElevD).slice(0, 100); // 1リスト最大100座
  if (ms.length < 4) { console.log(`skip ${slug}: only ${ms.length}`); continue; }
  rankings.push({
    id: "rank_" + slug.replace(/-/g, "_"), slug,
    names: { ja, en }, descriptions: { ja: dja, en: den },
    mountainIds: ms.map((x) => x.id),
  });
}
DATA.rankings = rankings;
writeFileSync(join(ROOT, "data.js"), "var DATA=" + JSON.stringify(DATA) + ";\n", "utf-8");
console.log(`rankings=${rankings.length}` , rankings.map((r) => `${r.slug}(${r.mountainIds.length})`).join(" "));
