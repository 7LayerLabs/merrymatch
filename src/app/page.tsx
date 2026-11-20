"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Lock, ShoppingBag, Sparkles, Users } from "lucide-react";
import { useEffect } from "react";
import { db } from "@/lib/db";
import { HeroScene, Logo, Snow, Starburst } from "@/components/art";
import { Splash } from "@/components/Shells";
import { Avatar, Button, CandyBar } from "@/components/ui";

export default function Home() {
  const { isLoading, user } = db.useAuth();
  if (isLoading) return <Splash />;
  return user ? <MyGroups userId={user.id} /> : <Landing />;
}

function MyGroups({ userId }: { userId: string }) {
  const router = useRouter();
  const { isLoading, data, error } = db.useQuery({
    members: { $: { where: { "user.id": userId } }, group: { exchanges: {} }, exchanges: {} },
  });
  const members = data?.members ?? [];
  const groups = members
    .filter((m) => m.group)
    .map((m) => {
      const mine = (m.exchanges ?? []).slice().sort((a, b) => b.year - a.year);
      const latest = mine[0] ?? (m.group!.exchanges ?? []).slice().sort((a, b) => b.year - a.year)[0];
      return { id: m.group!.id, name: m.group!.name, latest, me: m };
    });

  useEffect(() => {
    if (!isLoading && groups.length === 1 && groups[0].latest) router.replace(`/x/${groups[0].latest.id}`);
  }, [isLoading, groups, router]);

  if (isLoading || (groups.length === 1 && groups[0].latest)) return <Splash label="Opening your exchange" />;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="sm" onClick={() => db.auth.signOut()}>
          Sign out
        </Button>
      </header>
      <h1 className="mt-10 font-script text-[40px] leading-tight text-pine">Your exchanges</h1>
      {error ? <p className="mt-2 text-coral-2">We couldn&apos;t load your exchanges. Refresh to try again.</p> : null}
      <div className="mt-5 grid gap-3">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={g.latest ? `/x/${g.latest.id}` : "/"}
            className="card flex items-center justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
          >
            <div>
              <div className="font-display text-[19px] font-semibold text-pine">{g.name}</div>
              <div className="text-[13px] text-muted">{g.latest ? `Christmas ${g.latest.year}` : "No exchange yet"}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-pine" />
          </Link>
        ))}
        {!groups.length ? (
          <div className="card p-6 text-[14px] text-muted">
            You&apos;re signed in, but not in an exchange yet. If someone invited you, open the link they sent. Or start your own.
          </div>
        ) : null}
      </div>
      <Link href="/new" className="mt-6 inline-block">
        <Button variant="secondary" icon={<Sparkles className="h-4 w-4" />}>
          Start a new group
        </Button>
      </Link>
    </div>
  );
}

const POINTS = [
  { icon: Lock, title: "Truly secret", body: "Not even the organizer can peek. If the match list is ever opened, everyone is told." },
  { icon: ShoppingBag, title: "No double gifts", body: "Reserve an item and it's off the table for everyone else. The person who asked never knows." },
  { icon: Users, title: "Rules that make sense", body: "Spouses can't draw each other, no swapping pairs, and nobody gets the same person two years running." },
];

function Peek({ title, body, children, delay }: { title: string; body: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="flex flex-col">
      <div className="card relative h-[250px] overflow-hidden p-4">{children}</div>
      <div className="mt-3 px-1">
        <div className="font-display text-[18px] font-semibold text-pine">{title}</div>
        <div className="mt-0.5 text-[14px] text-muted">{body}</div>
      </div>
    </motion.div>
  );
}

const PEEK_CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  left: 50 + Math.cos(i * 0.9) * (28 + (i % 3) * 9),
  top: 46 + Math.sin(i * 0.9) * (30 + (i % 4) * 6),
  color: ["#edbd62", "#ce7e69", "#96bdb0", "#fdf6ea"][i % 4],
  rot: i * 37,
}));

function RevealPeek() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#2d5a49_0%,#214337_50%,#173127_100%)]">
      <Snow count={14} />
      <Starburst size={16} className="left-[12%] top-[16%]" />
      <Starburst size={11} color="#ce7e69" className="right-[14%] top-[24%]" delay={0.7} />
      {PEEK_CONFETTI.map((c, i) => (
        <span
          key={i}
          className="absolute h-2 w-1.5 rounded-[1px]"
          style={{ left: `${c.left}%`, top: `${c.top}%`, background: c.color, transform: `rotate(${c.rot}deg)` }}
        />
      ))}
      <motion.div
        className="absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-card text-center shadow-[0_18px_40px_-14px_rgba(0,0,0,.6)]"
        animate={{ rotate: [-2, 1.5, -2], y: [0, -5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="checker-band h-2 opacity-80" />
        <div className="px-3 pb-4 pt-3">
          <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-coral-2">You&apos;re shopping for</div>
          <div className="mt-1 font-script text-[38px] leading-none text-pine">Amy</div>
          <div className="mt-1.5 text-[10.5px] text-muted">Spending limit $50</div>
        </div>
      </motion.div>
    </div>
  );
}

const PEEK_ROWS: [string, string, string, string, boolean][] = [
  ["Stanley Quencher 40 oz", "Target", "$45", "#214337", true],
  ["Lululemon belt bag", "lululemon", "$38", "#edbd62", false],
  ["Silk pillowcase", "Amazon", "$29", "#96bdb0", false],
];

function ListPeek() {
  return (
    <div className="grid gap-2">
      <div className="mb-1 flex items-center gap-2">
        <Avatar name="Amy" avatar="reindeer" size={26} />
        <span className="text-[13px] font-semibold text-pine">Amy&apos;s wishlist</span>
      </div>
      {PEEK_ROWS.map(([t, store, price, color, reserved]) => (
        <div key={t} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white/70 p-2">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: color }}>
            <span className="absolute inset-y-0 left-1/2 w-[14%] -translate-x-1/2 bg-white/50" />
            <span className="absolute inset-x-0 top-1/2 h-[14%] -translate-y-1/2 bg-white/50" />
            <span className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card text-[9px] font-bold text-pine">
              {store[0].toUpperCase()}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold">{t}</span>
            {reserved ? (
              <span className="mt-0.5 inline-block rounded-full bg-pine/[0.07] px-1.5 text-[9.5px] font-semibold text-pine">Someone reserved this</span>
            ) : (
              <span className="block text-[10.5px] text-muted">{store}</span>
            )}
          </span>
          <span className="font-display text-[13px] font-semibold text-pine">{price}</span>
        </div>
      ))}
    </div>
  );
}

const PEEK_FACES = ["snowman", "gingerbread", "penguin", "elf", "santa", "star"];
const PEEK_RULES = ["Mike can't draw Lisa", "No swapping pairs", "Avoid last year's matches"];

function BudgetPeek() {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Your budget</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-[30px] font-semibold text-pine">$38</span>
        <span className="text-[13px] text-muted">of $50</span>
      </div>
      <div className="mt-2">
        <CandyBar pct={76} />
      </div>
      <div className="mt-1.5 text-[12px] text-muted">$12 left for Amy.</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PEEK_RULES.map((r) => (
          <span key={r} className="rounded-full bg-teal/35 px-2.5 py-1 text-[11px] font-semibold text-pine">
            {r}
          </span>
        ))}
      </div>
      <div className="mt-3 flex -space-x-2">
        {PEEK_FACES.map((a) => (
          <span key={a} className="rounded-full ring-2 ring-card">
            <Avatar name={a} avatar={a} size={30} />
          </span>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="flex-1">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/new" className="hidden sm:block">
            <Button size="sm">Start an exchange</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-6 px-5 pb-10 pt-4 md:grid-cols-[1.05fr_1fr] md:pt-10">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="eyebrow text-coral-2">Secret Santa, done right</div>
          <h1 className="mt-3 font-script text-[clamp(46px,7.6vw,78px)] leading-[1.02] text-pine">
            The family gift exchange, <em className="not-italic text-coral-2">minus</em> the group text.
          </h1>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-ink/75">
            Draw names, share wishlists, and keep everyone on budget. Every match stays a secret until you break the seal on your
            own envelope.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/new">
              <Button size="lg" icon={<Sparkles className="h-4 w-4 text-gold" />}>
                Start your exchange
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="secondary">
                I was invited
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-[12.5px] text-muted">Free for families. Works on any phone or computer, no app store needed.</p>
        </motion.div>
        <HeroScene className="mx-auto max-w-[540px]" />
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-14">
        <div className="relative overflow-hidden rounded-[32px] bg-pine px-6 py-12 text-cream sm:px-12">
          <Snow count={26} />
          <Starburst size={26} className="right-[8%] top-[12%]" />
          <Starburst size={16} color="#ce7e69" className="bottom-[14%] left-[6%]" delay={1} />
          <div className="relative">
            <div className="eyebrow text-gold">How it works</div>
            <h2 className="mt-2 font-script text-[clamp(34px,5vw,48px)] leading-tight">Three steps to Christmas morning</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                ["1", "Invite the family", "Add names, tap Copy invite, and text it. Each link works once, for one person."],
                ["2", "Make your lists", "Everyone adds what they'd love, plus sizes and anything to avoid."],
                ["3", "Draw names", "One tap. Everyone opens their envelope and starts shopping."],
              ].map(([n, t, b], i) => (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12 }}
                  className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold font-display text-[18px] font-bold text-pine-3">{n}</div>
                  <div className="mt-3 font-display text-[19px] font-semibold">{t}</div>
                  <div className="mt-1 text-[14px] text-cream/75">{b}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16">
        <div className="eyebrow text-coral-2">A peek inside</div>
        <h2 className="mt-1 font-script text-[clamp(34px,5vw,48px)] leading-tight text-pine">Everything in one cozy place</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <Peek title="The big reveal" body="Everyone breaks the seal on their own envelope and watches the name slide out." delay={0}>
            <RevealPeek />
          </Peek>
          <Peek title="Wishlists that work" body="Paste a list from your Notes app. Links, prices, sizes and pictures come through." delay={0.08}>
            <ListPeek />
          </Peek>
          <Peek title="Budget, handled" body="One spending limit per person, a running total, and fair rules everyone can see." delay={0.16}>
            <BudgetPeek />
          </Peek>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="grid gap-6 border-t border-[var(--line)] pt-10 sm:grid-cols-3">
          {POINTS.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/35 text-pine">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-[17px] font-semibold text-pine">{f.title}</div>
                <div className="mt-0.5 text-[13.5px] text-muted">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--line)] py-8 text-center text-[12.5px] text-muted">
        <Logo className="mb-2 scale-90" />
        <div>Made for families who&apos;d rather be wrapping than texting.</div>
      </footer>
    </div>
  );
}
