export const MAX_PEOPLE = 60;
export const MAX_GIFTS = 60;
export const MAX_NOTES = 1500;
export const MAX_IMPORT = 20000;

export function formatMoney(cents: number | null | undefined, opts: { whole?: boolean } = {}): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  const whole = opts.whole ?? cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

// "$24.99", "24", "24.5" -> cents. Returns null for blank, NaN for junk.
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : NaN;
  const s = input.replace(/[$,\s]/g, "");
  if (!s) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

export function cleanUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Family titles read wrong alone ("See Grandma's wishlist"), so keep the name after them: "Grandma Rose".
const TITLES = /^(grandma|grandpa|granny|gramps|nana|nanna|papa|pop|pops|mimi|meme|memere|pepere|uncle|aunt|auntie|aunty|cousin|mr\.?|mrs\.?|ms\.?|dr\.?)$/i;
export function firstName(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && TITLES.test(words[0])) return `${words[0]} ${words[1]}`;
  return words[0] || name;
}

export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 1)}${"*".repeat(Math.max(2, u.length - 1))}@${d}`;
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

export function currentChristmasYear(now = new Date()) {
  // After Jan 15, people are planning for the coming Christmas.
  const y = now.getFullYear();
  return now.getMonth() === 0 && now.getDate() <= 15 ? y - 1 : y;
}
