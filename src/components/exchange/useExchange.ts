"use client";

import { db } from "@/lib/db";
import { CHARACTERS } from "@/components/avatars";

export function useExchange(exchangeId: string, userId: string) {
  const q = db.useQuery({
    exchanges: {
      $: { where: { id: exchangeId } },
      group: { admins: {}, members: { user: {} }, exchanges: {} },
      participants: { user: {} },
      exclusions: { from: {}, to: {} },
      assignments: { giver: {}, recipient: {} },
    },
    gifts: { $: { where: { "exchange.id": exchangeId } }, owner: {}, claim: {} },
    claimBuyers: { $: { where: { "exchange.id": exchangeId } }, claim: {} },
  });

  const ex = q.data?.exchanges?.[0];
  if (!ex) return { isLoading: q.isLoading, error: q.error, model: null };

  const group = ex.group!;
  const isAdmin = (group?.admins ?? []).some((a) => a.id === userId);
  // People who haven't picked a character get a different one each (in the order they were added), so
  // the family isn't a wall of the same face. Picked characters are never changed.
  const taken = new Set((ex.participants ?? []).map((p) => p.avatar).filter(Boolean));
  const spare = CHARACTERS.map((c) => c.key).filter((k) => !taken.has(k));
  const pool = spare.length ? spare : CHARACTERS.map((c) => c.key);
  let next = 0;
  const people = (ex.participants ?? [])
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .map((p) => (p.avatar ? p : { ...p, avatar: pool[next++ % pool.length] as string }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const me = people.find((p) => p.user?.id === userId) ?? null;
  const meInGroup = (group?.members ?? []).find((m) => m.user?.id === userId) ?? null;
  const assignments = ex.assignments ?? [];
  const myAssignment = me ? assignments.find((a) => a.giver?.id === me.id) ?? null : null;
  const myMatch = myAssignment?.recipient ? people.find((p) => p.id === myAssignment.recipient!.id) ?? myAssignment.recipient : null;
  const gifts = (q.data?.gifts ?? []).slice().sort((a, b) => a.createdAt - b.createdAt);
  const giftsByOwner = new Map<string, typeof gifts>();
  for (const g of gifts) {
    const o = g.owner?.id;
    if (!o) continue;
    if (!giftsByOwner.has(o)) giftsByOwner.set(o, []);
    giftsByOwner.get(o)!.push(g);
  }
  const myRows = (q.data?.claimBuyers ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const myClaimIds = new Set(myRows.map((r) => r.claim?.id).filter(Boolean) as string[]);
  const years = (group?.exchanges ?? []).slice().sort((a, b) => b.year - a.year);
  const organizers = (group?.members ?? []).filter((m) => m.role === "organizer");

  return {
    isLoading: false,
    error: q.error,
    model: {
      ex,
      group,
      isAdmin,
      people,
      me,
      meInGroup,
      assignments,
      myAssignment,
      myMatch,
      gifts,
      giftsByOwner,
      myRows,
      myClaimIds,
      years,
      organizers,
      drawn: ex.status === "drawn",
    },
  };
}

export type Model = NonNullable<ReturnType<typeof useExchange>["model"]>;
export type Person = Model["people"][number];
export type GiftT = Model["gifts"][number];
export type Row = Model["myRows"][number];
