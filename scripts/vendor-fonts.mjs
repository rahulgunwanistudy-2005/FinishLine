import { mkdir, writeFile } from "node:fs/promises";
const url =
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap";
const response = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
});
if (!response.ok)
  throw new Error("Google Fonts stylesheet could not be retrieved");
const css = await response.text();
await mkdir("apps/web/public/fonts", { recursive: true });
const blocks = [
  ...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g),
].map((m) => m[1]);
if (!blocks.length) throw new Error("Latin font faces not found");
const local = [];
for (const [i, block] of blocks.entries()) {
  const remote = block.match(/url\((https:[^)]+)\)/)?.[1];
  if (!remote) throw new Error("Font URL missing");
  const data = await fetch(remote);
  if (!data.ok) throw new Error("Font download failed");
  const file = `barlow-${i}.woff2`;
  await writeFile(
    `apps/web/public/fonts/${file}`,
    Buffer.from(await data.arrayBuffer()),
  );
  local.push(block.replace(remote, `/fonts/${file}`));
}
await writeFile(
  "apps/web/public/fonts.css",
  "/* Barlow and Barlow Condensed. Source: Google Fonts, SIL Open Font License. See docs/FONTS.md. */\n" +
    local.join("\n"),
);
console.log(`Saved ${local.length} Latin font faces from Google Fonts.`);
