import "server-only";
import { id } from "@instantdb/admin";
import { adminDb } from "./admin";
import { runDraw, removeAfterDraw, addAfterDraw, type Pair, type Rule } from "@/lib/draw";
import { cleanUrl, isEmail, MAX_GIFTS, MAX_NOTES, MAX_PEOPLE, MAX_IMPORT } from "@/lib/format";
import { storeFromUrl } from "@/lib/parseList";
import { aiParseWishlist, aiSuggestGiftIdeas, checkAiRateLimit } from "./ai";
import { fetchPreview } from "./preview";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Ctx = {
  user: { id: string; email: string | null } | null;
  origin: string;
};

const tx = adminDb.tx;
const now = () => Date.now();

function need(cond: unknown, status: number, msg: string): asserts cond {
  if (!cond) throw new ApiError(status, msg);
}

function str(v: unknown, max: number, field = "This field"): string {
  if (v == null) return "";
  if (typeof v !== "string") throw new ApiError(400, `${field} looks wrong.`);
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length > max) throw new ApiError(400, `${field} is too long (max ${max} characters).`);
  return s;
}

function longStr(v: unknown, max: number, field: string): string {
  if (v == null) return "";
  if (typeof v !== "string") throw new ApiError(400, `${field} looks wrong.`);
  const s = v.replace(/\r\n?/g, "\n").trim();
  if (s.length > max) throw new ApiError(400, `${field} is too long (max ${max} characters).`);
  return s;
}

function cents(v: unknown, field = "Price"): number | null {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new ApiError(400, `${field} should be between $0 and $100,000.`);
  return Math.round(n * 100);
}

// Prices from the browser come as cents already.
function centsInt(v: unknown, field = "Price"): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw new ApiError(400, `${field} looks wrong.`);
  return n;
}

function httpsUrl(v: unknown, field = "Link"): string | null {
  if (v == null || v === "") return null;
  const u = cleanUrl(String(v));
  if (!u) throw new ApiError(400, `${field} isn't a valid web address.`);
  const parsed = new URL(u);
  if (parsed.username || parsed.password) throw new ApiError(400, `${field} isn't allowed.`);
  if (u.length > 2000) throw new ApiError(400, `${field} is too long.`);
  return u;
}

function idOf(v: unknown, field = "id"): string {
  need(typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v), 400, `Missing or bad ${field}.`);
  return v as string;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString("base64url");
}

function requireUser(ctx: Ctx) {
  need(ctx.user, 401, "Please sign in again.");
  return ctx.user!;
}

/* ---------- loaders ---------- */

async function loadExchange(exchangeId: string) {
  const r: any = await adminDb.query({
    exchanges: {
      $: { where: { id: exchangeId } },
      group: { admins: {}, members: { user: {} } },
      participants: { user: {} },
      exclusions: { from: {}, to: {} },
      assignments: { giver: {}, recipient: {} },
    },
  });
  const ex = r.exchanges?.[0];
  need(ex, 404, "That exchange doesn't exist anymore.");
  return ex;
}

function isAdmin(ex: any, userId: string) {
  return (ex.group?.admins ?? []).some((a: any) => a.id === userId);
}

function myGroupMember(group: any, userId: string) {
  return (group?.members ?? []).find((m: any) => m.user?.id === userId);
}

function myParticipant(ex: any, userId: string) {
  return (ex.participants ?? []).find((m: any) => m.user?.id === userId);
}

function requireAdmin(ex: any, ctx: Ctx) {
  const u = requireUser(ctx);
  need(isAdmin(ex, u.id), 403, "Only the organizer can do that.");
  return u;
}

function requireParticipant(ex: any, ctx: Ctx) {
  const u = requireUser(ctx);
  const me = myParticipant(ex, u.id);
  need(me, 403, "You're not part of this exchange.");
  return me;
}

function pairsOf(ex: any): (Pair & { aid: string })[] {
  return (ex.assignments ?? [])
    .filter((a: any) => a.giver && a.recipient)
    .map((a: any) => ({ aid: a.id, giver: a.giver.id, recipient: a.recipient.id }));
}

function rulesOf(ex: any): Rule[] {
  return (ex.exclusions ?? []).filter((e: any) => e.from && e.to).map((e: any) => ({ from: e.from.id, to: e.to.id }));
}

/* Write a new set of pairs, changing only what differs. */
function pairWrites(ex: any, next: Pair[], changedGivers: string[]) {
  const current = pairsOf(ex);
  const byGiver = new Map(current.map((p) => [p.giver, p]));
  const nextByGiver = new Map(next.map((p) => [p.giver, p]));
  const chunks: any[] = [];
  const t = now();
  for (const p of current) {
    if (!nextByGiver.has(p.giver)) chunks.push(tx.assignments[p.aid].delete());
  }
  for (const p of next) {
    const cur = byGiver.get(p.giver);
    if (!cur) {
      chunks.push(
        tx.assignments[id()]
          .update({ slot: `${ex.id}:${p.giver}`, createdAt: t, changedAt: changedGivers.includes(p.giver) ? t : undefined })
          .link({ exchange: ex.id, giver: p.giver, recipient: p.recipient }),
      );
    } else if (cur.recipient !== p.recipient) {
      chunks.push(
        tx.assignments[cur.aid].unlink({ recipient: cur.recipient }),
        tx.assignments[cur.aid].update({ changedAt: t, revealedAt: null as any }).link({ recipient: p.recipient }),
      );
    }
  }
  return chunks;
}

/* ---------- actions ---------- */

type Handler = (body: any, ctx: Ctx) => Promise<any>;

const createGroup: Handler = async (body, ctx) => {
  const u = requireUser(ctx);
  const groupName = str(body.groupName, 60, "Group name");
  const yourName = str(body.yourName, 40, "Your name");
  need(groupName, 400, "Give your group a name.");
  need(yourName, 400, "Enter your name.");
  const year = Number(body.year);
  need(Number.isInteger(year) && year >= 2020 && year <= 2100, 400, "Pick a year.");
  const budgetCents = cents(body.budget, "Budget");
  const gid = id(),
    mid = id(),
    xid = id(),
    t = now();
  await adminDb.transact([
    tx.groups[gid].update({ name: groupName, createdAt: t }).link({ admins: u.id }),
    tx.members[mid]
      .update({ name: yourName, role: "organizer", email: u.email ?? undefined, joinedAt: t, createdAt: t })
      .link({ group: gid, user: u.id }),
    tx.exchanges[xid]
      .update({
        year,
        title: `${groupName} Christmas ${year}`,
        budgetCents: budgetCents ?? undefined,
        status: "open",
        noSwapPairs: true,
        avoidLastYear: true,
        createdAt: t,
      })
      .link({ group: gid, participants: mid }),
  ]);
  return { exchangeId: xid, groupId: gid };
};

const addMember: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  const participants = ex.participants ?? [];
  need(participants.length < MAX_PEOPLE, 400, `An exchange can have up to ${MAX_PEOPLE} people.`);

  let memberId: string;
  const writes: any[] = [];
  if (body.memberId) {
    // Bring back someone from an earlier year.
    memberId = idOf(body.memberId, "person");
    need((ex.group.members ?? []).some((m: any) => m.id === memberId), 404, "That person isn't in this group.");
    need(!participants.some((m: any) => m.id === memberId), 400, "They're already in this year's exchange.");
  } else {
    const name = str(body.name, 40, "Name");
    need(name, 400, "Enter a name.");
    const lower = name.toLowerCase();
    need(
      !(ex.group.members ?? []).some((m: any) => m.name.toLowerCase() === lower),
      400,
      `There's already someone named ${name} in this group. Add a last initial so people can tell them apart.`,
    );
    const email = str(body.email, 120, "Email").toLowerCase();
    if (email) {
      need(isEmail(email), 400, "That email doesn't look right.");
      need(!(ex.group.members ?? []).some((m: any) => (m.email || "").toLowerCase() === email), 400, "Someone in this group already uses that email.");
    }
    memberId = id();
    writes.push(
      tx.members[memberId]
        .update({ name, role: "member", email: email || undefined, createdAt: now() })
        .link({ group: ex.group.id }),
    );
  }
  writes.push(tx.exchanges[ex.id].link({ participants: memberId }));

  let changed: string[] = [];
  if (ex.status === "drawn") {
    const res = addAfterDraw(pairsOf(ex), memberId, { exclusions: rulesOf(ex), noSwapPairs: ex.noSwapPairs });
    need(res.ok, 400, res.ok ? "" : res.reason);
    if (res.ok) {
      writes.push(...pairWrites(ex, res.pairs, res.changedGivers));
      changed = res.changedGivers;
    }
  }
  await adminDb.transact(writes);
  return { memberId, rewired: changed.length > 0 };
};

const updateMember: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  const mid = idOf(body.memberId, "person");
  const m = (ex.group.members ?? []).find((x: any) => x.id === mid);
  need(m, 404, "That person isn't in this group.");
  const patch: any = {};
  if (body.name !== undefined) {
    const name = str(body.name, 40, "Name");
    need(name, 400, "Enter a name.");
    need(
      !(ex.group.members ?? []).some((o: any) => o.id !== mid && o.name.toLowerCase() === name.toLowerCase()),
      400,
      `There's already someone named ${name}.`,
    );
    patch.name = name;
  }
  if (body.email !== undefined) {
    need(!m.user, 400, "They've already joined, so their email is set by their own sign-in.");
    const email = str(body.email, 120, "Email").toLowerCase();
    if (email) {
      need(isEmail(email), 400, "That email doesn't look right.");
      need(
        !(ex.group.members ?? []).some((o: any) => o.id !== mid && (o.email || "").toLowerCase() === email),
        400,
        "Someone in this group already uses that email.",
      );
    }
    patch.email = email || null;
  }
  await adminDb.transact(tx.members[mid].update(patch));
  return {};
};

const removeMember: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const u = requireAdmin(ex, ctx);
  const mid = idOf(body.memberId, "person");
  const m = (ex.participants ?? []).find((x: any) => x.id === mid);
  need(m, 404, "That person isn't in this year's exchange.");
  need(m.user?.id !== u.id, 400, "You can't remove yourself while you're the organizer.");

  const writes: any[] = [tx.exchanges[ex.id].unlink({ participants: mid })];
  let changed: string[] = [];
  if (ex.status === "drawn") {
    const res = removeAfterDraw(pairsOf(ex), mid, { exclusions: rulesOf(ex), noSwapPairs: ex.noSwapPairs });
    need(res.ok, 400, res.ok ? "" : res.reason);
    if (res.ok) {
      writes.push(...pairWrites(ex, res.pairs, res.changedGivers));
      changed = res.changedGivers;
    }
  }
  // Their rules for this year go away.
  for (const e of ex.exclusions ?? []) if (e.from?.id === mid || e.to?.id === mid) writes.push(tx.exclusions[e.id].delete());

  // Their wishlist for this year, and their shopping: reservations are released, purchases stay marked.
  const r: any = await adminDb.query({
    gifts: { $: { where: { "exchange.id": ex.id, "owner.id": mid } } },
    claimBuyers: { $: { where: { "exchange.id": ex.id, "buyer.id": mid } }, claim: {} },
  });
  for (const g of r.gifts ?? []) writes.push(tx.gifts[g.id].delete());
  for (const row of r.claimBuyers ?? []) {
    if (row.claim && row.status === "reserved") writes.push(tx.claims[row.claim.id].delete());
    writes.push(tx.claimBuyers[row.id].delete());
  }
  await adminDb.transact(writes);

  // Never joined and not in any other year: remove them from the group entirely.
  const left: any = await adminDb.query({ members: { $: { where: { id: mid } }, exchanges: {}, user: {} } });
  const lm = left.members?.[0];
  if (lm && !lm.user && (lm.exchanges ?? []).length === 0) await adminDb.transact(tx.members[mid].delete());
  return { rewired: changed.length > 0, changedCount: changed.length };
};

const createInvite: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  const mid = idOf(body.memberId, "person");
  const m = (ex.group.members ?? []).find((x: any) => x.id === mid);
  need(m, 404, "That person isn't in this group.");
  need(!m.user, 400, `${m.name} has already joined. They sign in with their email on any device.`);
  const old: any = await adminDb.query({ invites: { $: { where: { "member.id": mid } } } });
  const token = newToken();
  const hash = await sha256(token);
  await adminDb.transact([
    ...(old.invites ?? []).map((i: any) => tx.invites[i.id].delete()),
    tx.invites[id()].update({ hash, createdAt: now() }).link({ member: mid }),
  ]);
  return { url: `${ctx.origin}/join/${token}`, name: m.name, groupName: ex.group.name, year: ex.year };
};

const resetLogin: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const u = requireAdmin(ex, ctx);
  const mid = idOf(body.memberId, "person");
  const m = (ex.group.members ?? []).find((x: any) => x.id === mid);
  need(m, 404, "That person isn't in this group.");
  need(m.user, 400, "They haven't joined yet. Just send them an invite.");
  need(m.user.id !== u.id, 400, "You can't reset your own sign-in.");
  await adminDb.transact([tx.members[mid].unlink({ user: m.user.id }).update({ joinedAt: null as any, email: null as any })]);
  return {};
};

async function findInvite(token: unknown) {
  need(typeof token === "string" && token.length >= 20 && token.length < 100, 400, "This invite link is incomplete.");
  const hash = await sha256(token as string);
  const r: any = await adminDb.query({
    invites: {
      $: { where: { hash } },
      member: { user: {}, group: { exchanges: {} }, exchanges: {} },
    },
  });
  const inv = r.invites?.[0];
  need(inv && inv.member, 404, "This invite link isn't valid anymore. Ask your organizer for a new one.");
  return inv;
}

function latestExchangeId(member: any): string | null {
  const ex = (member.exchanges ?? []).slice().sort((a: any, b: any) => b.year - a.year)[0];
  return ex?.id ?? null;
}

const inviteInfo: Handler = async (body) => {
  const inv = await findInvite(body.token);
  const m = inv.member;
  const ex = (m.exchanges ?? []).slice().sort((a: any, b: any) => b.year - a.year)[0];
  return {
    name: m.name,
    groupName: m.group?.name ?? "",
    year: ex?.year ?? null,
    email: m.email ?? null,
    used: !!inv.usedAt || !!m.user,
  };
};

const claimInvite: Handler = async (body, ctx) => {
  const u = requireUser(ctx);
  const inv = await findInvite(body.token);
  const m = inv.member;
  if (m.user) {
    need(m.user.id === u.id, 409, "This invite was already used. If that wasn't you, tell your organizer.");
    return { exchangeId: latestExchangeId(m) };
  }
  need(!inv.usedAt, 409, "This invite was already used. Ask your organizer for a new one.");
  const email = (u.email || "").toLowerCase();
  if (m.email) {
    need(
      m.email.toLowerCase() === email,
      403,
      `This invite is for a different email address. Sign in with the email your organizer has on file, or ask them to change it.`,
    );
  }
  const g: any = await adminDb.query({ members: { $: { where: { "group.id": m.group.id, "user.id": u.id } } } });
  need(!(g.members ?? []).length, 409, `You're already in ${m.group.name} as ${g.members?.[0]?.name}. Each person needs their own email.`);
  await adminDb.transact([
    tx.members[m.id].update({ joinedAt: now(), email: email || undefined }).link({ user: u.id }),
    tx.invites[inv.id].update({ usedAt: now() }),
  ]);
  return { exchangeId: latestExchangeId(m) };
};

const addExclusion: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  need(ex.status !== "drawn", 400, "Names are already drawn, so the rules are locked.");
  const from = idOf(body.from, "person"),
    to = idOf(body.to, "person");
  need(from !== to, 400, "Pick two different people.");
  const ids = new Set((ex.participants ?? []).map((m: any) => m.id));
  need(ids.has(from) && ids.has(to), 400, "Both people need to be in this year's exchange.");
  const existing = rulesOf(ex);
  const writes: any[] = [];
  const add = (a: string, b: string) => {
    if (!existing.some((r) => r.from === a && r.to === b))
      writes.push(tx.exclusions[id()].update({ createdAt: now() }).link({ exchange: ex.id, from: a, to: b }));
  };
  add(from, to);
  if (body.both) add(to, from);
  need(writes.length, 400, "That rule is already set.");
  await adminDb.transact(writes);
  return {};
};

const removeExclusion: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  need(ex.status !== "drawn", 400, "Names are already drawn, so the rules are locked.");
  const eid = idOf(body.exclusionId, "rule");
  need((ex.exclusions ?? []).some((e: any) => e.id === eid), 404, "That rule is already gone.");
  await adminDb.transact(tx.exclusions[eid].delete());
  return {};
};

const updateSettings: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  const patch: any = {};
  if (body.budget !== undefined) patch.budgetCents = cents(body.budget, "Budget");
  if (body.title !== undefined) {
    const t = str(body.title, 80, "Title");
    need(t, 400, "Enter a title.");
    patch.title = t;
  }
  for (const k of ["noSwapPairs", "avoidLastYear"] as const) {
    if (body[k] !== undefined) {
      need(ex.status !== "drawn", 400, "Names are already drawn, so the rules are locked.");
      patch[k] = !!body[k];
    }
  }
  await adminDb.transact(tx.exchanges[ex.id].update(patch));
  return {};
};

const draw: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  need(ex.status !== "drawn", 409, "Names were already drawn.");
  const ids: string[] = (ex.participants ?? []).map((m: any) => m.id);

  let avoid: Rule[] = [];
  if (ex.avoidLastYear) {
    const r: any = await adminDb.query({
      exchanges: { $: { where: { "group.id": ex.group.id, year: ex.year - 1 } }, assignments: { giver: {}, recipient: {} } },
    });
    avoid = (r.exchanges?.[0]?.assignments ?? [])
      .filter((a: any) => a.giver && a.recipient)
      .map((a: any) => ({ from: a.giver.id, to: a.recipient.id }));
  }
  const res = runDraw(ids, { exclusions: rulesOf(ex), noSwapPairs: ex.noSwapPairs, avoid });
  if (!res.ok) {
    if (res.reason.startsWith("NOBODY:")) {
      const who = (ex.participants ?? []).find((m: any) => m.id === res.reason.slice(7))?.name ?? "Someone";
      throw new ApiError(400, `${who} is blocked from everyone. Remove one of ${who}'s rules.`);
    }
    throw new ApiError(400, res.reason);
  }
  const t = now();
  try {
    await adminDb.transact([
      ...res.pairs.map((p) =>
        tx.assignments[id()]
          .update({ slot: `${ex.id}:${p.giver}`, createdAt: t })
          .link({ exchange: ex.id, giver: p.giver, recipient: p.recipient }),
      ),
      tx.exchanges[ex.id].update({ status: "drawn", drawnAt: t }),
    ]);
  } catch (e: any) {
    // The unique slot means a double-click can never create two draws.
    if (/unique|already exists/i.test(String(e?.message ?? e?.body?.message ?? ""))) throw new ApiError(409, "Names were already drawn.");
    throw e;
  }
  return { avoidedLastYear: res.avoidedLastYear, hadLastYear: avoid.length > 0 };
};

const openSeal: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const u = requireAdmin(ex, ctx);
  need(ex.status === "drawn", 400, "There's nothing sealed yet. Names haven't been drawn.");
  if (ex.sealOpen) return {};
  const me = myGroupMember(ex.group, u.id);
  await adminDb.transact(tx.exchanges[ex.id].update({ sealOpen: true, sealOpenedAt: now(), sealOpenedBy: me?.name ?? "The organizer" }));
  return {};
};

const markRevealed: Handler = async (body, ctx) => {
  const u = requireUser(ctx);
  const aid = idOf(body.assignmentId, "match");
  const r: any = await adminDb.query({ assignments: { $: { where: { id: aid } }, giver: { user: {} } } });
  const a = r.assignments?.[0];
  need(a && a.giver?.user?.id === u.id, 404, "That match isn't yours.");
  if (!a.revealedAt) await adminDb.transact(tx.assignments[aid].update({ revealedAt: now(), changedAt: null as any }));
  return {};
};

const saveNotes: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const me = requireParticipant(ex, ctx);
  const notes = longStr(body.notes, MAX_NOTES, "Notes");
  await adminDb.transact(tx.members[me.id].update({ notes }));
  return {};
};

const AVATARS = ["reindeer", "snowman", "gingerbread", "penguin", "elf", "santa", "tree", "ornament", "polarbear", "star"];
const setAvatar: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const me = requireParticipant(ex, ctx);
  const avatar = str(body.avatar, 20, "Character");
  need(AVATARS.includes(avatar), 400, "Pick one of the characters.");
  await adminDb.transact(tx.members[me.id].update({ avatar }));
  return {};
};

function giftFields(body: any) {
  const title = str(body.title, 140, "Gift name");
  need(title, 400, "Give the gift a name.");
  const url = httpsUrl(body.url);
  const imageUrl = httpsUrl(body.imageUrl, "Image link");
  if (imageUrl) need(imageUrl.startsWith("https://"), 400, "Image links need to start with https://");
  return {
    title,
    url: url ?? null,
    priceCents: centsInt(body.priceCents),
    store: str(body.store, 60, "Store") || (url ? storeFromUrl(url) : null) || null,
    size: str(body.size, 40, "Size") || null,
    color: str(body.color, 40, "Color") || null,
    imageUrl: imageUrl ?? null,
    note: longStr(body.note, 400, "Note") || null,
  };
}

const saveGift: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const me = requireParticipant(ex, ctx);
  const fields = giftFields(body);
  if (body.giftId) {
    const gid = idOf(body.giftId, "gift");
    const r: any = await adminDb.query({ gifts: { $: { where: { id: gid } }, owner: {}, claim: { buyerRow: {} } } });
    const g = r.gifts?.[0];
    need(g && g.owner?.id === me.id, 404, "That gift isn't on your list.");
    const writes: any[] = [tx.gifts[gid].update(fields)];
    const row = g.claim?.buyerRow;
    if (row) writes.push(tx.claimBuyers[row.id].update({ giftTitle: fields.title }));
    await adminDb.transact(writes);
    return { giftId: gid };
  }
  const count: any = await adminDb.query({ gifts: { $: { where: { "exchange.id": ex.id, "owner.id": me.id } } } });
  need((count.gifts ?? []).length < MAX_GIFTS, 400, `Lists can hold up to ${MAX_GIFTS} items.`);
  const gid = id();
  await adminDb.transact(tx.gifts[gid].update({ ...fields, createdAt: now() }).link({ exchange: ex.id, owner: me.id }));
  return { giftId: gid };
};

const deleteGift: Handler = async (body, ctx) => {
  const u = requireUser(ctx);
  const gid = idOf(body.giftId, "gift");
  const r: any = await adminDb.query({ gifts: { $: { where: { id: gid } }, owner: { user: {} }, claim: { buyerRow: {} } } });
  const g = r.gifts?.[0];
  need(g, 404, "That gift is already gone.");
  need(g.owner?.user?.id === u.id, 403, "You can only remove gifts from your own list.");
  const writes: any[] = [];
  const row = g.claim?.buyerRow;
  // The shopper keeps a record so their budget still adds up.
  if (row) writes.push(tx.claimBuyers[row.id].update({ status: row.status === "purchased" ? "purchased-removed" : "removed" }));
  if (g.claim) writes.push(tx.claims[g.claim.id].delete());
  writes.push(tx.gifts[gid].delete());
  await adminDb.transact(writes);
  return {};
};

const importGifts: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const me = requireParticipant(ex, ctx);
  need(Array.isArray(body.gifts), 400, "Nothing to import.");
  need(JSON.stringify(body.gifts).length < MAX_IMPORT * 3, 400, "That list is too big to import at once.");
  const rows = body.gifts.map((g: any, i: number) => {
    try {
      return giftFields(g);
    } catch (e: any) {
      throw new ApiError(400, `Row ${i + 1}: ${e.message}`);
    }
  });
  const count: any = await adminDb.query({ gifts: { $: { where: { "exchange.id": ex.id, "owner.id": me.id } } } });
  const have = (count.gifts ?? []).length;
  need(have + rows.length <= MAX_GIFTS, 400, `Lists can hold up to ${MAX_GIFTS} items. You have room for ${MAX_GIFTS - have} more.`);
  const t = now();
  const writes: any[] = rows.map((f: any, i: number) =>
    tx.gifts[id()].update({ ...f, createdAt: t + i }).link({ exchange: ex.id, owner: me.id }),
  );
  if (typeof body.avoid === "string" && body.avoid.trim()) {
    const merged = [me.notes, body.avoid.trim()].filter(Boolean).join("\n");
    writes.push(tx.members[me.id].update({ notes: longStr(merged.slice(0, MAX_NOTES), MAX_NOTES, "Notes") }));
  }
  if (writes.length) await adminDb.transact(writes);
  return { added: rows.length };
};

const shop: Handler = async (body, ctx) => {
  const u = requireUser(ctx);
  const gid = idOf(body.giftId, "gift");
  const action = String(body.action);
  need(["reserve", "purchase", "release", "price"].includes(action), 400, "Unknown shopping action.");
  const r: any = await adminDb.query({
    gifts: {
      $: { where: { id: gid } },
      owner: { user: {} },
      exchange: { participants: { user: {} } },
      claim: { buyerRow: { buyer: { user: {} } } },
    },
  });
  const g = r.gifts?.[0];
  need(g, 404, "That gift was removed from their list.");
  const ex = g.exchange;
  const me = (ex?.participants ?? []).find((m: any) => m.user?.id === u.id);
  need(me, 403, "You're not part of this exchange.");
  need(g.owner?.id !== me.id, 400, "That's your own list. Your family takes care of this part.");

  const claim = g.claim;
  const row = claim?.buyerRow;
  const mine = row && row.buyer?.id === me.id;
  if (claim && !mine) {
    throw new ApiError(409, claim.status === "purchased" ? "Someone already bought this one." : "Someone already has this one reserved.");
  }
  const t = now();
  const price = body.priceCents !== undefined ? centsInt(body.priceCents, "Price paid") : undefined;

  if (action === "release") {
    if (!claim) return {};
    await adminDb.transact([tx.claims[claim.id].delete(), ...(row ? [tx.claimBuyers[row.id].delete()] : [])]);
    return {};
  }
  if (action === "price") {
    need(row, 400, "Reserve this gift first.");
    await adminDb.transact(tx.claimBuyers[row.id].update({ priceCents: price ?? null, updatedAt: t }));
    return {};
  }
  const status = action === "purchase" ? "purchased" : "reserved";
  if (claim) {
    await adminDb.transact([
      tx.claims[claim.id].update({ status, updatedAt: t }),
      tx.claimBuyers[row.id].update({
        status,
        updatedAt: t,
        ...(price !== undefined ? { priceCents: price } : {}),
      }),
    ]);
    return {};
  }
  const cid = id();
  try {
    await adminDb.transact([
      tx.claims[cid].update({ status, updatedAt: t }).link({ gift: gid, exchange: ex.id }),
      tx.claimBuyers[id()]
        .update({
          status,
          giftTitle: g.title,
          giftId: gid,
          recipientName: g.owner?.name ?? "",
          recipientId: g.owner?.id ?? "",
          priceCents: price ?? g.priceCents ?? null,
          updatedAt: t,
        })
        .link({ claim: cid, buyer: me.id, exchange: ex.id }),
    ]);
  } catch (e: any) {
    if (/unique|already/i.test(String(e?.message ?? e?.body?.message ?? ""))) throw new ApiError(409, "Someone grabbed this one a moment ago.");
    throw e;
  }
  return {};
};

const clearShoppingRow: Handler = async (body, ctx) => {
  const u = requireUser(ctx);
  const rid = idOf(body.rowId, "row");
  const r: any = await adminDb.query({ claimBuyers: { $: { where: { id: rid } }, buyer: { user: {} }, claim: {} } });
  const row = r.claimBuyers?.[0];
  need(row && row.buyer?.user?.id === u.id, 404, "That item isn't on your shopping list.");
  await adminDb.transact([...(row.claim ? [tx.claims[row.claim.id].delete()] : []), tx.claimBuyers[rid].delete()]);
  return {};
};

const preview: Handler = async (body, ctx) => {
  requireUser(ctx);
  const url = httpsUrl(body.url);
  need(url, 400, "Paste a link first.");
  return await fetchPreview(url!);
};

const newYear: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.fromExchangeId, "exchange"));
  requireAdmin(ex, ctx);
  const year = Number(body.year);
  need(Number.isInteger(year) && year > ex.year && year <= ex.year + 5, 400, "Pick a later year.");
  const r: any = await adminDb.query({ exchanges: { $: { where: { "group.id": ex.group.id, year } } } });
  need(!(r.exchanges ?? []).length, 409, `There's already a Christmas ${year} for this group.`);
  const keep: string[] = Array.isArray(body.memberIds)
    ? body.memberIds.filter((x: unknown) => (ex.participants ?? []).some((m: any) => m.id === x))
    : (ex.participants ?? []).map((m: any) => m.id);
  const organizer = myGroupMember(ex.group, ctx.user!.id);
  if (organizer && !keep.includes(organizer.id)) keep.push(organizer.id);
  const xid = id(),
    t = now();
  const writes: any[] = [
    tx.exchanges[xid]
      .update({
        year,
        title: ex.title.replace(String(ex.year), String(year)),
        budgetCents: ex.budgetCents ?? undefined,
        status: "open",
        noSwapPairs: ex.noSwapPairs ?? true,
        avoidLastYear: true,
        createdAt: t,
      })
      .link({ group: ex.group.id, participants: keep }),
  ];
  if (body.copyRules !== false) {
    for (const rule of rulesOf(ex)) {
      if (keep.includes(rule.from) && keep.includes(rule.to))
        writes.push(tx.exclusions[id()].update({ createdAt: t }).link({ exchange: xid, from: rule.from, to: rule.to }));
    }
  }
  await adminDb.transact(writes);
  return { exchangeId: xid };
};

const copyLastYearGifts: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const me = requireParticipant(ex, ctx);
  const r: any = await adminDb.query({
    gifts: { $: { where: { "owner.id": me.id, "exchange.group.id": ex.group.id } }, exchange: {} },
  });
  const all = r.gifts ?? [];
  const prevYear = Math.max(...all.filter((g: any) => g.exchange && g.exchange.year < ex.year).map((g: any) => g.exchange.year), -1);
  need(prevYear > 0, 400, "There's no earlier list to bring over.");
  const have = all.filter((g: any) => g.exchange?.id === ex.id);
  const titles = new Set(have.map((g: any) => g.title.toLowerCase()));
  const src = all.filter((g: any) => g.exchange?.year === prevYear && !titles.has(g.title.toLowerCase()));
  const room = MAX_GIFTS - have.length;
  const t = now();
  const chosen = src.slice(0, room);
  if (chosen.length)
    await adminDb.transact(
      chosen.map((g: any, i: number) =>
        tx.gifts[id()]
          .update({
            title: g.title,
            url: g.url ?? null,
            priceCents: g.priceCents ?? null,
            store: g.store ?? null,
            size: g.size ?? null,
            color: g.color ?? null,
            imageUrl: g.imageUrl ?? null,
            note: g.note ?? null,
            createdAt: t + i,
          })
          .link({ exchange: ex.id, owner: me.id }),
      ),
    );
  return { added: chosen.length, year: prevYear };
};

const backup: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  requireAdmin(ex, ctx);
  const r: any = await adminDb.query({
    groups: {
      $: { where: { id: ex.group.id } },
      members: {},
      exchanges: {
        participants: {},
        exclusions: { from: {}, to: {} },
        gifts: { owner: {}, claim: {} },
        assignments: { giver: {}, recipient: {} },
      },
    },
  });
  const g = r.groups[0];
  const nameOf = new Map<string, string>((g.members ?? []).map((m: any) => [m.id, m.name]));
  return {
    app: "Merry Match",
    exportedAt: new Date().toISOString(),
    note: "Who-drew-whom is only included for years where the organizer opened the sealed match list. Who bought what is never included.",
    group: { name: g.name },
    people: (g.members ?? []).map((m: any) => ({
      name: m.name,
      email: m.email ?? null,
      role: m.role,
      joined: m.joinedAt ? new Date(m.joinedAt).toISOString() : null,
      notes: m.notes ?? "",
    })),
    christmases: (g.exchanges ?? [])
      .sort((a: any, b: any) => a.year - b.year)
      .map((x: any) => ({
        year: x.year,
        title: x.title,
        budget: x.budgetCents != null ? x.budgetCents / 100 : null,
        status: x.status,
        drawnAt: x.drawnAt ? new Date(x.drawnAt).toISOString() : null,
        people: (x.participants ?? []).map((m: any) => m.name),
        rules: (x.exclusions ?? []).map((e: any) => ({ giver: nameOf.get(e.from?.id), cannotDraw: nameOf.get(e.to?.id) })),
        matches: x.sealOpen
          ? (x.assignments ?? []).map((a: any) => ({ giver: nameOf.get(a.giver?.id), shopsFor: nameOf.get(a.recipient?.id) }))
          : "sealed",
        wishlists: (x.participants ?? []).map((m: any) => ({
          person: m.name,
          gifts: (x.gifts ?? [])
            .filter((gift: any) => gift.owner?.id === m.id)
            .sort((a: any, b: any) => a.createdAt - b.createdAt)
            .map((gift: any) => ({
              title: gift.title,
              link: gift.url ?? null,
              price: gift.priceCents != null ? gift.priceCents / 100 : null,
              store: gift.store ?? null,
              size: gift.size ?? null,
              color: gift.color ?? null,
              note: gift.note ?? null,
              covered: gift.claim ? gift.claim.status : null,
            })),
        })),
      })),
  };
};

const aiParseList: Handler = async (body, ctx) => {
  const u = requireUser(ctx);
  need(checkAiRateLimit(u.id), 429, "Easy there, give the AI helper a minute and try again.");
  const text = typeof body.text === "string" ? body.text.slice(0, MAX_IMPORT) : "";
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
  const imageMime = typeof body.imageMime === "string" ? body.imageMime.trim() : "";
  need(text.trim() || imageBase64, 400, "Paste a list or upload a screenshot first.");
  if (imageBase64) {
    need(/^image\/(jpeg|png|webp)$/i.test(imageMime), 400, "Choose a JPG, PNG, or WebP image.");
    need(imageBase64.length < 3_500_000, 400, "That image is too large. Try cropping it.");
  }
  try {
    return await aiParseWishlist({ text, imageBase64, imageMime });
  } catch (e: any) {
    if (e?.message === "NO_AI_KEY") {
      throw new ApiError(503, "AI reading isn't turned on yet (add GEMINI_API_KEY to .env.local).");
    }
    console.error("[aiParseList]", e);
    throw new ApiError(502, "Couldn't read that list right now. Please try again in a moment.");
  }
};

const aiSuggestGifts: Handler = async (body, ctx) => {
  const ex = await loadExchange(idOf(body.exchangeId, "exchange"));
  const me = requireParticipant(ex, ctx);
  need(checkAiRateLimit(ctx.user!.id), 429, "Easy there, give the gift helper a minute and try again.");
  const rid = idOf(body.recipientId, "person");
  const recipient = (ex.participants ?? []).find((p: any) => p.id === rid);
  need(recipient, 404, "That person isn't in this year's exchange.");
  need(recipient.id !== me.id, 400, "Use Paste a list on My List to add ideas for yourself.");
  const hint = str(body.hint, 200, "Hint");

  const r: any = await adminDb.query({
    gifts: { $: { where: { "exchange.id": ex.id, "owner.id": rid } } },
  });
  const existingGifts = (r.gifts ?? []).map((g: any) => ({
    title: String(g.title || ""),
    store: g.store ?? null,
    priceCents: g.priceCents ?? null,
  }));

  try {
    const ideas = await aiSuggestGiftIdeas({
      recipientName: recipient.name,
      budgetCents: ex.budgetCents ?? null,
      existingGifts,
      notes: recipient.notes ?? "",
      hint,
    });
    return { ideas };
  } catch (e: any) {
    if (e?.message === "NO_AI_KEY") {
      throw new ApiError(503, "Gift suggestions aren't turned on yet (add GEMINI_API_KEY to .env.local).");
    }
    console.error("[aiSuggestGifts]", e);
    throw new ApiError(502, "Couldn't brainstorm ideas right now. Please try again in a moment.");
  }
};

// Local testing only: never active in production builds.
const devLogin: Handler = async (body) => {
  need(process.env.NODE_ENV === "development" && process.env.MM_DEV_LOGIN === "1", 404, "Unknown action.");
  const email = str(body.email, 120, "Email").toLowerCase();
  need(/@example\.com$/.test(email), 400, "Dev login only works for @example.com test accounts.");
  return { token: await adminDb.auth.createToken({ email }) };
};

export const handlers: Record<string, { handler: Handler; auth: boolean }> = {
  devLogin: { handler: devLogin, auth: false },
  createGroup: { handler: createGroup, auth: true },
  addMember: { handler: addMember, auth: true },
  updateMember: { handler: updateMember, auth: true },
  removeMember: { handler: removeMember, auth: true },
  createInvite: { handler: createInvite, auth: true },
  resetLogin: { handler: resetLogin, auth: true },
  inviteInfo: { handler: inviteInfo, auth: false },
  claimInvite: { handler: claimInvite, auth: true },
  addExclusion: { handler: addExclusion, auth: true },
  removeExclusion: { handler: removeExclusion, auth: true },
  updateSettings: { handler: updateSettings, auth: true },
  draw: { handler: draw, auth: true },
  openSeal: { handler: openSeal, auth: true },
  markRevealed: { handler: markRevealed, auth: true },
  saveNotes: { handler: saveNotes, auth: true },
  setAvatar: { handler: setAvatar, auth: true },
  saveGift: { handler: saveGift, auth: true },
  deleteGift: { handler: deleteGift, auth: true },
  importGifts: { handler: importGifts, auth: true },
  shop: { handler: shop, auth: true },
  clearShoppingRow: { handler: clearShoppingRow, auth: true },
  preview: { handler: preview, auth: true },
  newYear: { handler: newYear, auth: true },
  copyLastYearGifts: { handler: copyLastYearGifts, auth: true },
  backup: { handler: backup, auth: true },
  aiParseList: { handler: aiParseList, auth: true },
  aiSuggestGifts: { handler: aiSuggestGifts, auth: true },
};
