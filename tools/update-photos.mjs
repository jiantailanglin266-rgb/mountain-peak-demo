// images/mountains/*.jpg をスキャンして index.html の MT_PHOTOS を書き換える（UTF-8安全）
// 実行: node tools/update-photos.mjs
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const slugs = readdirSync(join(ROOT, "images", "mountains"))
  .filter((f) => f.endsWith(".jpg"))
  .map((f) => f.replace(/\.jpg$/, ""))
  .sort();

const map = "{" + slugs.map((s) => JSON.stringify(s) + ":1").join(",") + "}";
const file = join(ROOT, "index.html");
const src = readFileSync(file, "utf-8");
const re = /var MT_PHOTOS=\{[^}]*\};/;
if (!re.test(src)) throw new Error("MT_PHOTOS not found");
writeFileSync(file, src.replace(re, "var MT_PHOTOS=" + map + ";"), "utf-8");
console.log("MT_PHOTOS updated: " + slugs.length + " photos");
