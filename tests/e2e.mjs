// End-to-end check against a running dev server.
// Usage: node --env-file=.env.local tests/e2e.mjs [baseUrl]
// Creates a throwaway group with @example.com people, runs the whole season, checks privacy, then deletes it.
import { init } from "@instantdb/admin";

const BASE = process.argv[2] || "http://localhost:3020";
const db = init({ appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID, adminToken: process.env.INSTANT_APP_ADMIN_TOKEN });
const run = Date.now().toString(36);
const mail = (n) => `mm-test-${n}-${run}@example.com`;

let pass = 0,
  fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log("  PASS", label);
  } else {
    fail++;
    console.log("  FAIL", label);
  }
};

const tokens = {};
async function login(name) {
  const t = await db.auth.createToken({ email: mail(name) });
  tokens[name] = t;
}
async function call(who, action, body = {}) {
  const res = await fetch(`${BASE}/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  return { status: res.status, ...j };
}
const one = (x) => (Array.isArray(x) ? x[0] : x);
const as = (name) => db.asUser({ email: mail(name) });

const people = ["org", "amy", "ben", "cal", "dee", "eve"];
for (const p of people) await login(p);

console.log("Setup");
let r = await call(null, "createGroup", { groupName: "Test Family", yourName: "Olive", budget: 50, year: 2026 });
ok(r.status === 401, "createGroup needs sign-in");
r = await call("org", "createGroup", { groupName: `Test Family ${run}`, yourName: "Olive", budget: 50, year: 2026 });
ok(r.ok && r.exchangeId, "organizer creates group");
const X = r.exchangeId,
  G = r.groupId;

const ids = {};
for (const [n, label] of [["amy", "Amy"], ["ben", "Ben"], ["cal", "Cal"], ["dee", "Dee"]]) {
  r = await call("org", "addMember", { exchangeId: X, name: label, email: n === "ben" ? mail("ben") : undefined });
  ok(r.ok, `add ${label}`);
  ids[n] = r.memberId;
}
r = await call("org", "addMember", { exchangeId: X, name: "amy" });
ok(!r.ok && /already someone/.test(r.error), "duplicate name blocked");
r = await call("amy", "addMember", { exchangeId: X, name: "Zed" });
ok(r.status === 401 || r.status === 403 || r.status === 404, "non-member can't add people");

console.log("Invites");
const links = {};
for (const n of ["amy", "ben", "cal", "dee"]) {
  r = await call("org", "createInvite", { exchangeId: X, memberId: ids[n] });
  ok(r.ok && r.url.includes("/join/"), `invite link for ${n}`);
  links[n] = r.url.split("/join/")[1];
}
r = await call(null, "inviteInfo", { token: links.ben });
ok(r.ok && r.name === "Ben" && r.email === mail("ben") && !r.used, "invite info (no sign-in needed)");
r = await call("eve", "claimInvite", { token: links.ben });
ok(!r.ok && r.status === 403, "Ben's invite refuses a different email");
// Reissue cancels the old link
r = await call("org", "createInvite", { exchangeId: X, memberId: ids.amy });
const oldAmy = links.amy;
links.amy = r.url.split("/join/")[1];
r = await call(null, "inviteInfo", { token: oldAmy });
ok(!r.ok && r.status === 404, "reissued invite kills the old link");
for (const n of ["amy", "ben", "cal", "dee"]) {
  r = await call(n, "claimInvite", { token: links[n] });
  ok(r.ok && r.exchangeId === X, `${n} joins`);
}
r = await call("eve", "claimInvite", { token: links.cal });
ok(!r.ok && r.status === 409, "used invite can't be reused by someone else");
r = await call("org", "createInvite", { exchangeId: X, memberId: ids.cal });
ok(!r.ok, "can't invite someone who already joined");

console.log("Wishlists");
const gift = {};
for (const n of ["amy", "ben", "cal", "dee"]) {
  r = await call(n, "saveGift", { exchangeId: X, title: `${n} wants socks`, priceCents: 1800, url: "https://www.target.com/p/socks" });
  ok(r.ok, `${n} adds a gift`);
  gift[n] = r.giftId;
}
r = await call("amy", "saveGift", { exchangeId: X, title: "bad", imageUrl: "javascript:alert(1)" });
ok(!r.ok, "javascript: image link rejected");
r = await call("amy", "saveGift", { exchangeId: X, giftId: gift.ben, title: "hijack" });
ok(!r.ok, "can't edit someone else's gift");
r = await call("cal", "importGifts", { exchangeId: X, gifts: [{ title: "Book", priceCents: 2500 }, { title: "Lego", url: "https://www.lego.com/x", priceCents: 9900 }], avoid: "Candles" });
ok(r.ok && r.added === 2, "import adds 2");
r = await call("dee", "saveNotes", { exchangeId: X, notes: "Size M" });
ok(r.ok, "notes saved");

console.log("Shopping + privacy");
r = await call("amy", "shop", { giftId: gift.ben, action: "reserve" });
ok(r.ok, "Amy reserves Ben's gift");
r = await call("cal", "shop", { giftId: gift.ben, action: "reserve" });
ok(!r.ok && r.status === 409, "Cal can't take it");
r = await call("ben", "shop", { giftId: gift.ben, action: "reserve" });
ok(!r.ok, "Ben can't shop his own list");
r = await call("amy", "shop", { giftId: gift.ben, action: "purchase", priceCents: 2000 });
ok(r.ok, "Amy marks it bought");
let q = await as("ben").query({ gifts: { $: { where: { id: gift.ben } }, claim: {} }, claims: {} });
ok(q.gifts.length === 1 && !one(q.gifts[0].claim) && q.claims.length === 0, "Ben can't see coverage on his own gift");
q = await as("cal").query({ claims: { gift: {} }, claimBuyers: {} });
ok(q.claims.some((c) => one(c.gift)?.id === gift.ben) && q.claimBuyers.length === 0, "Cal sees 'covered' but not who");
if (!q.claims.some((c) => one(c.gift)?.id === gift.ben)) console.log("    DEBUG cal claims", JSON.stringify(q).slice(0, 400));
q = await as("amy").query({ claimBuyers: {} });
ok(q.claimBuyers.length === 1 && q.claimBuyers[0].priceCents === 2000, "Amy sees her own purchase");
q = await as("eve").query({ gifts: {}, groups: {}, members: {} });
ok(q.gifts.length === 0 && q.groups.length === 0 && q.members.length === 0, "outsider sees nothing");
q = await as("amy").query({ invites: {} });
ok(q.invites.length === 0, "invites never readable");
q = await as("amy").query({ members: { $: { where: { id: ids.ben } } } });
ok(q.members[0] && q.members[0].email === undefined, "members can't see each other's email");
q = await as("org").query({ members: { $: { where: { id: ids.ben } } } });
ok(q.members[0]?.email === mail("ben"), "organizer can see emails");
try {
  await as("amy").transact(db.tx.gifts[gift.ben].update({ title: "x" }));
  ok(false, "browser writes blocked");
} catch {
  ok(true, "browser writes blocked");
}

console.log("Rules + draw");
r = await call("org", "addExclusion", { exchangeId: X, from: ids.amy, to: ids.ben, both: true });
ok(r.ok, "Amy and Ben can't draw each other");
r = await call("amy", "draw", { exchangeId: X });
ok(!r.ok && r.status === 403, "only organizer draws");
const [d1, d2] = await Promise.all([call("org", "draw", { exchangeId: X }), call("org", "draw", { exchangeId: X })]);
ok([d1, d2].filter((x) => x.ok).length === 1, "double-click draw makes exactly one draw");
r = await call("org", "addExclusion", { exchangeId: X, from: ids.cal, to: ids.dee });
ok(!r.ok, "rules lock after draw");

const all = await db.query({ assignments: { $: { where: { "exchange.id": X } }, giver: {}, recipient: {} } });
const pairs = all.assignments.map((a) => [one(a.giver).id, one(a.recipient).id]);
const orgId = (await db.query({ members: { $: { where: { "group.id": G, role: "organizer" } } } })).members[0].id;
const everyone = [orgId, ids.amy, ids.ben, ids.cal, ids.dee];
const valid = (ps, idsList) =>
  ps.length === idsList.length &&
  new Set(ps.map((p) => p[0])).size === idsList.length &&
  new Set(ps.map((p) => p[1])).size === idsList.length &&
  ps.every(([g, rcp]) => g !== rcp);
ok(valid(pairs, everyone), "everyone gives once and gets once");
if (!valid(pairs, everyone)) console.log("    DEBUG", JSON.stringify({ pairs, everyone }));
ok(!pairs.some(([g, rcp]) => (g === ids.amy && rcp === ids.ben) || (g === ids.ben && rcp === ids.amy)), "exclusions respected");
const map = new Map(pairs);
ok(!pairs.some(([g, rcp]) => map.get(rcp) === g), "no swapping pairs");

for (const n of ["org", "amy", "ben", "cal", "dee"]) {
  q = await as(n).query({ assignments: { giver: {} } });
  ok(q.assignments.length === 1, `${n} sees only their own match`);
}

console.log("Dropout + late joiner");
r = await call("org", "removeMember", { exchangeId: X, memberId: ids.dee });
ok(r.ok && r.rewired, "Dee removed after draw, draw patched");
let after = (await db.query({ assignments: { $: { where: { "exchange.id": X } }, giver: {}, recipient: {} } })).assignments.map((a) => [one(a.giver).id, one(a.recipient).id]);
ok(valid(after, [orgId, ids.amy, ids.ben, ids.cal]), "still a valid draw without Dee");
ok(!after.some(([g, rcp]) => (g === ids.amy && rcp === ids.ben) || (g === ids.ben && rcp === ids.amy)), "exclusions still respected");
r = await call("org", "addMember", { exchangeId: X, name: "Eve" });
ok(r.ok && r.rewired, "Eve added after draw and slotted in");
ids.eve = r.memberId;
after = (await db.query({ assignments: { $: { where: { "exchange.id": X } }, giver: {}, recipient: {} } })).assignments.map((a) => [one(a.giver).id, one(a.recipient).id]);
ok(valid(after, [orgId, ids.amy, ids.ben, ids.cal, ids.eve]), "valid draw with Eve");

console.log("Seal");
q = await as("org").query({ assignments: {} });
ok(q.assignments.length === 1, "organizer can't see the list while sealed");
r = await call("org", "openSeal", { exchangeId: X });
ok(r.ok, "organizer breaks the seal");
q = await as("org").query({ assignments: {} });
ok(q.assignments.length === 5, "organizer sees all after breaking seal");
q = await as("amy").query({ exchanges: { $: { where: { id: X } } } });
ok(q.exchanges[0].sealOpen === true && q.exchanges[0].sealOpenedBy === "Olive", "everyone sees the seal was opened, and by whom");

console.log("Tools");
r = await call("org", "backup", { exchangeId: X });
ok(r.ok && r.christmases?.[0]?.wishlists?.length >= 4 && !JSON.stringify(r).includes("buyer"), "backup has wishlists, no buyer info");
r = await call("amy", "backup", { exchangeId: X });
ok(!r.ok, "only organizer can download backup");
r = await call("org", "newYear", { fromExchangeId: X, year: 2027 });
ok(r.ok, "start Christmas 2027");
const X2 = r.exchangeId;
r = await call("amy", "copyLastYearGifts", { exchangeId: X2 });
ok(r.ok && r.added === 1 && r.year === 2026, "Amy brings over last year's list");
r = await call("org", "newYear", { fromExchangeId: X, year: 2027 });
ok(!r.ok, "can't create the same year twice");
r = await call("org", "draw", { exchangeId: X2 });
ok(r.ok && r.hadLastYear, "2027 draw considers last year's pairs");

console.log("Cleanup");
await db.transact(db.tx.groups[G].delete());
const leftovers = await db.query({ exchanges: { $: { where: { id: X } } } });
ok(leftovers.exchanges.length === 0, "test data removed");
for (const p of people) {
  try {
    await db.auth.deleteUser({ email: mail(p) });
  } catch {}
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
