import { brotliCompress, gzip, constants } from "node:zlib";
import { promisify } from "node:util";
const brotli = promisify(brotliCompress);
const gzipBody = promisify(gzip);

export async function compressJson(
  payload: string,
  contentType: string,
  accept: string,
) {
  if (
    !contentType.startsWith("application/json") ||
    Buffer.byteLength(payload) < 1024
  )
    return;
  const qualities = new Map(
    accept
      .toLowerCase()
      .split(",")
      .map((part) => {
        const [name, ...parameters] = part.trim().split(";");
        const q = parameters.find((parameter) =>
          parameter.trim().startsWith("q="),
        );
        const quality = q ? Number(q.trim().slice(2)) : 1;
        return [
          name.trim(),
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
        ];
      }),
  );
  const options = (["br", "gzip"] as const)
    .map((encoding) => ({
      encoding,
      quality: qualities.get(encoding) ?? qualities.get("*") ?? 0,
    }))
    .filter((option) => option.quality > 0)
    .sort((a, b) => b.quality - a.quality);
  const encoding = options[0]?.encoding;
  if (!encoding) return;
  if ((qualities.get("identity") ?? 0) > options[0].quality) return;
  const body =
    encoding === "br"
      ? await brotli(payload, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
        })
      : await gzipBody(payload);
  return { encoding, body };
}
