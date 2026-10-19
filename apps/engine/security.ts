import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
export function isPublicAddress(address: string): boolean {
  try {
    const ip = ipaddr.process(address);
    return ip.range() === "unicast";
  } catch {
    return false;
  }
}
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Only public http(s) URLs without credentials are allowed.",
    );
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("Public races support ports 80 and 443 only.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  )
    throw new Error("Private and local addresses cannot be raced.");
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error(
      "Private, loopback, reserved and metadata addresses cannot be raced.",
    );
  return url;
}
