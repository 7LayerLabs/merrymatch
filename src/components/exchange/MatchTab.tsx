"use client";

import { motion } from "motion/react";
import { ArrowRight, Ban, Clock, Gift, Users } from "lucide-react";
import { api } from "@/lib/api";
import { firstName, formatMoney } from "@/lib/format";
import { EnvelopeReveal } from "../Envelope";
import { Avatar, Button, CandyBar, Pill } from "../ui";
import { Thumb } from "./gifts";
import type { Model } from "./useExchange";

export function MatchTab({ m, go }: { m: Model; go: (tab: string, person?: string) => void }) {
  const { ex, myAssignment, myMatch, drawn } = m;
  const budget = ex.budgetCents != null ? `Spending limit ${formatMoney(ex.budgetCents)}` : undefined;
  const matchGifts = myMatch ? m.giftsByOwner.get(myMatch.id) ?? [] : [];
  const joined = m.people.filter((p) => p.joinedAt).length;

  return (
    <div className="grid gap-5">
      {drawn && myAssignment && myMatch ? (
        <>
          {myAssignment.changedAt && !myAssignment.revealedAt ? (
            <div className="card flex items-start gap-3 border-gold/60 bg-gold/15 p-4 text-[14px]">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-2" />
              <div>
                <span className="font-semibold text-pine">You have a new match.</span> Someone joined or left the exchange, so your envelope was
                re-sealed with a new name. Anything you already bought still shows on My Shopping.
              </div>
            </div>
          ) : null}
          <EnvelopeReveal
            key={myAssignment.id + (myAssignment.changedAt ?? "")}
            name={myMatch.name}
            subtitle={budget}
            startOpen={!!myAssignment.revealedAt}
            onOpened={() => {
              api("markRevealed", { assignmentId: myAssignment.id }).catch(() => {});
            }}
          >
            <Button variant="gold" size="lg" onClick={() => go("family", myMatch.id)} icon={<Gift className="h-4 w-4" />}>
              See {firstName(myMatch.name)}&apos;s wishlist
            </Button>
          </EnvelopeReveal>

          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <Avatar name={myMatch.name} avatar={myMatch.avatar} size={44} ring />
                <div>
                  <div className="eyebrow text-coral-2">Your match</div>
                  <div className="font-script text-[28px] leading-tight text-pine">{myMatch.name}</div>
                </div>
                <Pill tone="teal" className="ml-auto">
                  {matchGifts.length} {matchGifts.length === 1 ? "idea" : "ideas"}
                </Pill>
              </div>
              {myMatch.notes ? (
                <div className="mt-4 whitespace-pre-line rounded-xl bg-paper p-3 text-[13.5px] text-ink/80 ring-1 ring-[var(--line)]">
                  <div className="eyebrow mb-1 text-muted">Sizes and notes</div>
                  {myMatch.notes}
                </div>
              ) : null}
              <div className="mt-4 grid gap-2">
                {matchGifts.slice(0, 3).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => go("family", myMatch.id)}
                    className="flex items-center gap-3 rounded-xl p-1.5 text-left text-[14px] transition hover:bg-pine/[0.04]"
                  >
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--line)] bg-white">
                      <Thumb gift={g} compact />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{g.title}</span>
                      {g.store ? <span className="block truncate text-[12px] text-muted">{g.store}</span> : null}
                    </span>
                    {g.priceCents != null ? <span className="shrink-0 font-semibold text-pine">{formatMoney(g.priceCents)}</span> : null}
                  </button>
                ))}
                {!matchGifts.length ? (
                  <p className="text-[13.5px] text-muted">{firstName(myMatch.name)} hasn&apos;t added any ideas yet. Check back soon.</p>
                ) : null}
              </div>
              <Button variant="secondary" className="mt-3 w-full" onClick={() => go("family", myMatch.id)} icon={<ArrowRight className="h-4 w-4" />}>
                Open the full list
              </Button>
            </div>
            <BudgetCard m={m} go={go} />
          </div>
        </>
      ) : drawn && !myAssignment ? (
        <div className="card p-6 text-[14px] text-muted">
          Names were drawn before you were added, so you don&apos;t have a match this year. You can still add your wishlist and shop for anyone.
        </div>
      ) : (
        <WaitingCard m={m} joined={joined} />
      )}
      <RulesCard m={m} />
    </div>
  );
}

function BudgetCard({ m, go }: { m: Model; go: (tab: string) => void }) {
  const forMatch = m.myRows.filter((r) => r.recipientId === m.myMatch?.id && !r.status.includes("removed"));
  const spent = forMatch.reduce((s, r) => s + (r.priceCents ?? 0), 0);
  const cap = m.ex.budgetCents;
  const pct = cap ? Math.min(100, (spent / cap) * 100) : 0;
  const over = cap != null && spent > cap;
  return (
    <div className="card p-5">
      <div className="eyebrow text-muted">Your budget</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-[30px] font-semibold text-pine">{formatMoney(spent)}</span>
        {cap != null ? <span className="text-[14px] text-muted">of {formatMoney(cap)}</span> : null}
      </div>
      {cap != null ? (
        <div className="mt-3">
          <CandyBar pct={pct} over={over} />
        </div>
      ) : null}
      <p className="mt-3 text-[13px] text-muted">
        {over
          ? `You're ${formatMoney(spent - cap!)} over the limit.`
          : cap != null
            ? `${formatMoney(cap - spent)} left for ${firstName(m.myMatch?.name ?? "your match")}.`
            : "No spending limit is set."}
      </p>
      <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => go("shopping")}>
        Go to My Shopping
      </Button>
    </div>
  );
}

function WaitingCard({ m, joined }: { m: Model; joined: number }) {
  const org = m.organizers[0]?.name;
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-pine p-6 text-cream sm:p-8">
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gold/10" />
      <div className="absolute -bottom-16 right-20 h-40 w-40 rounded-full bg-teal/10" />
      <div className="relative grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="eyebrow text-gold">Christmas {m.ex.year}</div>
          <h2 className="mt-1 font-display text-[clamp(24px,4vw,32px)] font-semibold leading-tight">Names haven&apos;t been drawn yet</h2>
          <p className="mt-2 max-w-md text-[14px] text-cream/75">
            {org ? `${org} will draw names` : "The organizer will draw names"} once everyone&apos;s in. Your envelope shows up right here. In the
            meantime, start your wishlist so your Secret Santa has ideas.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold">
              <Users className="h-3.5 w-3.5 text-gold" /> {joined} of {m.people.length} joined
            </span>
            {m.ex.budgetCents != null ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold">
                Limit {formatMoney(m.ex.budgetCents)} per person
              </span>
            ) : null}
          </div>
        </div>
        <motion.svg
          viewBox="0 0 160 110"
          className="mx-auto h-28 w-40"
          animate={{ y: [0, -6, 0], rotate: [0, -2, 0, 2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        >
          <rect x="4" y="4" width="152" height="100" rx="8" fill="#f8e9ce" />
          <path d="M4 12 L80 64 L156 12" stroke="#d9be8c" strokeWidth="2" fill="none" />
          <path d="M8 6 L80 58 L152 6" fill="#f1dcb5" />
          <circle cx="80" cy="58" r="13" fill="#ce7e69" stroke="#a24d3a" strokeWidth="2" />
          <text x="80" y="64" textAnchor="middle" fontFamily="Georgia" fontWeight="700" fontSize="15" fill="#fdf6ea">
            M
          </text>
        </motion.svg>
      </div>
    </div>
  );
}

function RulesCard({ m }: { m: Model }) {
  const rules = (m.ex.exclusions ?? []).filter((e) => e.from && e.to);
  const name = (id: string) => m.people.find((p) => p.id === id)?.name ?? "Someone";
  if (!rules.length && !m.ex.noSwapPairs && !m.ex.avoidLastYear) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Ban className="h-4 w-4 text-coral-2" />
        <div className="font-display text-[17px] font-semibold text-pine">Draw rules</div>
        {m.drawn ? <Pill className="ml-auto">Locked</Pill> : null}
      </div>
      <p className="mt-1 text-[13px] text-muted">Everyone sees the same rules, so the draw is fair and nobody wonders.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rules.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-[12.5px] ring-1 ring-[var(--line)]">
            <span className="font-semibold">{name(r.from!.id)}</span>
            <span className="text-muted">can&apos;t draw</span>
            <span className="font-semibold">{name(r.to!.id)}</span>
          </span>
        ))}
        {m.ex.noSwapPairs ? <Pill tone="teal">No swapping pairs</Pill> : null}
        {m.ex.avoidLastYear ? <Pill tone="teal">Avoid last year&apos;s matches</Pill> : null}
      </div>
    </div>
  );
}
