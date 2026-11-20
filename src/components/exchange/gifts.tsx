"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, FileUp, Link2, Pencil, ShoppingBag, Sparkles, Trash2, Undo2, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatMoney, hostOf, parseMoney, MAX_IMPORT } from "@/lib/format";
import { htmlToListText, parseList, storeFromUrl, type ParsedGift } from "@/lib/parseList";
import { Button, Confirm, Field, Modal, Pill, avatarColors, useToast } from "../ui";
import type { GiftT } from "./useExchange";

export type ClaimView = "none" | "mine-reserved" | "mine-purchased" | "other-reserved" | "other-purchased";

export function claimView(gift: GiftT, myClaimIds: Set<string>): ClaimView {
  const c = gift.claim;
  if (!c) return "none";
  const mine = myClaimIds.has(c.id);
  if (c.status === "purchased") return mine ? "mine-purchased" : "other-purchased";
  return mine ? "mine-reserved" : "other-reserved";
}

export function Thumb({ gift, compact }: { gift: GiftT; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const [bg, fg] = avatarColors(gift.store || gift.title);
  if (gift.imageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={gift.imageUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`h-full w-full object-contain ${compact ? "p-1" : "p-2"}`}
      />
    );
  }
  return (
    <div className="relative flex h-full w-full items-center justify-center" style={{ background: bg }}>
      <div className="absolute inset-y-0 left-1/2 w-[14%] -translate-x-1/2 opacity-60" style={{ background: fg }} />
      <div className="absolute inset-x-0 top-1/2 h-[14%] -translate-y-1/2 opacity-60" style={{ background: fg }} />
      {compact ? (
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-card/95 font-display text-[12px] font-bold text-pine">
          {(gift.store || hostOf(gift.url) || gift.title).trim().charAt(0).toUpperCase()}
        </span>
      ) : (
        <span className="relative max-w-[88%] truncate whitespace-nowrap rounded-full bg-card/90 px-2 py-0.5 font-display text-[11.5px] font-semibold text-pine">
          {gift.store || hostOf(gift.url) || gift.title}
        </span>
      )}
    </div>
  );
}

export function GiftCard({
  gift,
  budgetCents,
  mode,
  claim = "none",
  onEdit,
  onShop,
  busy,
}: {
  gift: GiftT;
  budgetCents?: number | null;
  mode: "mine" | "shop";
  claim?: ClaimView;
  onEdit?: () => void;
  onShop?: (action: "reserve" | "purchase" | "release") => void;
  busy?: boolean;
}) {
  const over = budgetCents != null && gift.priceCents != null && gift.priceCents > budgetCents;
  const taken = claim === "other-reserved" || claim === "other-purchased";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`card group flex gap-3 p-3 ${taken ? "opacity-70" : ""}`}
    >
      <div className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
        <Thumb gift={gift} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink">{gift.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
              {gift.store ? <span>{gift.store}</span> : null}
              {gift.size ? <span>Size {gift.size}</span> : null}
              {gift.color ? <span>{gift.color}</span> : null}
            </div>
          </div>
          {gift.priceCents != null ? (
            <div className="shrink-0 font-display text-[16px] font-semibold text-pine">{formatMoney(gift.priceCents)}</div>
          ) : null}
        </div>
        {gift.note ? <div className="mt-1 line-clamp-2 text-[12.5px] italic text-ink/70">{gift.note}</div> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {over ? <Pill tone="coral">Over the {formatMoney(budgetCents)} limit</Pill> : null}
          {claim === "mine-reserved" ? <Pill tone="gold">You reserved this</Pill> : null}
          {claim === "mine-purchased" ? (
            <Pill tone="pine">
              <Check className="h-3 w-3" /> You bought this
            </Pill>
          ) : null}
          {claim === "other-reserved" ? <Pill>Someone reserved this</Pill> : null}
          {claim === "other-purchased" ? <Pill>Someone bought this</Pill> : null}
          <div className="ml-auto flex items-center gap-1">
            {gift.url ? (
              <a
                href={gift.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-semibold text-pine hover:bg-pine/[0.06]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
            ) : null}
            {mode === "mine" && onEdit ? (
              <Button size="sm" variant="ghost" onClick={onEdit} icon={<Pencil className="h-3.5 w-3.5" />}>
                Edit
              </Button>
            ) : null}
            {mode === "shop" && onShop ? (
              claim === "none" ? (
                <>
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => onShop("reserve")}>
                    Reserve
                  </Button>
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => onShop("purchase")} icon={<ShoppingBag className="h-3.5 w-3.5" />}>
                    Bought it
                  </Button>
                </>
              ) : claim === "mine-reserved" ? (
                <>
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => onShop("release")}>
                    Release
                  </Button>
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => onShop("purchase")} icon={<ShoppingBag className="h-3.5 w-3.5" />}>
                    Bought it
                  </Button>
                </>
              ) : claim === "mine-purchased" ? (
                <Button size="sm" variant="ghost" loading={busy} onClick={() => onShop("release")} icon={<Undo2 className="h-3.5 w-3.5" />}>
                  Undo
                </Button>
              ) : null
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Add / edit ---------------- */

type Draft = { title: string; url: string; price: string; store: string; size: string; color: string; imageUrl: string; note: string };
const blank: Draft = { title: "", url: "", price: "", store: "", size: "", color: "", imageUrl: "", note: "" };

export function GiftForm({
  open,
  onClose,
  exchangeId,
  gift,
  budgetCents,
}: {
  open: boolean;
  onClose: () => void;
  exchangeId: string;
  gift?: GiftT | null;
  budgetCents?: number | null;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastOpen, setLastOpen] = useState<string | null>(null);

  const key = open ? gift?.id ?? "new" : null;
  if (key !== lastOpen) {
    setLastOpen(key);
    if (open) {
      setError("");
      setD(
        gift
          ? {
              title: gift.title,
              url: gift.url ?? "",
              price: gift.priceCents != null ? String(gift.priceCents / 100) : "",
              store: gift.store ?? "",
              size: gift.size ?? "",
              color: gift.color ?? "",
              imageUrl: gift.imageUrl ?? "",
              note: gift.note ?? "",
            }
          : blank,
      );
    }
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  const priceCents = parseMoney(d.price);
  const over = budgetCents != null && typeof priceCents === "number" && !Number.isNaN(priceCents) && priceCents > budgetCents;

  const fill = async () => {
    if (!d.url.trim()) return setError("Paste a product link first.");
    setFilling(true);
    setError("");
    try {
      const p = await api<{ title?: string; imageUrl?: string; priceCents?: number | null; store?: string | null; size?: string; color?: string; fetched: boolean }>(
        "preview",
        { url: d.url },
      );
      setD((x) => ({
        ...x,
        title: x.title || p.title || "",
        imageUrl: p.imageUrl || x.imageUrl,
        price: x.price || (p.priceCents != null ? String(p.priceCents / 100) : ""),
        store: x.store || p.store || "",
        size: x.size || p.size || "",
        color: x.color || p.color || "",
      }));
      if (!p.fetched || (!p.title && !p.imageUrl)) toast.ok("That store doesn't share details. Fill in the rest by hand.");
      else toast.ok("Filled in from the link. Double-check size and price.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFilling(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!d.title.trim()) return setError("Give the gift a name.");
    if (Number.isNaN(priceCents)) return setError("Price should be a number, like 24.99");
    setBusy(true);
    try {
      await api("saveGift", {
        exchangeId,
        giftId: gift?.id,
        title: d.title,
        url: d.url,
        priceCents,
        store: d.store || (d.url ? storeFromUrl(d.url) : ""),
        size: d.size,
        color: d.color,
        imageUrl: d.imageUrl,
        note: d.note,
      });
      toast.ok(gift ? "Saved." : "Added to your list.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={() => !busy && onClose()} title={gift ? "Edit gift" : "Add a gift"}>
        <form onSubmit={save} className="grid gap-3.5">
          <Field label="Link (optional)" hint="Paste a product link and tap Fill in to grab the name, photo and price.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input className="input pl-9" value={d.url} onChange={set("url")} placeholder="https://..." inputMode="url" />
              </div>
              <Button type="button" variant="secondary" onClick={fill} loading={filling} icon={<Wand2 className="h-4 w-4" />}>
                Fill in
              </Button>
            </div>
          </Field>
          <Field label="What is it?">
            <input className="input" value={d.title} onChange={set("title")} placeholder="Cozy wool socks" maxLength={140} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                <input className="input pl-7" value={d.price} onChange={set("price")} inputMode="decimal" placeholder="0.00" />
              </div>
            </Field>
            <Field label="Store">
              <input className="input" value={d.store} onChange={set("store")} placeholder="Target" maxLength={60} />
            </Field>
            <Field label="Size">
              <input className="input" value={d.size} onChange={set("size")} placeholder="M, 10, etc." maxLength={40} />
            </Field>
            <Field label="Color">
              <input className="input" value={d.color} onChange={set("color")} placeholder="Navy" maxLength={40} />
            </Field>
          </div>
          <Field label="Note (optional)">
            <textarea className="input min-h-[64px] resize-y" value={d.note} onChange={set("note")} placeholder="Any color but yellow" maxLength={400} />
          </Field>
          {d.imageUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.imageUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-lg object-contain" />
              <span className="flex-1 text-[12.5px] text-muted">Photo from the store</span>
              <button type="button" className="text-[12.5px] font-semibold text-muted hover:text-coral-2" onClick={() => setD((x) => ({ ...x, imageUrl: "" }))}>
                Remove photo
              </button>
            </div>
          ) : null}
          {over ? (
            <p className="rounded-xl bg-coral/12 px-3 py-2 text-[12.5px] text-coral-2">
              This is over the {formatMoney(budgetCents)} limit. That&apos;s fine, it stays on your list, and shoppers will see a heads-up.
            </p>
          ) : null}
          {error ? <p className="text-[13px] font-medium text-coral-2">{error}</p> : null}
          <div className="mt-1 flex items-center gap-2">
            {gift ? (
              <Button type="button" variant="ghost" className="text-coral-2" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" />}>
                Delete
              </Button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                {gift ? "Save" : "Add gift"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Remove this gift?"
        body={<>&ldquo;{gift?.title}&rdquo; will come off your list. If someone already bought it, they&apos;ll get a heads-up on their shopping list.</>}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          try {
            await api("deleteGift", { giftId: gift!.id });
            toast.ok("Removed from your list.");
            onClose();
          } catch (e) {
            toast.err(e);
          }
        }}
      />
    </>
  );
}

/* ---------------- Import ---------------- */

type Row = ParsedGift & { keep: boolean; price: string; imageUrl?: string; looking?: boolean };

type PreviewResult = { title?: string; imageUrl?: string; priceCents?: number | null; store?: string | null; fetched: boolean };

export function ImportDialog({
  open,
  onClose,
  exchangeId,
  room,
  budgetCents,
}: {
  open: boolean;
  onClose: () => void;
  exchangeId: string;
  room: number;
  budgetCents?: number | null;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [avoid, setAvoid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const run = useRef(0);
  const [lookup, setLookup] = useState<{ done: number; total: number } | null>(null);

  // Look up every link (three at a time) and fill in the real name, price and picture.
  const fillFromLinks = async (list: Row[]) => {
    const mine = ++run.current;
    const todo = list.map((r, i) => (r.url ? i : -1)).filter((i) => i >= 0);
    if (!todo.length) return;
    let done = 0;
    setLookup({ done: 0, total: todo.length });
    const patch = (i: number, fn: (r: Row) => Row) => {
      if (run.current === mine) setRows((x) => (x ? x.map((y, j) => (j === i ? fn(y) : y)) : x));
    };
    const worker = async () => {
      while (todo.length && run.current === mine) {
        const i = todo.shift()!;
        patch(i, (r) => ({ ...r, looking: true }));
        let p: PreviewResult | null = null;
        try {
          p = await api<PreviewResult>("preview", { url: list[i].url });
        } catch {
          p = null;
        }
        patch(i, (r) => ({
          ...r,
          looking: false,
          title: p?.title && r.titleFromLink ? p.title : r.title,
          titleFromLink: p?.title && r.titleFromLink ? false : r.titleFromLink,
          price: !r.price && p?.priceCents != null ? String(p.priceCents / 100) : r.price,
          imageUrl: p?.imageUrl ?? r.imageUrl,
          store: r.store ?? p?.store ?? null,
        }));
        done++;
        if (run.current === mine) setLookup({ done, total: list.filter((r) => r.url).length });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (run.current === mine) setLookup(null);
  };

  const reset = () => {
    run.current++;
    setLookup(null);
    setText("");
    setRows(null);
    setAvoid("");
    setError("");
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const review = () => {
    setError("");
    if (/^\s*https:\/\/(www\.)?icloud\.com\/notes\//i.test(text.trim()) && text.trim().split(/\s+/).length === 1) {
      return setError("That's a link to a shared note. Open the note, select everything, copy it, and paste it here instead.");
    }
    const parsed = parseList(text);
    if (!parsed.gifts.length && !parsed.avoid) return setError("We couldn't find any items. Put one gift per line and try again.");
    const next = parsed.gifts.map((g) => ({ ...g, keep: true, price: g.priceCents != null ? String(g.priceCents / 100) : "" }));
    setRows(next);
    setAvoid(parsed.avoid);
    void fillFromLinks(next);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (html && /<a\s/i.test(html)) {
      const converted = htmlToListText(html);
      if (converted.trim()) {
        e.preventDefault();
        const el = e.currentTarget;
        const next = text.slice(0, el.selectionStart) + converted + text.slice(el.selectionEnd);
        setText(next.slice(0, MAX_IMPORT));
      }
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 200_000) return setError("That file is too big. Try a shorter list.");
    if (!/\.(txt|md|markdown|text)$/i.test(f.name) && !f.type.startsWith("text/")) return setError("Choose a .txt or .md file.");
    setText((await f.text()).slice(0, MAX_IMPORT));
  };

  const kept = rows?.filter((r) => r.keep && r.title.trim()) ?? [];

  const save = async () => {
    setError("");
    const bad = kept.find((r) => Number.isNaN(parseMoney(r.price)));
    if (bad) return setError(`Check the price on "${bad.title}".`);
    if (kept.length > room) return setError(`You have room for ${room} more. Untick a few.`);
    setBusy(true);
    try {
      const r = await api<{ added: number }>("importGifts", {
        exchangeId,
        gifts: kept.map((x) => ({
          title: x.title,
          url: x.url,
          priceCents: parseMoney(x.price),
          store: x.store,
          size: x.size,
          color: x.color,
          imageUrl: x.imageUrl?.startsWith("https://") ? x.imageUrl : null,
        })),
        avoid,
      });
      toast.ok(`Added ${r.added} ${r.added === 1 ? "gift" : "gifts"} to your list.`);
      reset();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={rows ? "Check your list" : "Paste your list"} wide>
      <AnimatePresence mode="wait">
        {!rows ? (
          <motion.div key="paste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-[13.5px] text-muted">
              Copy your list from Apple Notes, a text, or anywhere else, and paste it below. Every link gets pulled out, even several on one
              line, and we look up each one for its name, price and picture. Add a line that says{" "}
              <span className="font-semibold text-ink">Avoid:</span> for things you don&apos;t want.
            </p>
            <textarea
              className="input mt-3 min-h-[220px] resize-y font-mono text-[13px]"
              value={text}
              onPaste={onPaste}
              onChange={(e) => setText(e.target.value.slice(0, MAX_IMPORT))}
              placeholder={"Wool socks, size L $18\nAirPods case https://www.amazon.com/...\nCookbook from Barnes & Noble\n\nAvoid:\nCandles\nGift cards to Olive Garden"}
              autoFocus
            />
            <div className="mt-1 text-right text-[11.5px] text-muted">
              {text.length.toLocaleString()} / {MAX_IMPORT.toLocaleString()}
            </div>
            {error ? <p className="mt-1 text-[13px] font-medium text-coral-2">{error}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button variant="ghost" onClick={() => fileRef.current?.click()} icon={<FileUp className="h-4 w-4" />}>
                Upload a file
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button onClick={review} disabled={!text.trim()} icon={<Sparkles className="h-4 w-4 text-gold" />}>
                  Read my list
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-[13.5px] text-muted">
              Found {rows.length} {rows.length === 1 ? "item" : "items"}
              {rows.some((r) => r.url) ? ` and ${rows.filter((r) => r.url).length} ${rows.filter((r) => r.url).length === 1 ? "link" : "links"}` : ""}.
              Fix anything that looks off and untick what you don&apos;t want.
            </p>
            {lookup ? (
              <div className="mt-2 rounded-xl bg-teal/20 px-3 py-2 text-[12.5px] font-semibold text-pine">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 animate-pulse" />
                  Getting names, prices and pictures from your links... {lookup.done} of {lookup.total}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/70">
                  <motion.div className="h-full rounded-full bg-pine" animate={{ width: `${(lookup.done / lookup.total) * 100}%` }} />
                </div>
              </div>
            ) : null}
            <div className="mt-3 grid max-h-[46dvh] gap-2 overflow-y-auto pr-1">
              {rows.map((r, i) => {
                const pc = parseMoney(r.price);
                const over = budgetCents != null && typeof pc === "number" && pc > budgetCents;
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-xl border border-[var(--line)] bg-white p-2.5 ${r.keep ? "" : "opacity-50"}`}>
                    <input
                      type="checkbox"
                      className="mt-2.5 h-4 w-4 accent-[#214337]"
                      checked={r.keep}
                      onChange={(e) => setRows((x) => x!.map((y, j) => (j === i ? { ...y, keep: e.target.checked } : y)))}
                      aria-label="Keep this item"
                    />
                    <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg border border-[var(--line)] bg-paper">
                      {r.looking ? (
                        <div className="skeleton h-full w-full rounded-none" />
                      ) : r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted">
                          {r.url ? <Link2 className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                        </div>
                      )}
                    </div>
                    <div className="grid min-w-0 flex-1 gap-1.5">
                      <input
                        className="input py-1.5 text-[14px]"
                        value={r.title}
                        onChange={(e) => setRows((x) => x!.map((y, j) => (j === i ? { ...y, title: e.target.value, titleFromLink: false } : y)))}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2">$</span>
                          <input
                            className="input py-1 pl-5 text-[13px]"
                            value={r.price}
                            placeholder="Price"
                            inputMode="decimal"
                            onChange={(e) => setRows((x) => x!.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))}
                          />
                        </div>
                        {r.store ? <Pill>{r.store}</Pill> : null}
                        {r.size ? <Pill>Size {r.size}</Pill> : null}
                        {r.url ? <Pill tone="teal">Link</Pill> : null}
                        {over ? <Pill tone="coral">Over limit</Pill> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {avoid ? (
              <Field label="Added to your notes" className="mt-3">
                <textarea className="input min-h-[60px] text-[13px]" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
              </Field>
            ) : null}
            {error ? <p className="mt-2 text-[13px] font-medium text-coral-2">{error}</p> : null}
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  run.current++;
                  setLookup(null);
                  setRows(null);
                }}
              >
                Back
              </Button>
              <Button className="ml-auto" loading={busy} disabled={!kept.length && !avoid.trim()} onClick={save}>
                Add {kept.length} to my list
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
