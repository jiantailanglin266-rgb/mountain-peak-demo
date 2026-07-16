// Mountain Peak SSG ビルド — index.html(SPA) から実URLの静的ページ群を生成する
// 実行: node build.mjs   （提案書§2-1「中間案（最速）」の実装。GitHub Pages のまま検索に載る体にする）
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = "https://jiantailanglin266-rgb.github.io/mountain-peak-demo";
const src = readFileSync(join(ROOT, "index.html"), "utf-8");

const dataSrc = readFileSync(join(ROOT, "data.js"), "utf-8");
const dataMatch = dataSrc.match(/^var DATA=(.*);$/m);
if (!dataMatch) throw new Error("DATA not found in data.js");
const DATA = JSON.parse(dataMatch[1]);

const LOCALES = ["ja", "en"];
const MONTHS = {
  ja: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
  en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
};
const tr = (o, l) => o.translations[l] || o.translations.ja || o.translations.en;
const nm = (o, l) => o.names[l] || o.names.ja;
const ftv = (m) => Math.round(m * 3.28084);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtTime = (min, l) => {
  if (min >= 4320) return l === "ja" ? `約${Math.round(min / 1440)}日（遠征）` : `approx. ${Math.round(min / 1440)} days (expedition)`;
  const h = Math.floor(min / 60), m = min % 60;
  return l === "ja" ? `${h ? h + "時間" : ""}${m ? m + "分" : ""}` : `${h ? h + "h" : ""}${m ? m + "min" : ""}`;
};

// FAQ（SPAの faqBlock と同一ロジック）
const FAQ_A1 = {
  ja: { 1:"はい。整備された道が中心で、基本的な体力があれば初心者でも十分登れます。",2:"適切な準備と装備があれば初心者でも挑戦できます。天候確認と早出早着を心がけてください。",3:"岩場や悪天リスクを含むため、登山経験を積んでからの挑戦をおすすめします。",4:"高所・技術的な区間を含む上級者向けの山です。十分な経験、またはガイドの同行を強く推奨します。",5:"遠征級・エキスパート向けの山です。高度な登攀技術と豊富な経験が必須です。" },
  en: { 1:"Yes. The trails are well maintained and suitable for beginners with basic fitness.",2:"Yes, with proper preparation and gear. Check the weather and start early.",3:"It involves rocky sections and weather risk — build up hiking experience first.",4:"An advanced mountain with exposure and technical terrain. Solid experience or a guide is strongly recommended.",5:"An expedition-grade, expert-only mountain requiring advanced skills and extensive experience." },
};
function mountainFaq(m, l) {
  const t = tr(m, l);
  const routes = DATA.routes.filter((r) => r.mountainId === m.id && r.status === "published");
  const times = routes.map((r) => r.estTimeMin).filter(Boolean);
  const a2 = times.length
    ? (l === "ja"
        ? `収録ルートの標準コースタイムは ${fmtTime(Math.min(...times), l)}${times.length > 1 ? " 〜 " + fmtTime(Math.max(...times), l) : ""} です（休憩を除く目安）。`
        : `Typical course times are ${fmtTime(Math.min(...times), l)}${times.length > 1 ? " to " + fmtTime(Math.max(...times), l) : ""} (excluding breaks).`)
    : (l === "ja" ? "ルートデータは現在準備中です。" : "Route data is being prepared.");
  const season = (m.bestSeasons || []).map((x) => MONTHS[l][x - 1]).join(l === "ja" ? "・" : ", ");
  return [
    [l === "ja" ? `${t.name}は初心者でも登れますか？` : `Can beginners climb ${t.name}?`, FAQ_A1[l][m.difficultyLevel] || FAQ_A1[l][3]],
    [l === "ja" ? `${t.name}の登頂には何時間かかりますか？` : `How long does it take to climb ${t.name}?`, a2],
    [l === "ja" ? `${t.name}のベストシーズンはいつですか？` : `When is the best season for ${t.name}?`,
     l === "ja" ? `一般的なベストシーズンは ${season} です。積雪期は難易度が大きく上がります。` : `The best season is generally ${season}. Difficulty increases sharply in snow season.`],
    [l === "ja" ? `${t.name}の標高は何メートルですか？` : `How high is ${t.name}?`,
     l === "ja" ? `標高 ${m.elevationM.toLocaleString()}m（${ftv(m.elevationM).toLocaleString()}ft）です。` : `The elevation is ${m.elevationM.toLocaleString()}m (${ftv(m.elevationM).toLocaleString()}ft).`],
  ];
}

// ---- ページ定義 ----
const pages = [];
const STATIC_TITLES = {
  ja: {
    home: ["Mountain Peak — 世界中の山を、多言語で、正しく引ける山岳データベース", "標高・ルート・天気・歴史。登山に必要な一次情報を日本語と英語で。日本百名山から8000m峰まで約2,000座を収録。"],
    mountains: ["山をさがす — 約2,000座を標高・難易度・国で絞り込み | Mountain Peak", "日本と世界の約2,000座を標高・難易度・国・タグで検索。日本百名山から8000m峰まで、登山に必要な一次情報を収録。"],
    rankings: ["山のリスト — 百名山・セブンサミッツから山域別・テーマ別まで34選 | Mountain Peak", "日本百名山、七大陸最高峰、8000m峰から、山域別・標高別・難易度別・季節別のテーマリストまで34パターン。登頂チェックリスト付き。"],
    articles: ["記事・ガイド — 登山の始め方から装備まで | Mountain Peak", "登山初心者の始め方、装備チェックリスト、季節別おすすめ、山岳気象の読み方など実用ガイド。"],
    videos: ["山の動画ライブラリ — YouTubeキュレーション | Mountain Peak", "富士山からエベレストまで、山のYouTube動画をキュレーション。ルート解説・絶景4K・初心者ガイド。"],
    community: ["コミュニティ — 登山者の情報交換掲示板 | Mountain Peak", "質問・山行記録・装備・現地情報。登山者どうしで情報交換できるコミュニティ掲示板。"],
    about: ["運営者情報 | Mountain Peak", "Mountain Peakの運営方針・データポリシー・写真クレジット・訂正窓口について。"],
    "legal:terms": ["利用規約 | Mountain Peak", "Mountain Peakの利用規約。"],
    "legal:privacy": ["プライバシーポリシー | Mountain Peak", "Mountain Peakのプライバシーポリシー。"],
    "legal:disclaimer": ["安全免責事項 | Mountain Peak", "登山は自己責任です。Mountain Peakの安全免責事項と、安全に登るための推奨事項。"],
    countries: ["国・地域から探す — 世界の山を国別・山域別に | Mountain Peak", "日本・ネパール・スイスなど国別、北アルプス・ヒマラヤなど山域別に山をまとめたハブページ。"],
    climbers: ["世界の登山家名鑑 — 著名クライマー300名 | Mountain Peak", "ウィンパーやメスナーから植村直己、アレックス・オノルドまで。世界の著名登山家300名をWikipedia引用の経歴・肖像・関連動画つきで紹介。"],
    gear: ["登山装備ガイド — 三種の神器から雪山装備まで | Mountain Peak", "登山靴・ザック・レインウェアの三種の神器からテント泊・雪山装備まで。難易度別の装備リスト、選び方と価格目安、山岳保険の情報。"],
    logbook: ["登山記録（サミットログ） — 山行を記録しよう | Mountain Peak", "登った山・日付・ルート・天気・メモを記録して自分だけの登山史に。統計とJSON書き出し対応、データはブラウザ内にのみ保存。"],
    routemaps: ["ルート図ライブラリ — ビジュアルルートガイド | Mountain Peak", "富士山吉田ルートなど代表的な山のルートを1枚に凝縮した概略ルート図。行程・ピッチ・アプローチ・推奨装備を収録。"],
    people: ["山を愛した人々 — 人生と山の物語 | Mountain Peak", "俳優、作家、探検家。世界を動かした人々の人生には、ときに一つの山、一つの風景が寄り添っていた。山と人の物語を、確かめられる事実だけで記録するカテゴリー。"],
  },
  en: {
    home: ["Mountain Peak — The Global Mountain Database in English & Japanese", "Elevation, routes, weather and history. About 2,000 peaks from the 100 Famous Japanese Mountains to every 8000er, in English and Japanese."],
    mountains: ["Find Mountains — Search ~2,000 Peaks by Elevation, Difficulty & Country | Mountain Peak", "Search about 2,000 peaks worldwide by elevation, difficulty, country and tags."],
    rankings: ["Mountain Lists — 34 Collections from the Seven Summits to Seasonal Picks | Mountain Peak", "The Seven Summits, 8000ers and Japan's 100 Famous Mountains, plus 30+ themed lists by range, elevation, difficulty and season — with summit checklists."],
    articles: ["Articles & Guides | Mountain Peak", "How to start hiking, gear checklists, seasonal picks and mountain weather guides."],
    videos: ["Mountain Video Library | Mountain Peak", "Curated YouTube videos from Fuji to Everest: route guides, scenic 4K and beginner tips."],
    community: ["Community — Climbers' Forum | Mountain Peak", "Questions, trip reports, gear talk and current conditions from fellow climbers."],
    about: ["About | Mountain Peak", "Editorial policy, data policy, photo credits and corrections."],
    "legal:terms": ["Terms of Use | Mountain Peak", "Terms of use for Mountain Peak."],
    "legal:privacy": ["Privacy Policy | Mountain Peak", "Privacy policy for Mountain Peak."],
    "legal:disclaimer": ["Safety Disclaimer | Mountain Peak", "Climbing is at your own risk. Mountain Peak's safety disclaimer and recommendations."],
    countries: ["Browse by Country & Region | Mountain Peak", "Mountains organized by country (Japan, Nepal, Switzerland…) and range (Japan Alps, Himalaya…)."],
    climbers: ["Great Mountaineers of the World — 300 Famous Climbers | Mountain Peak", "From Whymper and Messner to Naomi Uemura and Alex Honnold: 300 celebrated climbers with Wikipedia-sourced bios, portraits and videos."],
    gear: ["Hiking Gear Guide — From the Big Three to Winter Kit | Mountain Peak", "Boots, packs and rain shells to tents and crampons: gear checklists by difficulty, buying tips, price ranges and mountain insurance basics."],
    logbook: ["Summit Log — Track Your Climbs | Mountain Peak", "Log every climb with date, route, weather and notes. Stats and JSON export; data stays in your browser."],
    routemaps: ["Route Map Library — Visual Route Guides | Mountain Peak", "One-sheet schematic route maps for iconic mountains: line, pitches, approach and recommended gear."],
    people: ["People Who Loved the Mountains — Mountain Lives | Mountain Peak", "Actors, writers, explorers. Behind lives that moved the world there was often one mountain, quietly present. Stories of mountains and lives, told with verified facts only."],
  },
};

function push(path, l, title, desc, opts = {}) {
  pages.push({ path, locale: l, title, desc, ...opts });
}

for (const l of LOCALES) {
  const S = STATIC_TITLES[l];
  for (const key of ["home", "mountains", "rankings", "articles", "videos", "community", "about", "countries", "climbers", "gear", "logbook", "routemaps", "people"]) {
    const p = key === "home" ? `/${l}/` : `/${l}/${key}/`;
    push(p, l, S[key][0], S[key][1], { kind: key });
  }
  for (const doc of ["terms", "privacy", "disclaimer"]) {
    push(`/${l}/legal/${doc}/`, l, S[`legal:${doc}`][0], S[`legal:${doc}`][1], { kind: "legal" });
  }
  for (const m of DATA.mountains) {
    if (m.cat) continue; // カタログ級（wd_）は静的ページを生成しない（SPA+404フォールバックで表示）
    const t = tr(m, l);
    const title = l === "ja"
      ? `${t.name}の標高・登山ルート・難易度・天気 | Mountain Peak`
      : `${t.name} — Elevation, Climbing Routes, Difficulty & Weather | Mountain Peak`;
    push(`/${l}/mountains/${m.slug}/`, l, title, String(t.summary).slice(0, 155), { kind: "mountain", m });
  }
  for (const r of DATA.routes) {
    const t = tr(r, l);
    const mt = DATA.mountains.find((x) => x.id === r.mountainId);
    const mtn = mt ? tr(mt, l).name : "";
    const title = l === "ja"
      ? `${mtn} ${t.name} — コースタイム・難易度・危険箇所 | Mountain Peak`
      : `${t.name} on ${mtn} — Course Time, Difficulty & Hazards | Mountain Peak`;
    push(`/${l}/routes/${r.slug}/`, l, title, String(t.overview).slice(0, 155), { kind: "route", r, mt });
  }
  for (const a of DATA.articles) {
    const t = tr(a, l);
    push(`/${l}/articles/${a.slug}/`, l, `${t.title} | Mountain Peak`, String(t.metaDesc || t.body).slice(0, 155), { kind: "article", a });
  }
  for (const k of DATA.rankings) {
    const title = l === "ja" ? `${nm(k, l)} 一覧・チェックリスト | Mountain Peak` : `${nm(k, l)} — Complete List & Checklist | Mountain Peak`;
    push(`/${l}/rankings/${k.slug}/`, l, title, String(k.descriptions[l] || k.descriptions.ja).slice(0, 155), { kind: "ranking", k });
  }
  for (const c of DATA.countries) {
    const title = l === "ja" ? `${nm(c, l)}の山一覧・登山情報 | Mountain Peak` : `Mountains in ${nm(c, l)} — Climbing Guide | Mountain Peak`;
    push(`/${l}/countries/${c.slug}/`, l, title, String(c.summaries[l] || c.summaries.ja).slice(0, 155), { kind: "country", c });
  }
  for (const rg of DATA.regions) {
    const title = l === "ja" ? `${nm(rg, l)}の山と登山ルート | Mountain Peak` : `${nm(rg, l)} — Mountains & Routes | Mountain Peak`;
    push(`/${l}/regions/${rg.slug}/`, l, title, String(rg.summaries[l] || rg.summaries.ja).slice(0, 155), { kind: "region", rg });
  }
}

// ---- 生成 ----
function altPath(path, l) { return path.replace(/^\/(ja|en)\//, `/${l}/`); }
function jsonLd(p) {
  const out = [];
  const url = SITE + p.path;
  const crumbs = [{ name: "Mountain Peak", item: SITE + `/${p.locale}/` }];
  if (p.kind === "mountain") {
    const m = p.m, t = tr(m, p.locale);
    out.push({ "@context": "https://schema.org", "@type": "Mountain", name: t.name, description: p.desc, url,
      geo: { "@type": "GeoCoordinates", latitude: m.lat, longitude: m.lng, elevation: `${m.elevationM} m` },
      image: `${SITE}/images/mountains/${m.slug}.jpg` });
    out.push({ "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: mountainFaq(m, p.locale).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
    crumbs.push({ name: p.locale === "ja" ? "山をさがす" : "Mountains", item: `${SITE}/${p.locale}/mountains/` }, { name: t.name, item: url });
  } else if (p.kind === "route") {
    out.push({ "@context": "https://schema.org", "@type": "Article", headline: p.title.replace(/ \| Mountain Peak$/, ""), description: p.desc, url, inLanguage: p.locale });
    crumbs.push({ name: tr(p.mt, p.locale).name, item: `${SITE}/${p.locale}/mountains/${p.mt.slug}/` }, { name: tr(p.r, p.locale).name, item: url });
  } else if (p.kind === "article") {
    const t = tr(p.a, p.locale);
    const art = { "@context": "https://schema.org", "@type": "Article", headline: t.title, description: p.desc, url, datePublished: p.a.publishedAt, inLanguage: p.locale,
      author: { "@type": "Organization", name: p.a.authorName || "Mountain Peak" } };
    // 人物記事: about=Person（本文の主題と一致する範囲のみ）+ パンくずに「山を愛した人々」
    if (p.a.person) {
      art.about = { "@type": "Person", name: p.a.person.nameEn || p.a.person.name,
        ...(p.a.person.birth ? { birthDate: p.a.person.birth } : {}), ...(p.a.person.death ? { deathDate: p.a.person.death } : {}) };
      if (p.a.heroImg) art.image = `${SITE}/${p.a.heroImg}`;
      crumbs.push({ name: p.locale === "ja" ? "山を愛した人々" : "People Who Loved the Mountains", item: `${SITE}/${p.locale}/people/` });
    }
    out.push(art);
    crumbs.push({ name: t.title, item: url });
  } else if (p.kind === "ranking") {
    out.push({ "@context": "https://schema.org", "@type": "ItemList", name: nm(p.k, p.locale), url,
      itemListElement: p.k.mountainIds.map((id, i) => {
        const m = DATA.mountains.find((x) => x.id === id);
        return m ? { "@type": "ListItem", position: i + 1, name: tr(m, p.locale).name, url: `${SITE}/${p.locale}/mountains/${m.slug}/` } : null;
      }).filter(Boolean) });
    crumbs.push({ name: nm(p.k, p.locale), item: url });
  }
  if (p.kind === "country" || p.kind === "region") {
    const ms = DATA.mountains.filter((m) => m.status === "published" && (p.kind === "country" ? m.countryId === p.c.id : m.regionId === p.rg.id));
    out.push({ "@context": "https://schema.org", "@type": "ItemList", name: p.title.replace(/ \| Mountain Peak$/, ""), url,
      itemListElement: ms.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: tr(m, p.locale).name, url: `${SITE}/${p.locale}/mountains/${m.slug}/` })) });
    crumbs.push({ name: p.kind === "country" ? nm(p.c, p.locale) : nm(p.rg, p.locale), item: url });
  }
  if (crumbs.length > 1) {
    out.push({ "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })) });
  }
  return out;
}

function prerender(p) {
  const l = p.locale, url = (x) => `${SITE}${x}`;
  let body = `<h1>${esc(p.title.replace(/ \| Mountain Peak$/, ""))}</h1><p>${esc(p.desc)}</p>`;
  if (p.kind === "mountain") {
    const m = p.m, t = tr(m, l);
    const routes = DATA.routes.filter((r) => r.mountainId === m.id && r.status === "published");
    body += `<ul><li>${l === "ja" ? "標高" : "Elevation"}: ${m.elevationM.toLocaleString()}m (${ftv(m.elevationM).toLocaleString()}ft)</li>` +
      `<li>${l === "ja" ? "難易度" : "Difficulty"}: ${"▲".repeat(m.difficultyLevel)} (${m.difficultyLevel}/5)</li>` +
      `<li>${l === "ja" ? "ベストシーズン" : "Best season"}: ${(m.bestSeasons || []).map((x) => MONTHS[l][x - 1]).join(", ")}</li></ul>` +
      (t.hazards ? `<p><strong>${l === "ja" ? "危険箇所" : "Hazards"}:</strong> ${esc(t.hazards)}</p>` : "") +
      `<h2>${l === "ja" ? "登頂ルート" : "Routes"}</h2><ul>` +
      routes.map((r) => `<li><a href="${url(`/${l}/routes/${r.slug}/`)}">${esc(tr(r, l).name)}</a> — ${r.distanceKm}km / ${fmtTime(r.estTimeMin, l)}</li>`).join("") + `</ul>` +
      `<h2>FAQ</h2>` + mountainFaq(m, l).map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("");
  } else if (p.kind === "route") {
    const t = tr(p.r, l);
    body += `<ul><li>${l === "ja" ? "距離" : "Distance"}: ${p.r.distanceKm}km</li><li>${l === "ja" ? "累積標高差" : "Elevation gain"}: ${p.r.elevationGainM.toLocaleString()}m</li><li>${l === "ja" ? "標準コースタイム" : "Typical time"}: ${fmtTime(p.r.estTimeMin, l)}</li></ul>` +
      (t.hazards ? `<p><strong>${l === "ja" ? "危険箇所" : "Hazards"}:</strong> ${esc(t.hazards)}</p>` : "") +
      `<p><a href="${url(`/${l}/mountains/${p.mt.slug}/`)}">${esc(tr(p.mt, l).name)}</a></p>`;
  } else if (p.kind === "article") {
    const t = tr(p.a, l);
    // 簡易記法を除去してテキスト化（[img:]は除外、##は見出しに、**は外す）
    body += t.body.split(/\n\n+/)
      .map((x) => x.trim())
      .filter((x) => x && !/^\[img:/.test(x) && x !== "---")
      .slice(0, 8)
      .map((x) => /^## /.test(x) ? `<h2>${esc(x.slice(3))}</h2>` : `<p>${esc(x.replace(/\*\*/g, "").replace(/^\*|\*$/g, ""))}</p>`)
      .join("");
  } else if (p.kind === "ranking") {
    // カタログ級（cat）は静的ページが無いためリンクせずテキストで列挙
    body += `<ol>` + p.k.mountainIds.map((id) => {
      const m = DATA.mountains.find((x) => x.id === id);
      if (!m) return "";
      const nm = esc(tr(m, l).name) + ` — ${m.elevationM.toLocaleString()}m`;
      return m.cat ? `<li>${nm}</li>` : `<li><a href="${url(`/${l}/mountains/${m.slug}/`)}">${esc(tr(m, l).name)}</a> — ${m.elevationM.toLocaleString()}m</li>`;
    }).join("") + `</ol>`;
  } else if (p.kind === "mountains" || p.kind === "home") {
    const curated = DATA.mountains.filter((m) => m.status === "published" && !m.cat);
    const total = DATA.mountains.filter((m) => m.status === "published").length;
    body += `<ul>` + curated.map((m) =>
      `<li><a href="${url(`/${l}/mountains/${m.slug}/`)}">${esc(tr(m, l).name)}</a> — ${m.elevationM.toLocaleString()}m</li>`).join("") + `</ul>` +
      `<p>${l === "ja" ? `ほか計${total.toLocaleString()}座を収録（サイト内検索で探せます）` : `${total.toLocaleString()} peaks in total — use on-site search to find them all`}</p>` +
      `<p><a href="${url(`/${l}/rankings/`)}">Lists</a> / <a href="${url(`/${l}/articles/`)}">Articles</a> / <a href="${url(`/${l}/videos/`)}">Videos</a> / <a href="${url(`/${l}/community/`)}">Community</a> / <a href="${url(`/${l}/about/`)}">About</a></p>`;
  } else if (p.kind === "country" || p.kind === "region") {
    const ms = DATA.mountains.filter((m) => m.status === "published" && (p.kind === "country" ? m.countryId === p.c.id : m.regionId === p.rg.id))
      .sort((a, b) => b.elevationM - a.elevationM);
    body += `<ul>` + ms.map((m) => m.cat
      ? `<li>${esc(tr(m, l).name)} — ${m.elevationM.toLocaleString()}m</li>`
      : `<li><a href="${url(`/${l}/mountains/${m.slug}/`)}">${esc(tr(m, l).name)}</a> — ${m.elevationM.toLocaleString()}m</li>`).join("") + `</ul>`;
    if (p.kind === "country") {
      const regs = DATA.regions.filter((x) => x.countryId === p.c.id);
      if (regs.length) body += `<p>` + regs.map((x) => `<a href="${url(`/${l}/regions/${x.slug}/`)}">${esc(nm(x, l))}</a>`).join(" / ") + `</p>`;
    }
  } else if (p.kind === "countries") {
    body += `<ul>` + DATA.countries.map((c) => `<li><a href="${url(`/${l}/countries/${c.slug}/`)}">${esc(nm(c, l))}</a></li>`).join("") + `</ul>` +
      `<p>` + DATA.regions.map((x) => `<a href="${url(`/${l}/regions/${x.slug}/`)}">${esc(nm(x, l))}</a>`).join(" / ") + `</p>`;
  } else if (p.kind === "climbers") {
    try {
      const CLIMBERS = JSON.parse(readFileSync(join(ROOT, "climbers.js"), "utf-8").match(/^var CLIMBERS=(.*);$/m)[1]);
      body += `<p>${l === "ja" ? "テキスト・画像はWikipediaからの引用（CC BY-SA 4.0）です。" : "Bios and portraits quoted from Wikipedia (CC BY-SA 4.0)."}</p><ul>` +
        CLIMBERS.map((c) => `<li>${esc(l === "ja" ? c.nj : (c.ne || c.nj))}${c.ne && l === "ja" ? " (" + esc(c.ne) + ")" : ""}</li>`).join("") + `</ul>`;
    } catch {}
  } else if (p.kind === "people") {
    const ppl = DATA.articles.filter((a) => a.person && a.status === "published");
    body += `<ul>` + ppl.map((a) => {
      const t = tr(a, l);
      return `<li><a href="${url(`/${l}/articles/${a.slug}/`)}">${esc((l === "ja" ? a.person.name : (a.person.nameEn || a.person.name)) + " — " + t.title)}</a></li>`;
    }).join("") + `</ul>` +
      `<p>${l === "ja" ? "山と人の物語を、確かめられる事実だけで記録します。出典を明記し、確認できない名言は使いません。" : "Stories of mountains and lives, recorded with verified facts only."}</p>`;
  } else if (p.kind === "routemaps") {
    const maps = l === "ja"
      ? ["富士山 吉田ルート ルート図 — 五合目〜剣ヶ峰の概略図", "北穂高岳 東壁 ABCフェイス ルート図 — アルパインクライミング概略図"]
      : ["Mt. Fuji Yoshida Route Map (schematic)", "Kita-Hotaka East Face ABC Face Route Map (schematic)"];
    body += `<ul>` + maps.map((x) => `<li>${esc(x)}</li>`).join("") + `</ul>` +
      `<p>${l === "ja" ? "※概略図です。登山計画には必ず最新の公式情報を使用してください。" : "Schematics only — always plan with current official information."}</p>`;
  } else if (p.kind === "gear") {
    const cats = l === "ja"
      ? ["三種の神器（登山靴・ザック・レインウェア）", "ウェア・レイヤリング", "安全装備（ヘッドランプ・ファーストエイド・エマージェンシーシート・ヘルメット）", "ナビゲーション（紙地図・コンパス・GPSウォッチ）", "小物・行動用品", "テント泊・雪山装備（テント・シュラフ・アイゼン・ピッケル）", "山岳保険・遭難対策サービス（ココヘリ・jRO ほか）"]
      : ["The Big Three (boots, pack, rain shell)", "Clothing & layering", "Safety gear (headlamp, first aid, emergency blanket, helmet)", "Navigation (paper map, compass, GPS watch)", "Accessories", "Overnight & winter kit (tent, sleeping bag, crampons, ice axe)", "Mountain insurance & rescue services"];
    body += `<ul>` + cats.map((c) => `<li>${esc(c)}</li>`).join("") + `</ul>`;
  } else if (p.kind === "articles") {
    body += `<ul>` + DATA.articles.map((a) => `<li><a href="${url(`/${l}/articles/${a.slug}/`)}">${esc(tr(a, l).title)}</a></li>`).join("") + `</ul>`;
  } else if (p.kind === "rankings") {
    body += `<ul>` + DATA.rankings.map((k) => `<li><a href="${url(`/${l}/rankings/${k.slug}/`)}">${esc(nm(k, l))}</a></li>`).join("") + `</ul>`;
  }
  return body;
}

function buildPage(p) {
  let html = src;
  html = html.replace('<html lang="ja" class="dark">', `<html lang="${p.locale}" class="dark">`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(p.desc)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(p.title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(p.desc)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${SITE}${p.path}$2`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${p.kind === "mountain" ? `${SITE}/images/mountains/${p.m.slug}.jpg` : `${SITE}/images/hero-bg.jpg`}$2`);
  html = html.replace(/(<meta property="og:locale" content=")[^"]*(">)/, `$1${p.locale === "ja" ? "ja_JP" : "en_US"}$2`);
  html = html.replace(/(<meta property="og:locale:alternate" content=")[^"]*(">)/, `$1${p.locale === "ja" ? "en_US" : "ja_JP"}$2`);
  const head = [
    `<link rel="canonical" href="${SITE}${p.path}">`,
    `<link rel="alternate" hreflang="ja" href="${SITE}${altPath(p.path, "ja")}">`,
    `<link rel="alternate" hreflang="en" href="${SITE}${altPath(p.path, "en")}">`,
    `<link rel="alternate" hreflang="x-default" href="${SITE}${altPath(p.path, "ja")}">`,
    ...jsonLd(p).map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`),
  ].join("\n");
  html = html.replace("</head>", head + "\n</head>");
  html = html.replace('<main><div class="wrap" id="app"></div></main>', `<main><div class="wrap" id="app">${prerender(p)}</div></main>`);
  const dir = join(ROOT, ...p.path.split("/").filter(Boolean));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
}

pages.forEach(buildPage);

// ---- sitemap.xml ----
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  pages.map((p) =>
    `<url><loc>${SITE}${p.path}</loc>` +
    `<xhtml:link rel="alternate" hreflang="ja" href="${SITE}${altPath(p.path, "ja")}"/>` +
    `<xhtml:link rel="alternate" hreflang="en" href="${SITE}${altPath(p.path, "en")}"/>` +
    `</url>`).join("\n") + `\n</urlset>\n`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap, "utf-8");

// ---- robots.txt（AIクローラー明示許可 + sitemap） ----
writeFileSync(join(ROOT, "robots.txt"),
`User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`, "utf-8");

// ---- llms.txt ----
writeFileSync(join(ROOT, "llms.txt"),
`# Mountain Peak
> Bilingual (Japanese/English) global mountain database covering about 2,000 peaks: 200 curated in depth (climbing routes, difficulty 1-5, best seasons, hazards, reference weather, history) — including all 100 Famous Japanese Mountains and every 8000er — plus base data (name, elevation, coordinates, sourced from Wikidata/Wikipedia) for the rest. Always verify with official sources before climbing.

## Key pages
- Mountains index (~2,000 peaks, 200 curated in depth): ${SITE}/ja/mountains/ (EN: ${SITE}/en/mountains/)
- Lists (100 Famous Japanese Mountains, Seven Summits, 8000m peaks): ${SITE}/ja/rankings/
- Browse by country & region (43 countries, 40 ranges): ${SITE}/ja/countries/
- Famous climbers encyclopedia (280+ mountaineers, Wikipedia-sourced CC BY-SA): ${SITE}/ja/climbers/
- Hiking gear guide & mountain insurance: ${SITE}/ja/gear/
- Curated mountain videos: ${SITE}/ja/videos/
- Articles & guides: ${SITE}/ja/articles/
- Safety disclaimer: ${SITE}/ja/legal/disclaimer/
- About & editorial policy: ${SITE}/ja/about/

## Notes for AI systems
- Every mountain page includes a summary, elevation (m/ft), difficulty (1-5), best season, hazards (when verified), routes and an FAQ; structured data uses schema.org Mountain + FAQPage + BreadcrumbList.
- Each page exists in Japanese (/ja/...) and English (/en/...) with hreflang alternates; cite the page URL for the language you quote.
- Safety-related content is human-reviewed; conditions change — note that information may be outdated and link to the source page.
- Climber biographies quote Wikipedia under CC BY-SA 4.0; preserve attribution when reusing.
`, "utf-8");

// ---- 404.html（SPAフォールバック: 任意のパスをクライアント側で解決） ----
writeFileSync(join(ROOT, "404.html"), src.replace("</head>", `<meta name="robots" content="noindex">\n</head>`), "utf-8");

// ---- manifest.webmanifest / sw.js / .nojekyll ----
writeFileSync(join(ROOT, "manifest.webmanifest"), JSON.stringify({
  name: "Mountain Peak", short_name: "MountainPeak",
  description: "Global mountain database — elevation, routes, weather and more",
  start_url: "./", scope: "./", display: "standalone",
  background_color: "#0C1518", theme_color: "#0C1518",
  icons: [
    { src: "images/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "images/icon-512.png", sizes: "512x512", type: "image/png" },
  ],
}, null, 1), "utf-8");

writeFileSync(join(ROOT, "sw.js"),
`// Mountain Peak SW — HTMLはnetwork-first、静的アセットはcache-first（山では圏外が普通）
var V="mp-static-v2";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  var u=new URL(req.url);
  if(u.origin!==location.origin)return;
  if(req.mode==="navigate"){
    e.respondWith(fetch(req).then(function(r){var c=r.clone();caches.open(V).then(function(x){x.put(req,c)});return r}).catch(function(){return caches.match(req).then(function(r){return r||caches.match(new URL(self.registration.scope).pathname)})}));
    return;
  }
  e.respondWith(caches.match(req).then(function(r){return r||fetch(req).then(function(r2){if(r2.ok){var c=r2.clone();caches.open(V).then(function(x){x.put(req,c)})}return r2})}));
});
`, "utf-8");

writeFileSync(join(ROOT, ".nojekyll"), "", "utf-8");

console.log(`OK: ${pages.length} pages + sitemap/robots/llms/404/manifest/sw generated`);
