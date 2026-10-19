import { readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync } from "node:zlib";
// The small app stylesheet and font declarations are critical to the first
// viewport. Inline them once so mobile rendering needs no blocking CSS requests.
let html = await readFile("dist/index.html", "utf8");
for (const match of [
  ...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g),
]) {
  const path = match[1];
  if (!path.startsWith("/") || path.includes("..")) continue;
  const css = await readFile(`dist${path}`, "utf8");
  html = html.replace(
    match[0],
    `<style>${css.replaceAll("</style", "<\\/style")}</style>`,
  );
}
await writeFile("dist/index.html", html);
async function compress(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${file.name}`;
    if (file.isDirectory()) await compress(path);
    else if (/\.(html|css|js)$/.test(file.name)) {
      const content = await readFile(path);
      await writeFile(`${path}.gz`, gzipSync(content));
      await writeFile(`${path}.br`, brotliCompressSync(content));
    }
  }
}
await compress("dist");
