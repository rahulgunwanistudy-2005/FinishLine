// Chromium sends all HTTP(S) traffic through this proxy. DNS is validated and the
// socket is connected to that exact address, preventing a second browser lookup.
import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns/promises";
import { randomUUID } from "node:crypto";
import { isPublicAddress } from "./security.js";
const grants = new Map<string, string | undefined>();
let proxyPromise: Promise<{ server: http.Server; url: string }> | undefined;
export function trustedRequest(raw: string, trusted?: string) {
  if (!trusted) return false;
  try {
    const url = new URL(raw),
      allowed = new URL(trusted);
    if (url.href === allowed.href) return true;
    return (
      allowed.pathname === "/" &&
      url.origin === allowed.origin &&
      (url.pathname.startsWith("/src/") ||
        url.pathname.startsWith("/@") ||
        url.pathname.startsWith("/node_modules/") ||
        url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/fonts/") ||
        url.pathname === "/fonts.css" ||
        url.pathname === "/finish.svg" ||
        url.pathname === "/api/benchmark" ||
        url.pathname === "/api/health" ||
        /^\/api\/frames\/[a-zA-Z0-9-]+$/.test(url.pathname))
    );
  } catch {
    return false;
  }
}
async function destination(raw: string, trusted?: string) {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Protocol or credentials blocked");
  const internal = trustedRequest(raw, trusted);
  if (!internal && url.port && !["80", "443"].includes(url.port))
    throw new Error("Port blocked");
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), {
    all: true,
  });
  if (
    !addresses.length ||
    (!internal && addresses.some((a) => !isPublicAddress(a.address)))
  )
    throw new Error("Address blocked");
  return {
    url,
    address: addresses[0].address,
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
  };
}
function grant(req: http.IncomingMessage) {
  const header = req.headers["proxy-authorization"];
  if (!header?.startsWith("Basic "))
    throw new Error("Proxy authentication required");
  const token = Buffer.from(header.slice(6), "base64").toString().split(":")[0];
  if (!grants.has(token)) throw new Error("Proxy grant expired");
  return grants.get(token);
}
async function proxyServer() {
  if (!proxyPromise)
    proxyPromise = new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.headers["proxy-authorization"]) {
          res
            .writeHead(407, {
              "Proxy-Authenticate": 'Basic realm="FinishLine"',
            })
            .end();
          return;
        }
        try {
          const trusted = grant(req);
          const target = await destination(req.url ?? "", trusted);
          const headers: http.OutgoingHttpHeaders = {
            ...req.headers,
            host: target.url.host,
          };
          delete headers["proxy-authorization"];
          delete headers["proxy-connection"];
          const upstream = http.request(
            {
              hostname: target.address,
              port: target.port,
              method: req.method,
              path: target.url.pathname + target.url.search,
              headers,
            },
            (response) => {
              res.writeHead(response.statusCode ?? 502, response.headers);
              response.pipe(res);
            },
          );
          upstream.setTimeout(15000, () => upstream.destroy());
          upstream.on("error", () => {
            if (!res.headersSent) res.writeHead(502);
            res.end();
          });
          req.on("aborted", () => upstream.destroy());
          req.pipe(upstream);
        } catch {
          res.writeHead(403).end("Outbound destination blocked");
        }
      });
      server.on("connect", async (req, client, head) => {
        if (!req.headers["proxy-authorization"]) {
          client.end(
            'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="FinishLine"\r\n\r\n',
          );
          return;
        }
        try {
          grant(req);
          const target = await destination(`https://${req.url}/`);
          const upstream = net.connect(target.port, target.address, () => {
            client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            if (head.length) upstream.write(head);
            upstream.pipe(client);
            client.pipe(upstream);
          });
          upstream.setTimeout(30000, () => upstream.destroy());
          upstream.on("error", () => client.destroy());
          client.on("error", () => upstream.destroy());
          client.on("close", () => upstream.destroy());
        } catch {
          client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
        }
      });
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string")
          return reject(new Error("Proxy could not start"));
        server.unref();
        resolve({ server, url: `http://127.0.0.1:${address.port}` });
      });
    });
  return proxyPromise;
}
export async function proxyGrant(trustedUrl?: string) {
  const { url } = await proxyServer();
  const token = randomUUID();
  grants.set(token, trustedUrl);
  return {
    proxy: {
      server: url,
      username: token,
      password: "finish-line",
      bypass: "<-loopback>",
    },
    release: () => grants.delete(token),
  };
}
export async function closeProxy() {
  if (proxyPromise) {
    const { server } = await proxyPromise;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    proxyPromise = undefined;
    grants.clear();
  }
}
