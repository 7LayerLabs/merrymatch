import "server-only";
import { cleanProductTitle, storeFromUrl } from "@/lib/parseList";

// Fill-from-link. Only fetches known retailers, so nobody can point the server
// at an internal address. Everything else falls back to the store name.
const RETAILERS = [
  "amazon.com", "target.com", "walmart.com", "etsy.com", "nike.com", "nordstrom.com", "barnesandnoble.com",
  "bestbuy.com", "sephora.com", "ulta.com", "apple.com", "lego.com", "hollisterco.com", "dickssportinggoods.com",
  "rei.com", "kohls.com", "llbean.com", "lululemon.com", "gap.com", "oldnavy.gap.com", "macys.com", "costco.com",
  "homedepot.com", "lowes.com", "anthropologie.com", "urbanoutfitters.com", "jcrew.com", "patagonia.com",
  "uniqlo.com", "zara.com", "crateandbarrel.com", "potterybarn.com", "williams-sonoma.com", "wayfair.com",
  "gamestop.com", "dsw.com", "footlocker.com", "adidas.com", "newbalance.com", "underarmour.com", "abercrombie.com",
  "ae.com", "carters.com", "childrensplace.com", "kay.com", "pandora.net", "yeti.com", "stanley1913.com",
  // Short links from share buttons. Every redirect hop is still checked against this list.
  "a.co", "amzn.to", "amzn.com", "amzn.eu", "etsy.me", "walmrt.us", "bby.us", "tgt.biz",
];

export type Preview = {
  title?: string;
  imageUrl?: string;
  priceCents?: number | null;
  store?: string | null;
  size?: string;
  color?: string;
  fetched: boolean;
};

function allowed(host: string) {
  const h = host.replace(/^(www|m|smile)\./, "");
  return RETAILERS.some((r) => h === r || h.endsWith("." + r));
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, prop: string): string | undefined {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re1) || html.match(re2);
  return m ? decode(m[1]) : undefined;
}

function https(u: unknown, base: string): string | undefined {
  if (typeof u !== "string" || !u) return undefined;
  try {
    const x = new URL(u, base);
    return x.protocol === "https:" && !x.username ? x.toString() : undefined;
  } catch {
    return undefined;
  }
}

function toCents(v: unknown): number | null {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) : null;
}

/** Amazon pages have no product JSON, so read the title, main photo and price from the page itself. */
function amazonDetails(html: string, have: Preview): Partial<Preview> {
  const got: Partial<Preview> = {};
  if (!have.title) {
    const t = html.match(/id="productTitle"[^>]*>([^<]+)</i)?.[1];
    if (t && decode(t)) got.title = decode(t).slice(0, 140);
  }
  if (!have.imageUrl) {
    const img =
      html.match(/data-old-hires="(https:\/\/[^"]+)"/i)?.[1] ??
      html.match(/"hiRes":"(https:\/\/[^"]+)"/i)?.[1] ??
      decode(html.match(/data-a-dynamic-image="\{&quot;(https:\/\/[^&]+)&quot;/i)?.[1] ?? "");
    if (img && /^https:\/\/[a-z0-9.-]*(media-amazon|ssl-images-amazon)\.com\//i.test(img)) got.imageUrl = img;
  }
  if (have.priceCents == null) {
    const at = html.indexOf("corePrice");
    const price = (at >= 0 ? html.slice(at, at + 20000) : "").match(/class="a-offscreen">\s*\$([\d,]+(?:\.\d{2})?)/)?.[1];
    if (price) got.priceCents = toCents(price);
  }
  return got;
}

export async function fetchPreview(url: string): Promise<Preview> {
  const u = new URL(url);
  const base: Preview = { store: storeFromUrl(url), fetched: false };
  if (u.protocol !== "https:" || u.port || !allowed(u.hostname)) return base;

  let current = u;
  let res: Response | null = null;
  try {
    for (let hop = 0; hop < 3; hop++) {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: {
          Accept: "text/html",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return base;
        const next = new URL(loc, current);
        if (next.protocol !== "https:" || next.port || !allowed(next.hostname)) return base;
        current = next;
        continue;
      }
      break;
    }
    if (!res || !res.ok || !res.body || !(res.headers.get("content-type") || "").includes("text/html")) return base;

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let html = "";
    let bytes = 0;
    const amazon = /(^|\.)amazon\.[a-z.]+$/i.test(current.hostname);
    const cap = amazon ? 1_400_000 : 900_000;
    while (bytes < cap) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += dec.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});

    const out: Preview = { ...base, fetched: true };
    // Structured product data first.
    for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const data = JSON.parse(m[1].trim());
        const all = [data].flat().flatMap((e: any) => [e, ...(Array.isArray(e?.["@graph"]) ? e["@graph"] : [])]); // eslint-disable-line @typescript-eslint/no-explicit-any
        const p = all.find((x: any) => [x?.["@type"]].flat().includes("Product")); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (p) {
          if (typeof p.name === "string") out.title = decode(p.name).slice(0, 140);
          const img = [p.image].flat()[0];
          out.imageUrl = https(img?.url ?? img, current.toString());
          const offer = [p.offers].flat()[0];
          const o = offer?.offers ? [offer.offers].flat()[0] : offer;
          if (!o?.priceCurrency || o.priceCurrency === "USD") out.priceCents = toCents(o?.price ?? o?.lowPrice ?? offer?.lowPrice);
          if (typeof p.color === "string") out.color = decode(p.color).slice(0, 40);
          const size = p.size?.name ?? p.size;
          if (typeof size === "string") out.size = decode(size).slice(0, 40);
          break;
        }
      } catch {
        /* ignore bad JSON-LD */
      }
    }
    if (amazon) Object.assign(out, amazonDetails(html, out));
    out.title ??= (meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "")).slice(0, 140) || undefined;
    out.imageUrl ??= https(meta(html, "og:image"), current.toString());
    if (out.priceCents == null) out.priceCents = toCents(meta(html, "product:price:amount") ?? meta(html, "og:price:amount"));
    // Bot walls return junk titles.
    if (out.title && /robot|captcha|access denied|page not found|sorry/i.test(out.title)) out.title = undefined;
    if (out.title) out.title = cleanProductTitle(out.title) || undefined;
    return out;
  } catch {
    return base;
  }
}
