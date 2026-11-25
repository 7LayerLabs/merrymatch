import "server-only";
import { cleanUrl } from "@/lib/format";
import { storeFromUrl, type ParsedGift } from "@/lib/parseList";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const AI_MODEL = process.env.MERRY_AI_MODEL || "gemini-3.8-flash";

// Per-user sliding-window rate limit so nobody can accidentally hammer the API.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CALLS_PER_WINDOW = 25;
const userHits = new Map<string, number[]>();

export function checkAiRateLimit(userId: string): boolean {
  const now = Date.now();
  const prev = (userHits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX_CALLS_PER_WINDOW) {
    userHits.set(userId, prev);
    return false;
  }
  prev.push(now);
  userHits.set(userId, prev);
  if (userHits.size > 2000) {
    for (const [k, arr] of userHits) {
      if (!arr.length || now - arr[arr.length - 1] >= WINDOW_MS) userHits.delete(k);
    }
  }
  return true;
}

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

function stripDashes(s: string): string {
  return s.replace(/\s*\u2014\s*/g, ", ").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
}

function extractOutputText(payload: unknown): string {
  const obj = payload as { steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  const parts: string[] = [];
  for (const step of obj?.steps ?? []) {
    if (step?.type === "model_output") {
      for (const c of step.content ?? []) {
        if (c?.type === "text" && typeof c.text === "string") parts.push(c.text);
      }
    }
  }
  return parts.join("").trim();
}

async function callGeminiJson<T>(input: unknown, schema: Record<string, unknown>, timeoutMs = 25000): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new Error("NO_AI_KEY");
  }
  const r = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
      "Api-Revision": "2026-05-20",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      input,
      generation_config: { thinking_level: "low" },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const errObj = Array.isArray(data) ? data[0]?.error : (data as { error?: { message?: string } })?.error;
    throw new Error(errObj?.message || `Gemini request failed (${r.status})`);
  }
  const raw = extractOutputText(data);
  if (!raw) throw new Error("Empty AI response");
  return JSON.parse(raw) as T;
}

const WISHLIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["gifts", "avoid"],
  properties: {
    gifts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "url", "priceDollars", "store", "size", "color", "note"],
        properties: {
          title: { type: "string", description: "Clean item name without prices, sizes, or URLs." },
          url: { type: ["string", "null"], description: "Exact URL only if explicitly present in the input, else null." },
          priceDollars: { type: ["number", "null"], description: "Item price in USD dollars (e.g. 24.99), or null if unknown." },
          store: { type: ["string", "null"], description: "Store or brand name if mentioned or visible (e.g. Amazon, Target, L.L.Bean), else null." },
          size: { type: ["string", "null"], description: "Clothing/shoe/item size if mentioned, else null." },
          color: { type: ["string", "null"], description: "Preferred color if mentioned, else null." },
          note: { type: ["string", "null"], description: "Short helpful note or preference if mentioned, else null." },
        },
      },
    },
    avoid: {
      type: "string",
      description: "Newline-separated list of dislikes, allergies, or items/stores to avoid if mentioned, or empty string.",
    },
  },
};

export type AiParsedGift = ParsedGift & { note: string | null };

export async function aiParseWishlist(opts: {
  text?: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<{ gifts: AiParsedGift[]; avoid: string }> {
  const rawText = (opts.text || "").trim().slice(0, 15000);
  const img = (opts.imageBase64 || "").trim();
  const mime = (opts.imageMime || "").trim();

  const prompt = [
    "You are helping a family member import their Christmas wishlist into Merry Match.",
    "Read the supplied text and/or screenshot/photo (which may be a messy group text, conversational paragraph, handwritten list, Amazon/Target cart screenshot, or Notes screenshot).",
    "Extract every distinct gift idea into `gifts`, and put any dislikes, allergies, or 'please do not buy' notes into `avoid`.",
    "Rules:",
    "1. Keep `title` clean and readable (under 120 characters). Remove share-button clutter like 'Check out this deal on Amazon'.",
    "2. NEVER invent or guess web URLs. Set `url` ONLY if a real web link or domain path is explicitly written in the text; otherwise set `url` to null.",
    "3. Extract `priceDollars` (as a number like 29.99), `store`, `size`, `color`, and `note` when present.",
    "4. Plain English only. No emojis, no em dashes.",
    rawText ? `\nPASTED TEXT:\n${rawText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const inputParts: Array<Record<string, string>> = [{ type: "text", text: prompt }];
  if (img && /^image\/(jpeg|png|webp)$/i.test(mime)) {
    inputParts.push({
      type: "image",
      data: img,
      mime_type: mime.toLowerCase(),
    });
  }

  type RawOut = {
    gifts: Array<{
      title: string;
      url: string | null;
      priceDollars: number | null;
      store: string | null;
      size: string | null;
      color: string | null;
      note: string | null;
    }>;
    avoid: string;
  };

  const out = await callGeminiJson<RawOut>(inputParts, WISHLIST_SCHEMA);
  const lowerInput = rawText.toLowerCase();

  const seenUrls = new Set<string>();
  const gifts: AiParsedGift[] = [];

  for (const g of out.gifts ?? []) {
    const title = stripDashes(String(g.title || "")).slice(0, 140);
    let url: string | null = null;
    if (g.url && rawText) {
      const cleaned = cleanUrl(g.url);
      if (cleaned) {
        try {
          const host = new URL(cleaned).hostname.replace(/^www\./i, "").toLowerCase();
          if (lowerInput.includes(host) || (host === "amazon.com" && (lowerInput.includes("a.co") || lowerInput.includes("amzn.to")))) {
            url = cleaned;
          }
        } catch {
          url = null;
        }
      }
    }
    if (!title && !url) continue;
    if (url) {
      const key = url.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
    }
    const priceCents =
      typeof g.priceDollars === "number" && Number.isFinite(g.priceDollars) && g.priceDollars >= 0 && g.priceDollars <= 100000
        ? Math.round(g.priceDollars * 100)
        : null;
    const store = (g.store ? stripDashes(g.store).slice(0, 60) : "") || storeFromUrl(url) || null;
    const size = g.size ? stripDashes(g.size).slice(0, 40) || null : null;
    const color = g.color ? stripDashes(g.color).slice(0, 40) || null : null;
    const note = g.note ? stripDashes(g.note).slice(0, 300) || null : null;

    gifts.push({
      title: title || `Item from ${store ?? "link"}`,
      titleFromLink: !title && !!url,
      url,
      priceCents,
      store,
      size,
      color,
      note,
    });
    if (gifts.length >= 60) break;
  }

  const avoid = (out.avoid || "")
    .split(/\r?\n/)
    .map((line) => stripDashes(line))
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);

  return { gifts, avoid };
}

const SUGGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "priceDollars", "store", "why", "searchQuery"],
        properties: {
          title: { type: "string", description: "Specific, concrete gift name (brand/product style, not generic)." },
          priceDollars: { type: "number", description: "Realistic typical retail price in USD." },
          store: { type: "string", description: "Best store to buy it (e.g. Amazon, Target, Etsy, REI, L.L.Bean, Sephora)." },
          why: { type: "string", description: "One short plain-English sentence on why this fits them." },
          searchQuery: { type: "string", description: "Clean 3-6 word shopping search query to find this exact gift." },
        },
      },
    },
  },
};

export type SuggestedIdea = {
  title: string;
  priceCents: number;
  store: string;
  why: string;
  searchUrl: string;
};

function buildSearchUrl(store: string, query: string): string {
  const q = encodeURIComponent(query.trim());
  const s = store.toLowerCase();
  if (s.includes("amazon")) return `https://www.amazon.com/s?k=${q}`;
  if (s.includes("target")) return `https://www.target.com/s?searchTerm=${q}`;
  if (s.includes("etsy")) return `https://www.etsy.com/search?q=${q}`;
  if (s.includes("walmart")) return `https://www.walmart.com/search?q=${q}`;
  if (s.includes("best buy")) return `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`;
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${store} ${query}`.trim())}`;
}

export async function aiSuggestGiftIdeas(opts: {
  recipientName: string;
  budgetCents: number | null;
  existingGifts: Array<{ title: string; store?: string | null; priceCents?: number | null }>;
  notes: string;
  hint: string;
}): Promise<SuggestedIdea[]> {
  const budgetLine =
    opts.budgetCents != null
      ? `Spending limit: $${(opts.budgetCents / 100).toFixed(0)} (every idea MUST typically cost at or under $${(opts.budgetCents / 100).toFixed(0)}).`
      : "Spending limit: keep ideas practical and thoughtful ($20 to $75 range unless notes suggest otherwise).";

  const listSummary = opts.existingGifts.length
    ? opts.existingGifts.map((g) => `- ${g.title}${g.store ? ` (${g.store})` : ""}`).join("\n")
    : "(Their wishlist is empty right now.)";

  const prompt = [
    `You are a thoughtful Secret Santa gift scout helping someone shop for ${opts.recipientName}.`,
    budgetLine,
    opts.notes ? `\n${opts.recipientName}'s sizes, likes, and please-avoids:\n${opts.notes}` : "",
    `\nItems already on ${opts.recipientName}'s wishlist (do NOT repeat these exact items; suggest fresh complementary ideas):\n${listSummary}`,
    opts.hint ? `\nExtra hint from the shopper: ${opts.hint}` : "",
    "\nSuggest exactly 4 specific, real-world gifts you can actually buy online today.",
    "Rules:",
    "1. Strictly respect every allergy, dislike, or 'avoid' item in their notes.",
    "2. Be specific (for example ' Lodge 10-Inch Seasoned Cast Iron Skillet' instead of 'Cooking pan').",
    "3. Keep `why` to one short, warm plain-English sentence. No emojis and no em dashes.",
  ]
    .filter(Boolean)
    .join("\n");

  const out = await callGeminiJson<{
    ideas: Array<{ title: string; priceDollars: number; store: string; why: string; searchQuery: string }>;
  }>(prompt, SUGGEST_SCHEMA);

  return (out.ideas ?? []).slice(0, 4).map((item) => {
    const title = stripDashes(String(item.title || "")).slice(0, 120);
    const store = stripDashes(String(item.store || "Amazon")).slice(0, 50);
    const why = stripDashes(String(item.why || "")).slice(0, 220);
    const dollars = Number.isFinite(item.priceDollars) && item.priceDollars > 0 ? item.priceDollars : 25;
    const query = stripDashes(String(item.searchQuery || title)).slice(0, 100);
    return {
      title,
      priceCents: Math.round(dollars * 100),
      store,
      why,
      searchUrl: buildSearchUrl(store, query || title),
    };
  });
}
