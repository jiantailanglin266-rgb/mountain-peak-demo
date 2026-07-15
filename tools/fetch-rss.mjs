// Google News RSS から山岳ニュースを取得して news.js を生成する
// 実行: node tools/fetch-rss.mjs（GitHub Actionsが毎日実行。手動実行も可）
// 表示は「見出し+出典+外部リンク」のみ（本文は取得しない=著作権配慮）
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEEDS = {
  ja: "https://news.google.com/rss/search?q=%E7%99%BB%E5%B1%B1%20OR%20%E5%B1%B1%E5%B2%B3&hl=ja&gl=JP&ceid=JP:ja",
  en: "https://news.google.com/rss/search?q=mountaineering%20OR%20%22climbing%20expedition%22&hl=en-US&gl=US&ceid=US:en",
};
const PER_LOCALE = 12;

const dec = (s) => (s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/<[^>]+>/g, "").trim();

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const b = m[1];
    const tag = (t) => { const x = b.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">")); return x ? dec(x[1]) : ""; };
    const title = tag("title");
    const link = tag("link");
    const src = tag("source");
    const pub = tag("pubDate");
    if (!title || !link) continue;
    // タイトル末尾の「 - メディア名」はsourceと重複するため除去
    const t = src && title.endsWith(" - " + src) ? title.slice(0, -(" - " + src).length) : title;
    items.push({ t, u: link, s: src, d: pub ? new Date(pub).toISOString().slice(0, 10) : "" });
  }
  return items;
}

const out = { updated: new Date().toISOString().slice(0, 10) };
for (const [loc, url] of Object.entries(FEEDS)) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "MountainPeakNewsBot/1.0" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const seen = new Set();
    out[loc] = parseItems(await res.text())
      .filter((x) => { if (seen.has(x.u)) return false; seen.add(x.u); return true; })
      .slice(0, PER_LOCALE);
  } catch (e) {
    console.error(loc + " feed failed: " + e.message);
    out[loc] = [];
  }
}
if (!out.ja.length && !out.en.length) { console.error("no items fetched — keeping existing news.js"); process.exit(1); }
writeFileSync(join(ROOT, "news.js"), "var MP_NEWS=" + JSON.stringify(out) + ";\n", "utf-8");
console.log(`news.js updated: ja=${out.ja.length} en=${out.en.length} (${out.updated})`);
