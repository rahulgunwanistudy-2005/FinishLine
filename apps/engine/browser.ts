import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { assertPublicUrl } from "./security.js";
import { proxyGrant, closeProxy, trustedRequest } from "./proxy.js";
let browserPromise: Promise<Browser> | undefined;
export async function getBrowser() {
  if (!browserPromise)
    browserPromise = chromium
      .launch({
        headless: true,
        args: [
          "--disable-quic",
          "--disable-dev-shm-usage",
          "--disable-features=WebRtcHideLocalIpsWithMdns",
          "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        ],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = undefined;
        });
        return browser;
      })
      .catch((e) => {
        browserPromise = undefined;
        throw e;
      });
  return browserPromise;
}
export async function closeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = undefined;
  await closeProxy();
}
export async function guardedContext(
  options: {
    width?: number;
    height?: number;
    mobile?: boolean;
    trustedUrl?: string;
  } = {},
) {
  const browser = await getBrowser();
  const grant = await proxyGrant(options.trustedUrl);
  const context = await browser.newContext({
    proxy: grant.proxy,
    viewport: { width: options.width ?? 1280, height: options.height ?? 800 },
    isMobile: options.mobile,
    hasTouch: options.mobile,
    acceptDownloads: false,
    bypassCSP: false,
    javaScriptEnabled: true,
    serviceWorkers: "block",
    ignoreHTTPSErrors: false,
  });
  context.on("close", grant.release);
  await context.route("**/*", async (route) => {
    try {
      const raw = route.request().url();
      if (trustedRequest(raw, options.trustedUrl)) {
        await route.continue();
        return;
      }
      await assertPublicUrl(raw);
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
  await context.routeWebSocket("**/*", (socket) => socket.close());
  context.on("page", (page) => {
    page.on("popup", (popup) => void popup.close());
    page.on("download", (download) => void download.cancel());
  });
  await context.addInitScript(() => {
    const state = { mutations: 0 };
    Object.defineProperty(window, "__finishLine", { value: state });
    new MutationObserver((records) => {
      state.mutations += records.filter(
        (r) =>
          r.type !== "attributes" ||
          ["aria-expanded", "open", "hidden", "disabled"].includes(
            r.attributeName ?? "",
          ),
      ).length;
    }).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  });
  return context;
}
export async function navigate(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load", timeout: 15000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
}
export async function healthBrowser() {
  let context: BrowserContext | undefined;
  try {
    context = await (await getBrowser()).newContext();
    const page = await context.newPage();
    await page.setContent("<button>Engine ready</button>");
    await page.screenshot({ type: "jpeg" });
    return true;
  } catch {
    return false;
  } finally {
    await context?.close();
  }
}
