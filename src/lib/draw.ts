// Pure draw logic. No database here, so it can be unit tested.

export type Pair = { giver: string; recipient: string };
export type Rule = { from: string; to: string };

export type DrawOptions = {
  exclusions: Rule[];
  noSwapPairs?: boolean; // forbid A->B and B->A in the same draw
  avoid?: Rule[]; // soft: last year's pairs. Dropped if impossible.
  random?: () => number; // [0,1)
};

export type DrawResult =
  | { ok: true; pairs: Pair[]; avoidedLastYear: boolean }
  | { ok: false; reason: string };

export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function key(a: string, b: string) {
  return `${a}\u0000${b}`;
}

function blockedSet(rules: Rule[]) {
  return new Set(rules.map((r) => key(r.from, r.to)));
}

export function isValid(
  pairs: Pair[],
  ids: string[],
  blocked: Set<string>,
  noSwapPairs: boolean,
): boolean {
  if (pairs.length !== ids.length) return false;
  const givers = new Set<string>();
  const recips = new Set<string>();
  const map = new Map<string, string>();
  for (const p of pairs) {
    if (p.giver === p.recipient) return false;
    if (blocked.has(key(p.giver, p.recipient))) return false;
    if (givers.has(p.giver) || recips.has(p.recipient)) return false;
    givers.add(p.giver);
    recips.add(p.recipient);
    map.set(p.giver, p.recipient);
  }
  if (noSwapPairs && ids.length > 2) {
    for (const p of pairs) if (map.get(p.recipient) === p.giver) return false;
  }
  return ids.every((id) => givers.has(id) && recips.has(id));
}

// Randomized augmenting-path matching. Used when random shuffles keep failing
// because the rules are tight.
function matchingAttempt(ids: string[], blocked: Set<string>, rnd: () => number): Pair[] | null {
  const order = shuffle(ids, rnd);
  const cands = new Map<string, string[]>();
  for (const g of ids) {
    cands.set(g, shuffle(ids.filter((r) => r !== g && !blocked.has(key(g, r))), rnd));
  }
  const ownerOf = new Map<string, string>(); // recipient -> giver
  const tryAssign = (g: string, seen: Set<string>): boolean => {
    for (const r of cands.get(g)!) {
      if (seen.has(r)) continue;
      seen.add(r);
      const cur = ownerOf.get(r);
      if (cur === undefined || tryAssign(cur, seen)) {
        ownerOf.set(r, g);
        return true;
      }
    }
    return false;
  };
  for (const g of order) if (!tryAssign(g, new Set())) return null;
  return [...ownerOf.entries()].map(([recipient, giver]) => ({ giver, recipient }));
}

function attempt(ids: string[], blocked: Set<string>, noSwap: boolean, rnd: () => number): Pair[] | null {
  // 1) Uniform: shuffle until the result follows every rule.
  for (let t = 0; t < 4000; t++) {
    const perm = shuffle(ids, rnd);
    const pairs = ids.map((g, i) => ({ giver: g, recipient: perm[i] }));
    if (isValid(pairs, ids, blocked, noSwap)) return pairs;
  }
  // 2) Tight rules: randomized matching.
  for (let t = 0; t < 400; t++) {
    const pairs = matchingAttempt(ids, blocked, rnd);
    if (!pairs) return null; // matching proves impossible
    if (isValid(pairs, ids, blocked, noSwap)) return pairs;
  }
  return null;
}

export function runDraw(ids: string[], opts: DrawOptions): DrawResult {
  const rnd = opts.random ?? cryptoRandom;
  if (ids.length < 3) return { ok: false, reason: "You need at least 3 people to draw names." };
  const hard = blockedSet(opts.exclusions);
  const noSwap = !!opts.noSwapPairs;

  for (const g of ids) {
    const options = ids.filter((r) => r !== g && !hard.has(key(g, r)));
    if (options.length === 0) {
      return { ok: false, reason: "NOBODY:" + g };
    }
  }

  if (opts.avoid?.length) {
    const soft = new Set([...hard, ...blockedSet(opts.avoid)]);
    const p = attempt(ids, soft, noSwap, rnd);
    if (p) return { ok: true, pairs: p, avoidedLastYear: true };
  }
  const p = attempt(ids, hard, noSwap, rnd);
  if (p) return { ok: true, pairs: p, avoidedLastYear: false };
  return {
    ok: false,
    reason: noSwap
      ? "These rules leave no way to draw. Try removing a rule or turning off 'No swapping pairs'."
      : "These rules leave no way to draw. Try removing a rule.",
  };
}

// Someone leaves after the draw. Rewire with the fewest changes and without revealing anything.
export function removeAfterDraw(
  pairs: Pair[],
  leaving: string,
  opts: { exclusions: Rule[]; noSwapPairs?: boolean; random?: () => number },
): { ok: true; pairs: Pair[]; changedGivers: string[] } | { ok: false; reason: string } {
  const rnd = opts.random ?? cryptoRandom;
  const blocked = blockedSet(opts.exclusions);
  const ids = pairs.map((p) => p.giver).filter((id) => id !== leaving);
  if (ids.length < 3) return { ok: false, reason: "At least 3 people need to stay in the exchange." };
  const g = pairs.find((p) => p.recipient === leaving)?.giver;
  const r = pairs.find((p) => p.giver === leaving)?.recipient;
  if (!g || !r) return { ok: false, reason: "That person isn't in the draw." };
  const rest = pairs.filter((p) => p.giver !== leaving && p.recipient !== leaving);
  const noSwap = !!opts.noSwapPairs;

  // Simple close: G now shops for R.
  if (g !== r) {
    const simple = [...rest, { giver: g, recipient: r }];
    if (isValid(simple, ids, blocked, noSwap)) return { ok: true, pairs: simple, changedGivers: [g] };
  }
  // Otherwise, trade with one other pair (two people get new matches).
  for (const other of shuffle(rest, rnd)) {
    const trial = rest
      .filter((p) => p !== other)
      .concat([
        { giver: g, recipient: other.recipient },
        { giver: other.giver, recipient: r },
      ]);
    if (isValid(trial, ids, blocked, noSwap)) return { ok: true, pairs: trial, changedGivers: [g, other.giver] };
  }
  // Last resort: full redraw of everyone.
  const full = runDraw(ids, { exclusions: opts.exclusions, noSwapPairs: noSwap, random: rnd });
  if (full.ok) return { ok: true, pairs: full.pairs, changedGivers: ids };
  return { ok: false, reason: "The rules don't allow a valid match without this person. Remove a rule and try again." };
}

// Someone joins after the draw: slot them into the circle.
export function addAfterDraw(
  pairs: Pair[],
  joining: string,
  opts: { exclusions: Rule[]; noSwapPairs?: boolean; random?: () => number },
): { ok: true; pairs: Pair[]; changedGivers: string[] } | { ok: false; reason: string } {
  const rnd = opts.random ?? cryptoRandom;
  const blocked = blockedSet(opts.exclusions);
  const ids = [...pairs.map((p) => p.giver), joining];
  const noSwap = !!opts.noSwapPairs;
  for (const p of shuffle(pairs, rnd)) {
    const trial = pairs
      .filter((x) => x !== p)
      .concat([
        { giver: p.giver, recipient: joining },
        { giver: joining, recipient: p.recipient },
      ]);
    if (isValid(trial, ids, blocked, noSwap)) return { ok: true, pairs: trial, changedGivers: [p.giver, joining] };
  }
  return { ok: false, reason: "The rules don't leave a spot for this person. Remove a rule and try again." };
}
