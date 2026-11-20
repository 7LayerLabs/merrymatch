"use client";

import { motion } from "motion/react";
import {
  Ban,
  CalendarPlus,
  Check,
  Copy,
  Download,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  Settings2,
  Shuffle,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { firstName, formatMoney, isEmail } from "@/lib/format";
import { Avatar, Button, Confirm, Field, Modal, Pill, Toggle, copyText, useToast } from "../ui";
import type { Model, Person } from "./useExchange";

export function OrganizeTab({ m }: { m: Model }) {
  const joined = m.people.filter((p) => p.joinedAt).length;
  const withLists = m.people.filter((p) => (m.giftsByOwner.get(p.id) ?? []).length > 0).length;
  const steps = [
    { label: "Add people", done: m.people.length >= 3 },
    { label: "Everyone joined", done: joined === m.people.length && m.people.length >= 3 },
    { label: "Names drawn", done: m.drawn },
  ];
  return (
    <div className="grid gap-5">
      <div className="card overflow-hidden">
        <div className="checker-band h-2 opacity-70" />
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="eyebrow text-coral-2">Organizer</div>
            <h2 className="font-display text-[24px] font-semibold text-pine">{m.ex.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {steps.map((s, i) => (
                <span
                  key={s.label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold ${
                    s.done ? "bg-pine text-cream" : "bg-pine/[0.06] text-pine"
                  }`}
                >
                  {s.done ? <Check className="h-3.5 w-3.5 text-gold" /> : <span className="text-muted">{i + 1}</span>}
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <Big n={m.people.length} label="people" />
            <Big n={joined} label="joined" />
            <Big n={withLists} label="have lists" />
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <DrawCard m={m} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid content-start gap-5">
          <PeopleCard m={m} />
          <RulesEditor m={m} />
        </div>
        <div className="grid content-start gap-5">
          <div className="hidden lg:block">
            <DrawCard m={m} />
          </div>
          <SettingsCard m={m} />
          <ToolsCard m={m} />
        </div>
      </div>
    </div>
  );
}

function Big({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display text-[28px] font-semibold leading-none text-pine">{n}</div>
      <div className="mt-1 text-[11.5px] font-semibold uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

function SectionTitle({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-coral-2">{icon}</span>
      <h3 className="font-display text-[18px] font-semibold text-pine">{title}</h3>
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}

/* ---------------- People ---------------- */

function inviteMessage(name: string, group: string, year: number, url: string) {
  return `Hi ${firstName(name)}! You're in the ${group} Secret Santa for Christmas ${year}. Tap this link to join and add your wishlist:\n\n${url}\n\nThis link is just for you and works one time.`;
}

function PeopleCard({ m }: { m: Model }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const returning = (m.group.members ?? []).filter((gm) => !m.people.some((p) => p.id === gm.id));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter a name.");
    if (email && !isEmail(email)) return setError("That email doesn't look right.");
    setBusy(true);
    try {
      const r = await api<{ rewired: boolean }>("addMember", { exchangeId: m.ex.id, name, email: email || undefined });
      toast.ok(r.rewired ? `${name.trim()} is in, and slotted into the draw.` : `${name.trim()} added. Now send their invite.`);
      setName("");
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <SectionTitle icon={<Users className="h-4 w-4" />} title="People" right={<Pill>{m.people.length}</Pill>} />
      <div className="grid gap-1">
        {m.people.map((p) => (
          <PersonRow key={p.id} p={p} m={m} />
        ))}
      </div>

      <form onSubmit={add} className="mt-4 rounded-2xl bg-paper p-3 ring-1 ring-[var(--line)]">
        <div className="flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name, like Aunt Linda" maxLength={40} />
          <Button type="submit" loading={busy} icon={<UserPlus className="h-4 w-4" />}>
            Add
          </Button>
        </div>
        {showEmail ? (
          <input
            className="input mt-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Their email (optional)"
            inputMode="email"
            autoComplete="off"
          />
        ) : (
          <button type="button" onClick={() => setShowEmail(true)} className="mt-2 text-[12.5px] font-semibold text-muted hover:text-pine">
            + Lock their invite to an email address
          </button>
        )}
        {error ? <p className="mt-2 text-[13px] font-medium text-coral-2">{error}</p> : null}
        {m.drawn ? (
          <p className="mt-2 text-[12px] text-muted">Names are already drawn. New people get slotted in, and one person gets a new match.</p>
        ) : null}
      </form>

      {returning.length ? (
        <div className="mt-4">
          <div className="eyebrow mb-2 text-muted">From past years</div>
          <div className="flex flex-wrap gap-2">
            {returning.map((r) => (
              <button
                key={r.id}
                onClick={async () => {
                  try {
                    await api("addMember", { exchangeId: m.ex.id, memberId: r.id });
                    toast.ok(`${r.name} is back for ${m.ex.year}.`);
                  } catch (e) {
                    toast.err(e);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[13px] font-semibold text-pine ring-1 ring-[var(--line-2)] hover:bg-white"
              >
                <UserPlus className="h-3.5 w-3.5" /> {r.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PersonRow({ p, m }: { p: Person; m: Model }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<"remove" | "reset" | null>(null);
  const [link, setLink] = useState<{ url: string; message: string } | null>(null);
  const isMe = p.id === m.me?.id;
  const giftCount = (m.giftsByOwner.get(p.id) ?? []).length;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const invite = async () => {
    setBusy(true);
    try {
      const r = await api<{ url: string; name: string; groupName: string; year: number }>("createInvite", { exchangeId: m.ex.id, memberId: p.id });
      const message = inviteMessage(r.name, r.groupName, r.year, r.url);
      const ok = await copyText(message);
      setLink({ url: r.url, message });
      if (ok) toast.ok(`Invite for ${firstName(p.name)} copied. Paste it into a text.`);
    } catch (e) {
      toast.err(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-pine/[0.03]">
      <Avatar name={p.name} avatar={p.avatar} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-[14.5px] font-semibold">
          {p.name}
          {p.role === "organizer" ? <Pill tone="gold">Organizer</Pill> : null}
          {isMe ? <span className="text-[12px] font-normal text-muted">(you)</span> : null}
        </div>
        <div className="truncate text-[12.5px] text-muted">
          {p.joinedAt ? (
            <>
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#3f8a5a] align-middle" />
              <span className="font-semibold text-pine-2">Joined</span>
              {` · ${giftCount} ${giftCount === 1 ? "idea" : "ideas"}`}
            </>
          ) : (
            <>
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-gold-2 align-middle" />
              Not joined yet
            </>
          )}
        </div>
      </div>
      {!p.joinedAt ? (
        <Button size="sm" variant="secondary" loading={busy} onClick={invite} icon={<Copy className="h-3.5 w-3.5" />}>
          Copy invite
        </Button>
      ) : null}
      {!isMe ? (
        <div className="relative" ref={menuRef}>
          <button className="rounded-lg p-1.5 text-muted hover:bg-pine/5 hover:text-pine" onClick={() => setMenu((x) => !x)} aria-label={`More for ${p.name}`}>
            <MoreHorizontal className="h-4.5 w-4.5" />
          </button>
          {menu ? (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute right-0 top-9 z-20 w-60 overflow-hidden rounded-xl border border-[var(--line)] bg-card py-1 shadow-[var(--shadow-lg)]"
            >
              {p.email ? (
                <div className="border-b border-[var(--line)] px-3 pb-2 pt-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Email</div>
                  <div className="truncate text-[13px] text-ink">{p.email}</div>
                </div>
              ) : null}
              <MenuItem icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => (setMenu(false), setEdit(true))}>
                Edit name{p.joinedAt ? "" : " or email"}
              </MenuItem>
              {p.joinedAt ? (
                <MenuItem icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => (setMenu(false), setConfirm("reset"))}>
                  Reset their sign-in
                </MenuItem>
              ) : (
                <MenuItem icon={<Send className="h-3.5 w-3.5" />} onClick={() => (setMenu(false), invite())}>
                  New invite link
                </MenuItem>
              )}
              <MenuItem danger icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => (setMenu(false), setConfirm("remove"))}>
                Remove from {m.ex.year}
              </MenuItem>
            </motion.div>
          ) : null}
        </div>
      ) : (
        <span className="w-8" />
      )}

      <InviteModal link={link} name={p.name} onClose={() => setLink(null)} />
      <EditPerson open={edit} onClose={() => setEdit(false)} p={p} m={m} />
      <Confirm
        open={confirm === "remove"}
        onClose={() => setConfirm(null)}
        title={`Remove ${p.name}?`}
        danger
        confirmLabel="Remove"
        body={
          m.drawn ? (
            <>
              Names are already drawn. We&apos;ll quietly close the gap: whoever had {firstName(p.name)} gets {firstName(p.name)}&apos;s match instead.
              Nobody&apos;s secret gets revealed, and only that one person sees a change. Their wishlist for {m.ex.year} goes away.
            </>
          ) : (
            <>
              {firstName(p.name)} and their {m.ex.year} wishlist will be removed from this exchange. Any rules that include them go too.
            </>
          )
        }
        onConfirm={async () => {
          try {
            const r = await api<{ rewired: boolean; changedCount: number }>("removeMember", { exchangeId: m.ex.id, memberId: p.id });
            toast.ok(
              r.rewired
                ? `${p.name} removed. ${r.changedCount === 1 ? "One person has" : `${r.changedCount} people have`} a new envelope to open.`
                : `${p.name} removed.`,
            );
          } catch (e) {
            toast.err(e);
          }
        }}
      />
      <Confirm
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title={`Reset ${firstName(p.name)}'s sign-in?`}
        confirmLabel="Reset"
        body={
          <>
            Use this if {firstName(p.name)} lost access to their email or joined with the wrong one. They&apos;ll be signed out everywhere. Then send them a
            new invite link. Their wishlist and shopping stay put.
          </>
        }
        onConfirm={async () => {
          try {
            await api("resetLogin", { exchangeId: m.ex.id, memberId: p.id });
            toast.ok("Reset. Send them a new invite.");
          } catch (e) {
            toast.err(e);
          }
        }}
      />
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] font-medium hover:bg-pine/[0.05] ${danger ? "text-coral-2" : "text-ink"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function InviteModal({ link, name, onClose }: { link: { url: string; message: string } | null; name: string; onClose: () => void }) {
  const toast = useToast();
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <Modal open={!!link} onClose={onClose} title={`Invite ${firstName(name)}`}>
      <p className="text-[13.5px] text-muted">Copied to your clipboard. Paste it into a text or email to {firstName(name)}.</p>
      <div className="mt-3 whitespace-pre-line rounded-2xl bg-teal/20 p-4 text-[14px] leading-relaxed text-ink ring-1 ring-teal/50">{link?.message}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={<Copy className="h-4 w-4" />}
          onClick={async () => ((await copyText(link!.message)) ? toast.ok("Copied again.") : toast.err("Couldn't copy. Press and hold the text to copy it."))}
        >
          Copy message
        </Button>
        {canShare ? (
          <Button
            icon={<Send className="h-4 w-4" />}
            onClick={() => navigator.share({ text: link!.message }).catch(() => {})}
          >
            Share
          </Button>
        ) : null}
        <a href={`sms:?&body=${encodeURIComponent(link?.message ?? "")}`} className="sm:hidden">
          <Button variant="secondary">Text it</Button>
        </a>
        <Button variant="ghost" className="ml-auto" onClick={onClose}>
          Done
        </Button>
      </div>
      <p className="mt-3 text-[12px] text-muted">Each link works once. Making a new one cancels the old one.</p>
    </Modal>
  );
}

function EditPerson({ open, onClose, p, m }: { open: boolean; onClose: () => void; p: Person; m: Model }) {
  const toast = useToast();
  const [name, setName] = useState(p.name);
  const [email, setEmail] = useState(p.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(p.name);
      setEmail(p.email ?? "");
      setError("");
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Edit ${firstName(p.name)}`}>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("updateMember", {
              exchangeId: m.ex.id,
              memberId: p.id,
              name,
              ...(p.joinedAt ? {} : { email }),
            });
            toast.ok("Saved.");
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        {!p.joinedAt ? (
          <Field label="Email (optional)" hint="If set, only this email can use their invite.">
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </Field>
        ) : null}
        {error ? <p className="text-[13px] font-medium text-coral-2">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Rules ---------------- */

function RulesEditor({ m }: { m: Model }) {
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [both, setBoth] = useState(true);
  const [busy, setBusy] = useState(false);
  const rules = (m.ex.exclusions ?? []).filter((e) => e.from && e.to);
  const name = (id: string) => m.people.find((p) => p.id === id)?.name ?? "Someone";
  const locked = m.drawn;

  return (
    <div className="card p-5">
      <SectionTitle icon={<Ban className="h-4 w-4" />} title="Who can't draw who" right={locked ? <Pill>Locked</Pill> : null} />
      <p className="-mt-1 mb-3 text-[13px] text-muted">Spouses, kids who live together, anyone who&apos;d rather not. Everyone in the exchange can see these rules.</p>
      {rules.length ? (
        <div className="mb-3 grid gap-1.5">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-[13.5px] ring-1 ring-[var(--line)]">
              <span className="font-semibold">{name(r.from!.id)}</span>
              <span className="text-muted">can&apos;t draw</span>
              <span className="font-semibold">{name(r.to!.id)}</span>
              {!locked ? (
                <button
                  className="ml-auto rounded-md p-1 text-muted hover:bg-coral/10 hover:text-coral-2"
                  aria-label="Remove rule"
                  onClick={async () => {
                    try {
                      await api("removeExclusion", { exchangeId: m.ex.id, exclusionId: r.id });
                    } catch (e) {
                      toast.err(e);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 rounded-xl bg-paper px-3 py-2 text-[13px] text-muted ring-1 ring-[var(--line)]">No rules yet. Anyone can draw anyone.</p>
      )}
      {!locked ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!from || !to) return toast.err("Pick two people.");
            setBusy(true);
            try {
              await api("addExclusion", { exchangeId: m.ex.id, from, to, both });
              setFrom("");
              setTo("");
            } catch (err) {
              toast.err(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Giver">
            <option value="">Pick someone</option>
            {m.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-center text-[13px] text-muted">can&apos;t draw</span>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Recipient">
            <option value="">Pick someone</option>
            {m.people
              .filter((p) => p.id !== from)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <Button type="submit" loading={busy}>
            Add rule
          </Button>
          <label className="flex items-center gap-2 text-[13px] text-muted sm:col-span-4">
            <input type="checkbox" className="h-4 w-4 accent-[#214337]" checked={both} onChange={(e) => setBoth(e.target.checked)} />
            Both ways (neither can draw the other)
          </label>
        </form>
      ) : null}
    </div>
  );
}

/* ---------------- Draw + seal ---------------- */

function DrawCard({ m }: { m: Model }) {
  const toast = useToast();
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [confirmSeal, setConfirmSeal] = useState(false);
  const notJoined = m.people.filter((p) => !p.joinedAt);
  const name = (id?: string) => m.people.find((p) => p.id === id)?.name ?? "Someone";

  if (!m.drawn) {
    return (
      <div className="relative overflow-hidden rounded-[22px] bg-pine p-5 text-cream">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/15" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-gold" />
            <h3 className="font-display text-[19px] font-semibold">Draw names</h3>
          </div>
          <p className="mt-1 text-[13.5px] text-cream/75">
            One tap matches everyone and follows every rule. Each person sees only their own envelope. Not even you can see the list.
          </p>
          {notJoined.length ? (
            <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[12.5px] text-cream/85">
              {notJoined.length} {notJoined.length === 1 ? "person hasn't" : "people haven't"} joined yet. You can still draw. They&apos;ll see their match
              when they sign in.
            </p>
          ) : null}
          <Button variant="gold" size="lg" className="mt-4 w-full" disabled={m.people.length < 3} onClick={() => setConfirmDraw(true)} icon={<Shuffle className="h-4 w-4" />}>
            {m.people.length < 3 ? "Add at least 3 people" : `Draw names for ${m.people.length}`}
          </Button>
        </div>
        <Confirm
          open={confirmDraw}
          onClose={() => setConfirmDraw(false)}
          title="Ready to draw?"
          confirmLabel="Draw names"
          body={
            <>
              This locks the rules. You can still add or remove people afterward, and we&apos;ll patch the draw without revealing anyone&apos;s match.
              {m.ex.avoidLastYear ? " We'll also try to avoid last year's pairs." : ""}
            </>
          }
          onConfirm={async () => {
            try {
              const r = await api<{ avoidedLastYear: boolean; hadLastYear: boolean }>("draw", { exchangeId: m.ex.id });
              toast.ok(
                r.hadLastYear && !r.avoidedLastYear
                  ? "Names drawn! The rules didn't allow avoiding every repeat from last year."
                  : "Names drawn! Everyone has an envelope waiting.",
              );
            } catch (e) {
              toast.err(e);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="card p-5">
      <SectionTitle
        icon={m.ex.sealOpen ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        title={m.ex.sealOpen ? "Match list (unsealed)" : "Match list is sealed"}
      />
      <p className="text-[13px] text-muted">
        Drawn {m.ex.drawnAt ? new Date(m.ex.drawnAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}.{" "}
        {m.ex.sealOpen
          ? `Opened by ${m.ex.sealOpenedBy ?? "the organizer"} on ${new Date(m.ex.sealOpenedAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Everyone was told.`
          : "Nobody can see the full list, including you. Removing or adding someone fixes the draw automatically, so you shouldn't need to open it."}
      </p>
      {m.ex.sealOpen ? (
        <div className="mt-3 grid gap-1.5">
          {m.assignments
            .slice()
            .sort((a, b) => name(a.giver?.id).localeCompare(name(b.giver?.id)))
            .map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-[13.5px] ring-1 ring-[var(--line)]">
                <span className="font-semibold">{name(a.giver?.id)}</span>
                <span className="text-muted">shops for</span>
                <span className="font-semibold">{name(a.recipient?.id)}</span>
                {a.revealedAt ? <Pill tone="teal" className="ml-auto">Opened</Pill> : <Pill className="ml-auto">Not opened</Pill>}
              </div>
            ))}
        </div>
      ) : (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setConfirmSeal(true)} icon={<LockOpen className="h-4 w-4" />}>
          Break the seal (emergency only)
        </Button>
      )}
      <Confirm
        open={confirmSeal}
        onClose={() => setConfirmSeal(false)}
        title="Break the seal?"
        danger
        confirmLabel="Yes, open the list"
        body={
          <>
            You&apos;ll see who has who, <span className="font-semibold">including who has you</span>. A notice goes up for everyone in the exchange
            saying you opened it and when. This can&apos;t be undone.
          </>
        }
        onConfirm={async () => {
          try {
            await api("openSeal", { exchangeId: m.ex.id });
          } catch (e) {
            toast.err(e);
          }
        }}
      />
    </div>
  );
}

/* ---------------- Settings ---------------- */

function SettingsCard({ m }: { m: Model }) {
  const toast = useToast();
  const [title, setTitle] = useState(m.ex.title);
  const [budget, setBudget] = useState(m.ex.budgetCents != null ? String(m.ex.budgetCents / 100) : "");
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState({ t: m.ex.title, b: m.ex.budgetCents });
  if (seen.t !== m.ex.title || seen.b !== m.ex.budgetCents) {
    setSeen({ t: m.ex.title, b: m.ex.budgetCents });
    setTitle(m.ex.title);
    setBudget(m.ex.budgetCents != null ? String(m.ex.budgetCents / 100) : "");
  }
  const dirty = title !== m.ex.title || budget !== (m.ex.budgetCents != null ? String(m.ex.budgetCents / 100) : "");

  const toggle = async (k: "noSwapPairs" | "avoidLastYear", v: boolean) => {
    try {
      await api("updateSettings", { exchangeId: m.ex.id, [k]: v });
    } catch (e) {
      toast.err(e);
    }
  };

  return (
    <div className="card p-5">
      <SectionTitle icon={<Settings2 className="h-4 w-4" />} title="Settings" />
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("updateSettings", { exchangeId: m.ex.id, title, budget: budget || null });
            toast.ok("Settings saved.");
          } catch (err) {
            toast.err(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Exchange name">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Spending limit per person" hint="Total each person spends on their match. Leave blank for no limit.">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input className="input pl-7" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="No limit" />
          </div>
        </Field>
        <Button type="submit" variant="secondary" disabled={!dirty} loading={busy}>
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </form>
      <div className="mt-4 grid gap-1 border-t border-[var(--line)] pt-3">
        <Toggle
          checked={!!m.ex.noSwapPairs}
          disabled={m.drawn}
          onChange={(v) => toggle("noSwapPairs", v)}
          label="No swapping pairs"
          hint="If Mom has Dad, Dad can't have Mom."
        />
        <Toggle
          checked={!!m.ex.avoidLastYear}
          disabled={m.drawn}
          onChange={(v) => toggle("avoidLastYear", v)}
          label="Avoid last year's matches"
          hint="Nobody gets the same person two years running, when the rules allow it."
        />
      </div>
    </div>
  );
}

/* ---------------- Tools ---------------- */

function ToolsCard({ m }: { m: Model }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmYear, setConfirmYear] = useState(false);
  const nextYear = m.ex.year + 1;
  const nextExists = m.years.some((y) => y.year === nextYear);

  const download = async () => {
    setBusy("backup");
    try {
      const data = await api<Record<string, unknown>>("backup", { exchangeId: m.ex.id });
      delete (data as { ok?: unknown }).ok;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `merry-match-${m.group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast.ok("Backup downloaded.");
    } catch (e) {
      toast.err(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card p-5">
      <SectionTitle icon={<Download className="h-4 w-4" />} title="Keep it safe" />
      <div className="grid gap-2">
        <Button variant="secondary" loading={busy === "backup"} onClick={download} icon={<Download className="h-4 w-4" />}>
          Download a backup
        </Button>
        <p className="text-[12px] text-muted">
          People, rules and every wishlist across all years. Matches stay out unless the seal was broken, and who-bought-what is never included.
        </p>
        {nextExists ? (
          <Button variant="ghost" onClick={() => router.push(`/x/${m.years.find((y) => y.year === nextYear)!.id}?tab=organize`)} icon={<CalendarPlus className="h-4 w-4" />}>
            Go to Christmas {nextYear}
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmYear(true)} icon={<CalendarPlus className="h-4 w-4" />}>
            Start Christmas {nextYear}
          </Button>
        )}
      </div>
      <Confirm
        open={confirmYear}
        onClose={() => setConfirmYear(false)}
        title={`Start Christmas ${nextYear}?`}
        confirmLabel={`Start ${nextYear}`}
        body={
          <>
            Everyone from {m.ex.year} carries over, along with your rules. Wishlists start fresh, and people can bring theirs over in one tap.
            {m.ex.budgetCents != null ? ` The ${formatMoney(m.ex.budgetCents)} limit carries over too.` : ""} {m.ex.year} stays here to look back on.
          </>
        }
        onConfirm={async () => {
          try {
            const r = await api<{ exchangeId: string }>("newYear", { fromExchangeId: m.ex.id, year: nextYear });
            toast.ok(`Christmas ${nextYear} is ready.`);
            router.push(`/x/${r.exchangeId}?tab=organize`);
          } catch (e) {
            toast.err(e);
          }
        }}
      />
    </div>
  );
}
