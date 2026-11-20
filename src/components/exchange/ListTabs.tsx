"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ClipboardPaste, Gift, History, NotebookPen, Plus, ShoppingBag, Star } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { firstName, formatMoney, MAX_GIFTS, MAX_NOTES, parseMoney } from "@/lib/format";
import { Avatar, Button, CandyBar, Empty, Pill, useToast } from "../ui";
import { Character, CHARACTERS, characterFor } from "../avatars";
import { claimView, GiftCard, GiftForm, ImportDialog, Thumb } from "./gifts";
import type { GiftT, Model, Person } from "./useExchange";

/* ---------------- My List ---------------- */

export function MyListTab({ m }: { m: Model }) {
  const toast = useToast();
  const me = m.me!;
  const mine = m.giftsByOwner.get(me.id) ?? [];
  const [editing, setEditing] = useState<GiftT | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const hasEarlier = m.years.some((y) => y.year < m.ex.year);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[22px] font-semibold text-pine">My wishlist</h2>
          <Pill>
            {mine.length} / {MAX_GIFTS}
          </Pill>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImporting(true)} icon={<ClipboardPaste className="h-3.5 w-3.5" />}>
              Paste a list
            </Button>
            <Button size="sm" onClick={() => setAdding(true)} icon={<Plus className="h-3.5 w-3.5" />}>
              Add gift
            </Button>
          </div>
        </div>
        <p className="mb-4 text-[13px] text-muted">
          Your family can see this list. You&apos;ll never see who reserved or bought anything, so the surprise stays a surprise.
        </p>
        {mine.length ? (
          <div className="grid gap-2.5">
            <AnimatePresence initial={false}>
              {mine.map((g) => (
                <GiftCard key={g.id} gift={g} mode="mine" budgetCents={m.ex.budgetCents} onEdit={() => setEditing(g)} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Empty
            icon={<Gift className="h-6 w-6" />}
            title="Your list is empty"
            body="Add a few things you'd love, or paste a whole list from your Notes app in one go."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" />}>
                  Add a gift
                </Button>
                <Button variant="secondary" onClick={() => setImporting(true)} icon={<ClipboardPaste className="h-4 w-4" />}>
                  Paste a list
                </Button>
              </div>
            }
          />
        )}
        {hasEarlier ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            loading={copying}
            icon={<History className="h-3.5 w-3.5" />}
            onClick={async () => {
              setCopying(true);
              try {
                const r = await api<{ added: number; year: number }>("copyLastYearGifts", { exchangeId: m.ex.id });
                toast.ok(r.added ? `Brought over ${r.added} from ${r.year}.` : `Everything from ${r.year} is already here.`);
              } catch (e) {
                toast.err(e);
              } finally {
                setCopying(false);
              }
            }}
          >
            Bring over last year&apos;s list
          </Button>
        ) : null}
      </div>
      <div className="grid content-start gap-4 lg:sticky lg:top-24">
        <CharacterCard m={m} />
        <NotesCard m={m} />
      </div>
      <GiftForm open={adding} onClose={() => setAdding(false)} exchangeId={m.ex.id} budgetCents={m.ex.budgetCents} />
      <GiftForm open={!!editing} onClose={() => setEditing(null)} exchangeId={m.ex.id} gift={editing} budgetCents={m.ex.budgetCents} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} exchangeId={m.ex.id} room={MAX_GIFTS - mine.length} budgetCents={m.ex.budgetCents} />
    </div>
  );
}

function CharacterCard({ m }: { m: Model }) {
  const toast = useToast();
  const me = m.me!;
  const current = characterFor(me.name, me.avatar).key;
  const [saving, setSaving] = useState<string | null>(null);
  const pick = async (key: string) => {
    if (key === current) return;
    setSaving(key);
    try {
      await api("setAvatar", { exchangeId: m.ex.id, avatar: key });
    } catch (e) {
      toast.err(e);
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <motion.span key={current} initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 14 }}>
          <Avatar name={me.name} avatar={me.avatar} size={46} />
        </motion.span>
        <div>
          <div className="font-display text-[17px] font-semibold text-pine">Your character</div>
          <p className="text-[12.5px] text-muted">Everyone sees it next to your name.</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {CHARACTERS.map((c) => {
          const on = c.key === current;
          return (
            <motion.button
              key={c.key}
              type="button"
              title={c.label}
              aria-label={c.label}
              aria-pressed={on}
              onClick={() => pick(c.key)}
              whileHover={{ y: -2, rotate: -4 }}
              whileTap={{ scale: 0.9 }}
              className={`relative mx-auto rounded-full transition ${on ? "ring-2 ring-coral ring-offset-2 ring-offset-card" : "opacity-80 hover:opacity-100"} ${
                saving === c.key ? "animate-pulse" : ""
              }`}
            >
              <Character name={me.name} avatar={c.key} size={40} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function NotesCard({ m }: { m: Model }) {
  const toast = useToast();
  const saved = m.me?.notes ?? "";
  const [notes, setNotes] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    if (!dirty) setNotes(saved);
  }
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-coral-2" />
        <div className="font-display text-[17px] font-semibold text-pine">Sizes, likes and please-avoids</div>
      </div>
      <p className="mt-1 text-[12.5px] text-muted">Shirt size, favorite stores, allergies, or anything you&apos;d rather not get.</p>
      <textarea
        className="input mt-3 min-h-[140px] resize-y text-[14px]"
        value={notes}
        maxLength={MAX_NOTES}
        onChange={(e) => {
          setNotes(e.target.value);
          setDirty(e.target.value !== saved);
        }}
        placeholder={"Shirt: L, shoes: 10.5\nLoves: Dunkin, LEGO, golf\nAvoid: candles, anything scented"}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11.5px] text-muted">
          {notes.length} / {MAX_NOTES}
        </span>
        <Button
          size="sm"
          disabled={!dirty}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("saveNotes", { exchangeId: m.ex.id, notes });
              setDirty(false);
              toast.ok("Notes saved.");
            } catch (e) {
              toast.err(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {dirty ? "Save notes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Family ---------------- */

export function FamilyTab({ m, person, setPerson }: { m: Model; person: string | null; setPerson: (id: string | null) => void }) {
  const others = m.people.filter((p) => p.id !== m.me?.id);
  const sorted = m.myMatch ? [...others.filter((p) => p.id === m.myMatch!.id), ...others.filter((p) => p.id !== m.myMatch!.id)] : others;
  const selected = person ? others.find((p) => p.id === person) : null;

  if (selected) return <PersonList m={m} p={selected} back={() => setPerson(null)} />;

  return (
    <div>
      <h2 className="font-display text-[22px] font-semibold text-pine">Family wishlists</h2>
      <p className="mb-4 mt-1 text-[13px] text-muted">Shop for your match, or pick up something extra for anyone. Reserve an item so nobody doubles up.</p>
      {sorted.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p, i) => {
            const gifts = m.giftsByOwner.get(p.id) ?? [];
            const open = gifts.filter((g) => !g.claim).length;
            const isMatch = m.myMatch?.id === p.id;
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                onClick={() => setPerson(p.id)}
                className={`card relative flex items-center gap-3 overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] ${
                  isMatch ? "ring-2 ring-gold" : ""
                }`}
              >
                {isMatch ? (
                  <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-xl bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-pine-3">
                    <Star className="h-3 w-3" /> Your match
                  </span>
                ) : null}
                <Avatar name={p.name} avatar={p.avatar} size={44} />
                <div className="min-w-0">
                  <div className="truncate font-display text-[17px] font-semibold text-pine">{p.name}</div>
                  <div className="text-[12.5px] text-muted">
                    {gifts.length ? `${gifts.length} ${gifts.length === 1 ? "idea" : "ideas"}, ${open} still open` : "No ideas yet"}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Gift className="h-6 w-6" />} title="Nobody else is here yet" body="Once your family joins, their lists show up here." />
      )}
    </div>
  );
}

function PersonList({ m, p, back }: { m: Model; p: Person; back: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const gifts = m.giftsByOwner.get(p.id) ?? [];
  const isMatch = m.myMatch?.id === p.id;

  const shop = async (g: GiftT, action: "reserve" | "purchase" | "release") => {
    setBusy(g.id);
    try {
      await api("shop", { giftId: g.id, action });
      toast.ok(
        action === "reserve"
          ? "Reserved. It's on your shopping list."
          : action === "purchase"
            ? "Marked as bought. Nice work."
            : "Released. Someone else can grab it now.",
      );
    } catch (e) {
      toast.err(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <button onClick={back} className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-pine">
        <ArrowLeft className="h-4 w-4" /> Everyone
      </button>
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-5">
        <Avatar name={p.name} avatar={p.avatar} size={56} ring={isMatch} />
        <div className="min-w-0 flex-1">
          {isMatch ? <div className="eyebrow text-coral-2">Your match</div> : null}
          <div className="font-display text-[24px] font-semibold leading-tight text-pine">{p.name}</div>
          <div className="text-[13px] text-muted">
            {gifts.length} {gifts.length === 1 ? "idea" : "ideas"}
            {m.ex.budgetCents != null ? `, limit ${formatMoney(m.ex.budgetCents)}` : ""}
          </div>
        </div>
        {p.notes ? (
          <div className="w-full whitespace-pre-line rounded-xl bg-paper p-3 text-[13.5px] text-ink/80 ring-1 ring-[var(--line)]">
            <div className="eyebrow mb-1 text-muted">Sizes, likes and please-avoids</div>
            {p.notes}
          </div>
        ) : null}
      </div>
      {gifts.length ? (
        <div className="grid gap-2.5 md:grid-cols-2">
          {gifts.map((g) => (
            <GiftCard
              key={g.id}
              gift={g}
              mode="shop"
              budgetCents={m.ex.budgetCents}
              claim={claimView(g, m.myClaimIds)}
              busy={busy === g.id}
              onShop={(a) => shop(g, a)}
            />
          ))}
        </div>
      ) : (
        <Empty
          icon={<Gift className="h-6 w-6" />}
          title={`${firstName(p.name)} hasn't added ideas yet`}
          body="Their list updates live, so check back. Their notes above might help in the meantime."
        />
      )}
    </div>
  );
}

/* ---------------- My Shopping ---------------- */

export function ShoppingTab({ m, go }: { m: Model; go: (tab: string, person?: string) => void }) {
  const rows = m.myRows;
  const cap = m.ex.budgetCents;
  const matchId = m.myMatch?.id;
  const forMatch = rows.filter((r) => r.recipientId === matchId);
  const extras = rows.filter((r) => r.recipientId !== matchId);
  const live = (r: (typeof rows)[number]) => r.status !== "removed";
  const spentMatch = forMatch.filter(live).reduce((s, r) => s + (r.priceCents ?? 0), 0);
  const spentAll = rows.filter(live).reduce((s, r) => s + (r.priceCents ?? 0), 0);
  const bought = rows.filter((r) => r.status.startsWith("purchased")).length;
  const pct = cap ? Math.min(100, (spentMatch / cap) * 100) : 0;
  const over = cap != null && spentMatch > cap;

  return (
    <div className="grid gap-5">
      <div className="relative overflow-hidden rounded-[28px] bg-pine p-6 text-cream sm:p-7">
        <div className="absolute -right-14 -top-14 h-52 w-52 rounded-full bg-gold/10" />
        <div className="relative grid gap-5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="eyebrow text-gold">{m.myMatch ? `For ${m.myMatch.name}` : "Your shopping so far"}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[40px] font-semibold leading-none">{formatMoney(m.myMatch ? spentMatch : spentAll) || "$0"}</span>
              {cap != null && m.myMatch ? <span className="text-[15px] text-cream/70">of {formatMoney(cap)}</span> : null}
            </div>
            {cap != null && m.myMatch ? (
              <div className="mt-4">
                <CandyBar pct={pct} over={over} dark />
              </div>
            ) : null}
            <div className="mt-2 text-[13px] text-cream/70">
              {!m.myMatch
                ? "Names haven't been drawn yet. Anything you reserve now counts as an extra gift."
                : over
                  ? `${formatMoney(spentMatch - cap!)} over the limit.`
                  : cap != null
                    ? `${formatMoney(cap - spentMatch)} left to spend.`
                    : "No spending limit set."}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            <Stat label="Items" value={String(rows.filter(live).length)} />
            <Stat label="Bought" value={String(bought)} />
            <Stat label="All gifts total" value={formatMoney(spentAll) || "$0"} className="col-span-2 sm:col-span-1" />
          </div>
        </div>
      </div>

      {!rows.length ? (
        <Empty
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Nothing on your shopping list yet"
          body="When you reserve or buy something from someone's wishlist, it shows up here with a running total."
          action={
            m.myMatch ? (
              <Button onClick={() => go("family", m.myMatch!.id)}>Shop {firstName(m.myMatch.name)}&apos;s list</Button>
            ) : (
              <Button onClick={() => go("family")}>Browse wishlists</Button>
            )
          }
        />
      ) : (
        <>
          {forMatch.length ? <RowGroup title={`For ${m.myMatch?.name ?? "your match"}`} rows={forMatch} m={m} /> : null}
          {extras.length ? <RowGroup title={m.myMatch ? "Extras for others" : "Reserved and bought"} rows={extras} m={m} /> : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-cream/60">{label}</div>
      <div className="font-display text-[22px] font-semibold">{value}</div>
    </div>
  );
}

function RowGroup({ title, rows, m }: { title: string; rows: Model["myRows"]; m: Model }) {
  return (
    <div>
      <h3 className="mb-2 font-display text-[18px] font-semibold text-pine">{title}</h3>
      <div className="card divide-y divide-[var(--line)] overflow-hidden">
        {rows.map((r) => (
          <ShopRow key={r.id} r={r} m={m} />
        ))}
      </div>
    </div>
  );
}

function ShopRow({ r, m }: { r: Model["myRows"][number]; m: Model }) {
  const gift = r.giftId ? m.giftsByOwner.get(r.recipientId ?? "")?.find((g) => g.id === r.giftId) : undefined;
  const who = m.people.find((x) => x.id === r.recipientId);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState(r.priceCents != null ? String(r.priceCents / 100) : "");
  const [lastPrice, setLastPrice] = useState(r.priceCents);
  if (r.priceCents !== lastPrice) {
    setLastPrice(r.priceCents);
    setPrice(r.priceCents != null ? String(r.priceCents / 100) : "");
  }
  const removed = r.status === "removed" || r.status === "purchased-removed";
  const bought = r.status.startsWith("purchased");

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.ok(ok);
    } catch (e) {
      toast.err(e);
    } finally {
      setBusy(false);
    }
  };

  const savePrice = () => {
    const c = parseMoney(price);
    if (Number.isNaN(c)) return toast.err("Price should be a number, like 24.99");
    if (c === (r.priceCents ?? null)) return;
    act(() => api("shop", { giftId: r.giftId, action: "price", priceCents: c }), "Price updated.");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="relative shrink-0">
        <div className="h-14 w-14 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
          {gift ? <Thumb gift={gift} compact /> : <Avatar name={r.recipientName} avatar={who?.avatar} size={56} />}
        </div>
        {gift ? (
          <span className="absolute -bottom-1.5 -right-1.5 rounded-full ring-2 ring-card">
            <Avatar name={r.recipientName} avatar={who?.avatar} size={22} />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{r.giftTitle}</div>
        <div className="text-[12.5px] text-muted">
          for {r.recipientName}
          {removed ? <span className="ml-2 font-semibold text-coral-2">Removed from their list</span> : null}
        </div>
      </div>
      {bought ? <Pill tone="pine">Bought</Pill> : removed ? null : <Pill tone="gold">Reserved</Pill>}
      {!removed ? (
        <div className="relative w-24">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">$</span>
          <input
            className="input py-1.5 pl-6 text-[13.5px]"
            value={price}
            inputMode="decimal"
            aria-label="Price paid"
            onChange={(e) => setPrice(e.target.value)}
            onBlur={savePrice}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </div>
      ) : (
        <span className="w-24 text-right text-[13.5px] font-semibold text-pine">{formatMoney(r.priceCents)}</span>
      )}
      <div className="flex gap-1">
        {!removed && !bought ? (
          <Button size="sm" loading={busy} onClick={() => act(() => api("shop", { giftId: r.giftId, action: "purchase" }), "Marked as bought.")}>
            Bought it
          </Button>
        ) : null}
        {!removed ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => act(() => api("shop", { giftId: r.giftId, action: "release" }), bought ? "Purchase undone." : "Released.")}
          >
            {bought ? "Undo" : "Release"}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" loading={busy} onClick={() => act(() => api("clearShoppingRow", { rowId: r.id }), "Cleared.")}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
