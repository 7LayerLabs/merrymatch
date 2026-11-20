import { test } from "node:test";
import assert from "node:assert/strict";
import { runDraw, removeAfterDraw, addAfterDraw, isValid, type Pair, type Rule } from "../src/lib/draw.ts";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const blocked = (rules: Rule[]) => new Set(rules.map((r) => `${r.from}\u0000${r.to}`));

test("1000 random draws are always valid, with rules", () => {
  const people = ids(12);
  const rules: Rule[] = [
    { from: "p0", to: "p1" }, { from: "p1", to: "p0" },
    { from: "p2", to: "p3" }, { from: "p3", to: "p2" },
    { from: "p4", to: "p5" },
  ];
  for (let i = 0; i < 1000; i++) {
    const r = runDraw(people, { exclusions: rules, noSwapPairs: true });
    assert.ok(r.ok);
    if (r.ok) assert.ok(isValid(r.pairs, people, blocked(rules), true));
  }
});

test("draw is roughly fair (each person drawn by each possible giver)", () => {
  const people = ids(5);
  const counts = new Map<string, number>();
  for (let i = 0; i < 20000; i++) {
    const r = runDraw(people, { exclusions: [] });
    if (r.ok) for (const p of r.pairs) counts.set(p.giver + p.recipient, (counts.get(p.giver + p.recipient) ?? 0) + 1);
  }
  const vals = [...counts.values()];
  assert.equal(vals.length, 20); // 5 givers x 4 recipients
  const min = Math.min(...vals), max = Math.max(...vals);
  assert.ok(max / min < 1.15, `spread ${min}..${max}`);
});

test("impossible rules give a clear error", () => {
  const people = ids(3);
  const r = runDraw(people, { exclusions: [{ from: "p0", to: "p1" }, { from: "p0", to: "p2" }] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /^NOBODY:p0/);
});

test("very tight rules still find the one answer", () => {
  // Only valid answer: a 6-cycle p0->p1->...->p5->p0
  const people = ids(6);
  const rules: Rule[] = [];
  for (const g of people) for (const r of people) {
    const gi = +g.slice(1), ri = +r.slice(1);
    if (g !== r && ri !== (gi + 1) % 6) rules.push({ from: g, to: r });
  }
  const r = runDraw(people, { exclusions: rules, noSwapPairs: true });
  assert.ok(r.ok);
});

test("avoids last year's pairs when possible", () => {
  const people = ids(8);
  const last: Rule[] = people.map((p, i) => ({ from: p, to: people[(i + 1) % 8] }));
  for (let i = 0; i < 200; i++) {
    const r = runDraw(people, { exclusions: [], avoid: last });
    assert.ok(r.ok && r.avoidedLastYear);
    if (r.ok) assert.ok(isValid(r.pairs, people, blocked(last), false));
  }
});

test("dropout and late joiner keep a valid draw and change few matches", () => {
  for (let i = 0; i < 500; i++) {
    const people = ids(7);
    const rules: Rule[] = [{ from: "p0", to: "p1" }, { from: "p1", to: "p0" }];
    const d = runDraw(people, { exclusions: rules, noSwapPairs: true });
    assert.ok(d.ok);
    if (!d.ok) return;
    const leaving = people[i % 7];
    const rem = removeAfterDraw(d.pairs, leaving, { exclusions: rules, noSwapPairs: true });
    assert.ok(rem.ok, !rem.ok ? rem.reason : "");
    if (!rem.ok) return;
    const left = people.filter((p) => p !== leaving);
    assert.ok(isValid(rem.pairs, left, blocked(rules), true));
    assert.ok(rem.changedGivers.length <= 2 || rem.changedGivers.length === left.length);
    const add = addAfterDraw(rem.pairs, "new", { exclusions: rules, noSwapPairs: true });
    assert.ok(add.ok);
    if (add.ok) assert.ok(isValid(add.pairs, [...left, "new"], blocked(rules), true));
  }
});
