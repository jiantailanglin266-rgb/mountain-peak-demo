// 写真未取得の山の Wikipedia タイトル候補マニフェストを生成
// 実行: node tools/photo-manifest.mjs → tools/photo-manifest.json
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(readFileSync(join(ROOT, "data.js"), "utf-8").match(/^var DATA=(.*);$/m)[1]);

// タイトルが機械導出できない座の上書き
const OVERRIDES = {
  "aka-dake": { lang: "ja", titles: ["赤岳 (八ヶ岳山系)", "八ヶ岳"] },
  "oasahi-dake": { lang: "ja", titles: ["大朝日岳", "朝日連峰"] },
  "kuju-san": { lang: "ja", titles: ["くじゅう連山", "久住山"] },
  "hoo-zan": { lang: "ja", titles: ["鳳凰山"] },
  "dom": { lang: "en", titles: ["Dom (mountain)"] },
  "mount-meru": { lang: "en", titles: ["Mount Meru (Tanzania)"] },
  "villarrica": { lang: "en", titles: ["Villarrica (volcano)"] },
  "belukha": { lang: "en", titles: ["Belukha Mountain", "Belukha"] },
  "sajama": { lang: "en", titles: ["Sajama", "Nevado Sajama"] },
  "island-peak": { lang: "en", titles: ["Island Peak", "Imja Tse"] },
};

const manifest = [];
for (const m of DATA.mountains) {
  if (existsSync(join(ROOT, "images", "mountains", m.slug + ".jpg"))) continue;
  let entry = OVERRIDES[m.slug];
  if (!entry) {
    if (m.countryId === "c_jp") {
      const name = m.translations.ja.name;
      const paren = name.match(/^(.+?)（(.+?)）$/);
      entry = { lang: "ja", titles: paren ? [paren[2], paren[1]] : [name] };
    } else {
      const name = m.translations.en.name;
      const stripped = name.replace(/\s*\(.*\)$/, "").replace(/\s*\/.*$/, "").trim();
      entry = { lang: "en", titles: stripped !== name ? [name, stripped] : [name] };
    }
  }
  manifest.push({ slug: m.slug, lang: entry.lang, titles: entry.titles });
}
writeFileSync(join(ROOT, "tools", "photo-manifest.json"), JSON.stringify(manifest, null, 1), "utf-8");
console.log("manifest entries: " + manifest.length);
