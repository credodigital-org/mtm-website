/* Lists the pictures shipped in public/images into src/siteImages.json, so the admin's image
   picker can show them (the API server on Render cannot see the website's files).
   Runs automatically before `npm run dev` and `npm run build`. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public", "images");
let files = [];
try {
  files = fs.readdirSync(dir).filter((f) => /\.(webp|jpe?g|png|gif)$/i.test(f)).sort();
} catch {
  /* no public/images folder */
}
const list = files.map((filename) => ({ filename, url: `/images/${filename}` }));
fs.writeFileSync(path.join(root, "src", "siteImages.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`siteImages.json: ${list.length} images`);
