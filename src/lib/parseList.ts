// Turns a pasted list (Apple Notes, Google Keep, a text message, a .txt file)
// into reviewable wishlist rows. Pure function, runs in the browser and on the server.

import { cleanUrl, hostOf } from "./format";

export type ParsedGift = {
  title: string;
  /** True when the title was guessed from the link, so a fetched product name should replace it. */
  titleFromLink?: boolean;
  url: string | null;
  priceCents: number | null;
  size: string | null;
  color: string | null;
  store: string | null;
};

export type ParsedList = { gifts: ParsedGift[]; avoid: string };

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+)/i;
// Every link on a line: full links, www links, and bare shop links like "amazon.com/dp/..." or "a.co/d/...".
const ALL_URLS_RE =
  /(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|co|us|me|to|shop|store|biz|io|ca|uk)\/[^\s<>"')\]]*/gi;
// Words that share buttons add around a link ("Check out this deal on Amazon: ...").
const SHARE_NOISE: RegExp[] = [
  /^(?:hey[,!]?\s+)?check (?:out )?this (?:deal|item|product|listing|out)(?:\s+(?:on|at|from)\s+[^:!\n]{1,30}?)?\s*(?:[:!.-]+\s*|$)/i,
  /^(?:i )?found (?:this|it) on [^:!\n]{1,30}?\s*(?:[:!.-]+\s*|$)/i,
  /^look (?:what|at what) i found(?: on [^:!\n]{1,30}?)?\s*(?:[:!.-]+\s*|$)/i,
  /^(?:shop|buy|get) (?:this|it) (?:on|at) [^:!\n]{1,30}?\s*[:!.-]+\s*/i,
  /^amazon\.com\s*:\s*/i,
  /^walmart\.com\s*:\s*/i,
  /\s*:\s*(?:clothing, shoes & jewelry|home & kitchen|toys & games|electronics|beauty & personal care|sports & outdoors|books|tools & home improvement|health & household|video games|kitchen & dining|office products|pet supplies|patio, lawn & garden|automotive|arts, crafts & sewing|baby|grocery & gourmet food|cell phones & accessories|musical instruments)\s*$/i,
  /\s*[|\-\u2013\u2014]\s*(?:target|walmart\.com|amazon\.com|best buy|etsy|kohl's|macy's|nordstrom|ulta beauty|sephora|lego\.com.*|the home depot|lowe's|costco)\s*$/i,
];
const PRICE_RE = /\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/;
const SIZE_RE = /\b(?:size|sz)\s*[:\-]?\s*([A-Za-z0-9./ ]{1,12}?)(?=[,;)\]]|\s{2}|$|\s(?:color|colour|in|-)\b)/i;
const COLOR_RE = /\b(?:colou?r)\s*[:\-]?\s*([A-Za-z ]{2,20}?)(?=[,;)\]]|$|\s(?:size|sz|-)\b)/i;
const AVOID_HEAD_RE = /^(please\s+)?(avoid|places (and gifts )?to avoid|stores to avoid|dislikes|things i (don'?t|don’t) like|no thanks|please skip|don'?t (get|buy)|do not (get|buy)|not interested|allergies|allergic)\b.*:?$/i;
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i;
const BULLET_RE = /^\s*(?:[-*•◦▪‣⁃∙>]+|\d{1,3}[.)]|\[[ xX]?\]|☐|☑|☒)\s*/;

const STORE_NAMES: Record<string, string> = {
  "amazon.com": "Amazon",
  "a.co": "Amazon",
  "amzn.to": "Amazon",
  "target.com": "Target",
  "walmart.com": "Walmart",
  "etsy.com": "Etsy",
  "bestbuy.com": "Best Buy",
  "nike.com": "Nike",
  "kohls.com": "Kohl's",
  "llbean.com": "L.L.Bean",
  "apple.com": "Apple",
  "lululemon.com": "lululemon",
  "sephora.com": "Sephora",
  "ulta.com": "Ulta",
  "homedepot.com": "Home Depot",
  "lowes.com": "Lowe's",
  "costco.com": "Costco",
  "gap.com": "Gap",
  "oldnavy.gap.com": "Old Navy",
  "nordstrom.com": "Nordstrom",
  "macys.com": "Macy's",
  "dickssportinggoods.com": "Dick's",
  "barnesandnoble.com": "Barnes & Noble",
  "lego.com": "LEGO",
};

export function storeFromUrl(url: string | null): string | null {
  const h = hostOf(url);
  if (!h) return null;
  if (STORE_NAMES[h]) return STORE_NAMES[h];
  const base = h.split(".").slice(-2).join(".");
  if (STORE_NAMES[base]) return STORE_NAMES[base];
  const name = base.split(".")[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
}

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    // Amazon style: /Some-Product-Name/dp/B000...
    const dpIdx = parts.findIndex((p) => p === "dp" || p === "gp");
    const cand = dpIdx > 0 ? parts[dpIdx - 1] : parts.sort((a, b) => b.length - a.length)[0];
    if (cand && /[a-z]/i.test(cand) && cand.length > 3 && !/^[A-Z0-9]{8,}$/.test(cand)) {
      const t = decodeURIComponent(cand)
        .replace(/\.(html?|aspx?|php)$/i, "")
        .replace(/[-_+]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (t.length > 3) return t.charAt(0).toUpperCase() + t.slice(1);
    }
    return `Item from ${storeFromUrl(url) ?? u.hostname}`;
  } catch {
    return "Linked item";
  }
}

function tidy(s: string) {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-:,;|\u2013\u2014]+|[\s\-:,;|\u2013\u2014]+$/g, "")
    .replace(/\(\s*\)/g, "")
    .trim();
}

/** Tidies a product name from a store page or share text ("Amazon.com: Mug : Home & Kitchen" becomes "Mug"). */
export function cleanProductTitle(s: string) {
  return tidy(stripShareNoise(tidy(s)));
}

function stripShareNoise(s: string) {
  let out = s;
  for (const re of SHARE_NOISE) out = out.replace(re, " ");
  return out;
}

/** Apple Notes and phones paste invisible characters that glue lines together or hide spaces. */
function normalize(raw: string) {
  return (raw || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029\u0085\u000b\u000c]/g, "\n")
    .replace(/[\u00a0\u2007\u202f\u3000]/g, " ")
    .replace(/[\u200b-\u200d\u2060\ufeff\ufffc]/g, "")
    .slice(0, 20000);
}

/** Splits a line into [text before link, link] pairs, plus whatever text trails the last link. */
function splitLinks(line: string): { pairs: { before: string; url: string }[]; after: string } {
  const pairs: { before: string; url: string }[] = [];
  let last = 0;
  for (const m of line.matchAll(ALL_URLS_RE)) {
    const url = cleanUrl(m[0].replace(/[.,;:!?]+$/, ""));
    if (!url) continue;
    pairs.push({ before: line.slice(last, m.index), url });
    last = (m.index ?? 0) + m[0].length;
  }
  return { pairs, after: line.slice(last) };
}

export function parseList(raw: string): ParsedList {
  const text = normalize(raw);
  const lines = text.split("\n");
  const gifts: ParsedGift[] = [];
  const avoid: string[] = [];
  let mode: "gifts" | "avoid" = "gifts";

  for (const original of lines) {
    let line = original.trim().replace(/^#{1,6}\s+/, "").replace(BULLET_RE, "").trim();
    if (!line) continue;
    const md = line.match(MD_LINK_RE);
    if (md) line = line.replace(md[0], `${md[1]} ${md[2]}`);

    const bare = line.replace(/[:\s]+$/, "");
    if (AVOID_HEAD_RE.test(bare) && bare.length < 60) {
      mode = "avoid";
      const rest = line.split(/:\s*/).slice(1).join(": ").trim();
      if (rest) avoid.push(rest);
      continue;
    }
    // Any other short heading ends an avoid section, and is skipped.
    const isHeading = /:$/.test(line) && line.length < 50 && !URL_RE.test(line) && !splitLinks(line).pairs.length;
    if (isHeading) {
      if (/(wish|want|ideas|gift|christmas|list|santa)/i.test(line) || mode === "avoid") mode = "gifts";
      continue;
    }
    if (mode === "avoid") {
      avoid.push(line);
      continue;
    }
    // Note titles like "My list", "Riley's Christmas list" or "Wish list 2026" are not gifts.
    if (
      /^(?:[a-z]+['’]s\s+)?(?:my |our |christmas |xmas |holiday |gift |santa )*(wish[ -]?list|list|ideas|gift ideas|gifts|things i like|stores i like|favorites)(?:\s+(?:for\s+)?(?:christmas|xmas|santa)?\s*(?:\d{4})?)?[!.]?$/i.test(
        line.replace(/[:*]+$/, "").trim(),
      )
    ) {
      continue;
    }

    // Several links on one line: each one becomes its own gift, named by the words in front of it.
    const split = splitLinks(line);
    if (split.pairs.length > 1) {
      split.pairs.forEach((pr, i) => {
        let words = pr.before;
        if (i === split.pairs.length - 1 && !tidy(stripShareNoise(words)) && tidy(split.after)) words = split.after;
        addGift(gifts, words, pr.url);
      });
      continue;
    }

    let url: string | null = null;
    if (split.pairs.length === 1) {
      url = split.pairs[0].url;
      line = split.pairs[0].before + " " + split.after;
    }
    let priceCents: number | null = null;
    const pm = line.match(PRICE_RE);
    if (pm) {
      priceCents = Math.round(parseFloat(pm[1].replace(/,/g, "")) * 100);
      line = line.replace(pm[0], " ");
    }
    let size: string | null = null;
    const sm = line.match(SIZE_RE);
    if (sm) {
      size = tidy(sm[1]);
      line = line.replace(sm[0], " ");
    }
    let color: string | null = null;
    const cm = line.match(COLOR_RE);
    if (cm) {
      color = tidy(cm[1]);
      line = line.replace(cm[0], " ");
    }
    let title = tidy(stripShareNoise(tidy(line)));
    let titleFromLink = false;

    // A lone link right under a title: attach it to that title.
    const prev = gifts[gifts.length - 1];
    if (!title && url && prev && !prev.url) {
      prev.url = url;
      prev.store = prev.store ?? storeFromUrl(url);
      if (priceCents != null && prev.priceCents == null) prev.priceCents = priceCents;
      continue;
    }
    if (!title && !url) continue;
    if (!title && url) {
      title = titleFromUrl(url);
      titleFromLink = true;
    }
    if (title.length > 140) title = title.slice(0, 137) + "...";

    gifts.push({ title, titleFromLink, url, priceCents, size: size || null, color: color || null, store: storeFromUrl(url) });
  }

  // The same link pasted twice only counts once.
  const seen = new Set<string>();
  const unique = gifts.filter((g) => {
    if (!g.url) return true;
    const k = g.url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { gifts: unique.slice(0, 60), avoid: avoid.join("\n").slice(0, 1500) };
}

function addGift(gifts: ParsedGift[], words: string, url: string) {
  let line = words;
  let priceCents: number | null = null;
  const pm = line.match(PRICE_RE);
  if (pm) {
    priceCents = Math.round(parseFloat(pm[1].replace(/,/g, "")) * 100);
    line = line.replace(pm[0], " ");
  }
  let title = tidy(stripShareNoise(tidy(line)));
  const titleFromLink = !title;
  if (!title) title = titleFromUrl(url);
  if (title.length > 140) title = title.slice(0, 137) + "...";
  gifts.push({ title, titleFromLink, url, priceCents, size: null, color: null, store: storeFromUrl(url) });
}

// Rich paste from Notes/Safari/Docs: keep link targets that would be lost as plain text.
export function htmlToListText(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^https?:/i.test(href)) return;
    // Link cards and linked words both end up as "words link" on their own line.
    if (!text || text === href) a.textContent = ` ${href} `;
    else if (!text.includes(href)) a.textContent = ` ${text} ${href} `;
  });
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p,div,li,h1,h2,h3,h4,tr").forEach((el) => el.append("\n"));
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n");
}
