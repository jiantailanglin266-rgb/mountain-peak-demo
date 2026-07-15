// 収集済み動画（video-results.jsonl）を index.html の MT_VIDEOS / VID_ORDER にマージする
// 実行: node tools/merge-videos.mjs <results.jsonl>（冪等: 既存エントリは保持、同一IDは追加しない）
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const resultsPath = process.argv[2];
if (!resultsPath) { console.error("usage: node tools/merge-videos.mjs <results.jsonl>"); process.exit(1); }

const DATA = JSON.parse(readFileSync(join(ROOT, "data.js"), "utf-8").match(/^var DATA=(.*);$/m)[1]);
let html = readFileSync(join(ROOT, "index.html"), "utf-8");

const mv = html.match(/var MT_VIDEOS=(\{[\s\S]*?\});\r?\n/);
const vo = html.match(/var VID_ORDER=(\[[^\]]*\]);/);
if (!mv || !vo) throw new Error("MT_VIDEOS / VID_ORDER not found");
const VIDEOS = JSON.parse(mv[1]);
const ORDER = JSON.parse(vo[1]);

const seen = new Set();
for (const k of Object.keys(VIDEOS)) for (const v of VIDEOS[k]) seen.add(v.id);

let added = 0, dup = 0, newKeys = [];
for (const line of readFileSync(resultsPath, "utf-8").replace(/^﻿/, "").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const r = JSON.parse(line.replace(/^﻿/, ""));
  if (seen.has(r.id)) { dup++; continue; }
  seen.add(r.id);
  if (!VIDEOS[r.key]) { VIDEOS[r.key] = []; if (ORDER.indexOf(r.key) < 0) newKeys.push(r.key); }
  VIDEOS[r.key].push({ id: r.id, title: r.title, author: r.author });
  added++;
}

// 新規キーの並び: 日本（標高降順）→ 世界（標高降順）。既存の並びの後ろに付ける
const elev = (k) => { const m = DATA.mountains.find((x) => x.id === k); return m ? m.elevationM : 0; };
const isJp = (k) => { const m = DATA.mountains.find((x) => x.id === k); return m && m.countryId === "c_jp"; };
newKeys.sort((a, b) => (isJp(b) - isJp(a)) || (elev(b) - elev(a)));
const order = ORDER.concat(newKeys);

const body = Object.keys(VIDEOS).map((k) => " " + JSON.stringify(k) + ":" + JSON.stringify(VIDEOS[k])).join(",\n");
html = html.replace(mv[0], "var MT_VIDEOS={\n" + body + "\n};\n");
html = html.replace(vo[0], "var VID_ORDER=" + JSON.stringify(order) + ";");
writeFileSync(join(ROOT, "index.html"), html, "utf-8");
const total = Object.keys(VIDEOS).reduce((n, k) => n + VIDEOS[k].length, 0);
console.log(`added=${added} dupSkipped=${dup} newKeys=${newKeys.length} totalVideos=${total} orderKeys=${order.length}`);
