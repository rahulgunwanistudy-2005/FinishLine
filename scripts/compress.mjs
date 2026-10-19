import { readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync } from "node:zlib";
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
