// 取得済みデータ（%TEMP%\climbers）+ マニフェスト + 動画 → climbers.js と images/climbers/ を生成
// 実行: node tools/build-climbers.mjs
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(tmpdir(), "climbers");
const manifest = JSON.parse(readFileSync(join(ROOT, "tools", "climbers-manifest.json"), "utf-8")).entries;

let videos = {};
try { videos = JSON.parse(readFileSync(join(ROOT, "tools", "climber-videos.json"), "utf-8").replace(/^﻿/, "")); } catch (e) { console.log("videos load failed: " + e.message); }
const videoFor = (ne, nj) => {
  for (const key of Object.keys(videos)) {
    if ((ne && (ne.includes(key) || key.includes(ne))) || (nj && key.includes(nj))) return videos[key];
  }
  return null;
};

mkdirSync(join(ROOT, "images", "climbers"), { recursive: true });
const trim = (s, n) => { s = (s || "").trim(); return s.length > n ? s.slice(0, n).replace(/[、。,.\s]+\S*$/, "") + "…" : s; };

const out = [];
let imgCount = 0, jaCount = 0, skipped = 0, vidCount = 0;
for (const e of manifest) {
  const recPath = join(TMP, e.id + ".json");
  if (!existsSync(recPath)) { skipped++; continue; }
  const rec = JSON.parse(readFileSync(recPath, "utf-8"));
  if (!rec.extractJa && !rec.extractEn) { skipped++; continue; }
  let img = 0;
  const imgSrc = join(TMP, e.id + ".img");
  if (rec.img && existsSync(imgSrc)) {
    copyFileSync(imgSrc, join(ROOT, "images", "climbers", e.id + ".jpg"));
    img = 1; imgCount++;
  }
  if (rec.extractJa) jaCount++;
  const v = e.featured ? videoFor(e.nameEn, e.nameJa) : null;
  if (v) vidCount++;
  out.push({
    id: e.id, nj: e.nameJa, ne: e.nameEn || "", nat: e.nat || "", tags: e.tags || [],
    f: e.featured ? 1 : 0, img,
    xj: trim(rec.extractJa, 700), xe: trim(rec.extractEn, 700),
    uj: rec.urlJa || "", ue: rec.urlEn || "",
    ...(v ? { v: v.id, vt: v.title } : {}),
  });
}
// 注目 → 画像あり → 名前順
out.sort((a, b) => (b.f - a.f) || (b.img - a.img) || a.nj.localeCompare(b.nj, "ja"));
writeFileSync(join(ROOT, "climbers.js"), "var CLIMBERS=" + JSON.stringify(out) + ";\n", "utf-8");
console.log(`climbers=${out.length} img=${imgCount} ja=${jaCount} videos=${vidCount} skipped=${skipped}`);
