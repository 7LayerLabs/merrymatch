"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Gift, ListChecks, LockOpen, LogOut, Mail, Settings2, ShoppingBag, Sparkles, Users, X } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { firstName } from "@/lib/format";
import { Logo } from "@/components/art";
import { Splash } from "@/components/Shells";
import { AuthFlow } from "@/components/AuthFlow";
import { AuthShell } from "@/components/Shells";
import { Avatar, Button } from "@/components/ui";
import { useExchange, type Model } from "@/components/exchange/useExchange";
import { MatchTab } from "@/components/exchange/MatchTab";
import { FamilyTab, MyListTab, ShoppingTab } from "@/components/exchange/ListTabs";
import { OrganizeTab } from "@/components/exchange/OrganizeTab";

type Tab = "match" | "list" | "family" | "shopping" | "organize";

export default function ExchangePage() {
  return (
    <Suspense fallback={<Splash />}>
      <ExchangeInner />
    </Suspense>
  );
}

function ExchangeInner() {
  const { isLoading, user } = db.useAuth();
  if (isLoading) return <Splash />;
  if (!user)
    return (
      <AuthShell>
        <AuthFlow heading="Sign in to see your exchange" />
      </AuthShell>
    );
  return <Loaded userId={user.id} email={user.email ?? ""} />;
}

function Loaded({ userId, email }: { userId: string; email: string }) {
  const { id } = useParams<{ id: string }>();
  const { isLoading, error, model } = useExchange(id, userId);
  if (isLoading) return <Splash label="Opening your exchange" />;
  if (error)
    return (
      <Center title="We couldn't load this exchange" body="Check your connection and refresh the page.">
        <Button onClick={() => location.reload()}>Refresh</Button>
      </Center>
    );
  if (!model)
    return (
      <Center title="This exchange isn't available" body="It may have been removed, or you're signed in with an email that isn't part of it.">
        <Link href="/">
          <Button>Go to my exchanges</Button>
        </Link>
        <Button variant="ghost" onClick={() => db.auth.signOut()}>
          Sign out of {email}
        </Button>
      </Center>
    );
  return <App m={model} email={email} />;
}

function Center({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 font-display text-[26px] font-semibold text-pine">{title}</h1>
      <p className="mt-2 max-w-sm text-[14px] text-muted">{body}</p>
      <div className="mt-6 flex flex-col items-center gap-2">{children}</div>
    </div>
  );
}

const TABS: { id: Tab; label: string; short: string; icon: typeof Gift }[] = [
  { id: "match", label: "My Match", short: "Match", icon: Mail },
  { id: "list", label: "My List", short: "My List", icon: ListChecks },
  { id: "family", label: "Family Lists", short: "Family", icon: Users },
  { id: "shopping", label: "My Shopping", short: "Shopping", icon: ShoppingBag },
  { id: "organize", label: "Organize", short: "Organize", icon: Settings2 },
];

function App({ m, email }: { m: Model; email: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const tabs = TABS.filter((t) => t.id !== "organize" || m.isAdmin);
  const initial = (search.get("tab") as Tab) || "match";
  const [tab, setTab] = useState<Tab>(tabs.some((t) => t.id === initial) ? initial : "match");
  const [person, setPerson] = useState<string | null>(search.get("person"));
  const [banner, setBanner] = useState<"welcome" | "created" | null>(
    search.get("welcome") ? "welcome" : search.get("created") ? "created" : null,
  );

  const go = useCallback(
    (t: string, p?: string) => {
      setTab(t as Tab);
      setPerson(p ?? null);
      const qs = new URLSearchParams();
      if (t !== "match") qs.set("tab", t);
      if (p) qs.set("person", p);
      router.replace(`/x/${m.ex.id}${qs.size ? `?${qs}` : ""}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, m.ex.id],
  );

  if (!m.me) {
    return (
      <Center
        title={`You're not in Christmas ${m.ex.year}`}
        body={m.meInGroup ? "The organizer didn't add you to this year. Ask them to bring you back in." : "This exchange belongs to a group you're not part of."}
      >
        <Link href="/">
          <Button>Go to my exchanges</Button>
        </Link>
      </Center>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-10">
      <Header m={m} email={email} tab={tab} tabs={tabs} go={go} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 sm:px-6 sm:pt-6">
        {m.ex.sealOpen ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-coral/15 px-4 py-3 text-[13.5px] text-[#7d3c2d] ring-1 ring-coral/30">
            <LockOpen className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">{m.ex.sealOpenedBy ?? "The organizer"} opened the sealed match list</span> on{" "}
              {new Date(m.ex.sealOpenedAt!).toLocaleDateString(undefined, { month: "long", day: "numeric" })}. Everyone sees this note so nothing
              happens in secret.
            </div>
          </div>
        ) : null}
        <AnimatePresence>
          {banner ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="mb-4 flex items-start gap-3 rounded-2xl bg-gold/25 px-4 py-3 text-[14px] ring-1 ring-gold/50"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-2" />
              <div className="flex-1">
                {banner === "welcome" ? (
                  <>
                    <span className="font-semibold text-pine">Welcome, {firstName(m.me.name)}!</span> Start your wishlist so your Secret Santa has
                    ideas. Next time, sign in on any device with {email || "your email"}.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-pine">Your exchange is ready.</span> Add your family below, then tap Copy invite next to each
                    name and text it to them.
                  </>
                )}
              </div>
              <button onClick={() => setBanner(null)} className="rounded-md p-0.5 text-muted hover:text-pine" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab + (tab === "family" ? person ?? "" : "")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {tab === "match" ? <MatchTab m={m} go={go} /> : null}
            {tab === "list" ? <MyListTab m={m} /> : null}
            {tab === "family" ? <FamilyTab m={m} person={person} setPerson={(p) => go("family", p ?? undefined)} /> : null}
            {tab === "shopping" ? <ShoppingTab m={m} go={go} /> : null}
            {tab === "organize" && m.isAdmin ? <OrganizeTab m={m} /> : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => go(t.id)} className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5" aria-current={active ? "page" : undefined}>
                {active ? <motion.span layoutId="mtab" className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-coral" /> : null}
                <t.icon className={`h-5 w-5 ${active ? "text-pine" : "text-muted"}`} />
                <span className={`text-[10.5px] font-semibold ${active ? "text-pine" : "text-muted"}`}>{t.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** "34 days to go" until Christmas morning of this exchange's year. Hidden once Christmas has passed. */
function Countdown({ year }: { year: number }) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((Date.UTC(year, 11, 25) - today) / 86400000);
  if (days < 0) return null;
  const label = days === 0 ? "Merry Christmas!" : days === 1 ? "Tomorrow!" : `${days} days to go`;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gold/25 px-2 py-[1px] text-[11px] font-bold text-[#7a5212]"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
        <path d="M6 0.5l1.5 3.4 3.7.4-2.8 2.5.8 3.6L6 8.6 2.8 10.4l.8-3.6L.8 4.3l3.7-.4z" fill="#d89136" />
      </svg>
      {label}
    </motion.span>
  );
}

function Header({ m, email, tab, tabs, go }: { m: Model; email: string; tab: Tab; tabs: typeof TABS; go: (t: string) => void }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [years, setYears] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu && !years) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setMenu(false);
        setYears(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu, years]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-paper/90 backdrop-blur">
      <div ref={ref} className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Home">
          <span className="hidden sm:inline">
            <Logo />
          </span>
          <span className="sm:hidden">
            <Logo className="[&>span:last-child]:hidden" />
          </span>
        </Link>
        <div className="relative min-w-0">
          <button
            onClick={() => m.years.length > 1 && setYears((x) => !x)}
            className={`flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1 text-left ${m.years.length > 1 ? "hover:bg-pine/[0.05]" : "cursor-default"}`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold leading-tight text-pine">{m.group.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-coral-2">Christmas {m.ex.year}</span>
                <Countdown year={m.ex.year} />
              </span>
            </span>
            {m.years.length > 1 ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : null}
          </button>
          {years ? (
            <div className="absolute left-0 top-12 z-40 w-48 overflow-hidden rounded-xl border border-[var(--line)] bg-card py-1 shadow-[var(--shadow-lg)]">
              {m.years.map((y) => (
                <button
                  key={y.id}
                  onClick={() => {
                    setYears(false);
                    router.push(`/x/${y.id}`);
                  }}
                  className={`block w-full px-3 py-2 text-left text-[14px] hover:bg-pine/[0.05] ${y.id === m.ex.id ? "font-bold text-pine" : ""}`}
                >
                  Christmas {y.year}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="ml-auto hidden items-center gap-1 rounded-2xl bg-pine/[0.05] p-1 sm:flex">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={`relative rounded-xl px-3 py-1.5 text-[13.5px] font-semibold transition ${active ? "text-cream" : "text-pine hover:text-pine-2"}`}
              >
                {active ? <motion.span layoutId="dtab" className="absolute inset-0 rounded-xl bg-pine" transition={{ type: "spring", stiffness: 420, damping: 34 }} /> : null}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="relative ml-auto sm:ml-1">
          <button onClick={() => setMenu((x) => !x)} className="rounded-full" aria-label="Account">
            <Avatar name={m.me?.name ?? "?"} avatar={m.me?.avatar} size={34} />
          </button>
          {menu ? (
            <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-xl border border-[var(--line)] bg-card shadow-[var(--shadow-lg)]">
              <div className="border-b border-[var(--line)] px-3 py-2.5">
                <div className="text-[14px] font-semibold">{m.me?.name}</div>
                <div className="truncate text-[12px] text-muted">{email}</div>
              </div>
              <Link href="/" className="block px-3 py-2 text-[13.5px] hover:bg-pine/[0.05]">
                All my exchanges
              </Link>
              <button onClick={() => db.auth.signOut().then(() => router.replace("/"))} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] text-coral-2 hover:bg-pine/[0.05]">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
