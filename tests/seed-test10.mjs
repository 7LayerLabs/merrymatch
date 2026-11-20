// Seeds a 10-person TEST family into the DEV app so you can click through the whole flow.
// Names are not drawn, so you get to run the draw yourself as the organizer.
// Usage: node --env-file=.env.local tests/seed-test10.mjs [baseUrl]
// Never point this at production.
import { init } from "@instantdb/admin";

const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3020";
const db = init({ appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID, adminToken: process.env.INSTANT_APP_ADMIN_TOKEN });
const mail = (k) => `test-${k}@example.com`;
const tokens = {};
async function call(who, action, body = {}) {
  tokens[who] ??= await db.auth.createToken({ email: mail(who) });
  const res = await fetch(`${BASE}/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[who]}` },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`${action}: ${j.error}`);
  return j;
}

// Clear an earlier copy of this test family so the script can be rerun.
const old = await db.query({ members: { $: { where: { "user.email": mail("derek") } }, group: {} } });
for (const m of old.members) {
  const g = Array.isArray(m.group) ? m.group[0] : m.group;
  if (g) await db.transact(db.tx.groups[g.id].delete());
}

const { exchangeId: X } = await call("derek", "createGroup", {
  groupName: "The Test Family",
  yourName: "Derek",
  budget: 50,
  year: 2026,
});

export const PEOPLE = {
  sam: "Sam",
  jordan: "Jordan",
  taylor: "Taylor",
  casey: "Casey",
  morgan: "Morgan",
  riley: "Riley",
  rose: "Grandma Rose",
  mike: "Uncle Mike",
  lisa: "Aunt Lisa",
};
const ids = {};
for (const [k, name] of Object.entries(PEOPLE)) {
  ids[k] = (await call("derek", "addMember", { exchangeId: X, name, email: mail(k) })).memberId;
  const { url } = await call("derek", "createInvite", { exchangeId: X, memberId: ids[k] });
  await call(k, "claimInvite", { token: url.split("/join/")[1] });
}

// Spouses can't draw each other.
await call("derek", "addExclusion", { exchangeId: X, from: ids.mike, to: ids.lisa, both: true });
await call("derek", "addExclusion", { exchangeId: X, from: ids.sam, to: ids.jordan, both: true });

// Seven people made lists. Riley, Morgan and Uncle Mike haven't yet, like real life.
const lists = {
  derek: [
    ["Celtics City Edition hoodie", 7500, "Fanatics", "XL", "Green"],
    ["Yeti Rambler 30 oz", 3800, "Yeti", null, "Black"],
    ["Golf balls, Pro V1 dozen", 5500, "Dick's"],
  ],
  sam: [
    ["Stanley Quencher 40 oz", 4500, "Target", null, "Rose Quartz"],
    ["Silk pillowcase", 2900, "Amazon"],
    ["Sephora gift card", 2500, "Sephora"],
  ],
  jordan: [
    ["LEGO Technic car", 4999, "LEGO"],
    ["Wireless earbuds", 3999, "Best Buy"],
  ],
  taylor: [
    ["Lululemon belt bag", 3800, "lululemon", null, "Black"],
    ["Fuzzy slippers", 2800, "Target", "8", "Pink"],
    ["Paint-by-numbers kit", 2400, "Amazon"],
  ],
  casey: [
    ["Nintendo eShop card", 2500, "Nintendo"],
    ["Hoodie", 4000, "Nike", "M", "Gray"],
  ],
  rose: [
    ["Cozy cable-knit throw", 4900, "Target", null, "Oatmeal"],
    ["Large-print crossword book", 1200, "Barnes & Noble"],
  ],
  lisa: [
    ["Ina Garten cookbook", 2200, "Barnes & Noble"],
    ["Candle-free spa set", 3500, "Ulta"],
  ],
};
for (const [who, rows] of Object.entries(lists)) {
  for (const [title, priceCents, store, size, color] of rows) {
    await call(who, "saveGift", { exchangeId: X, title, priceCents, store, size, color });
  }
}
await call("derek", "saveNotes", { exchangeId: X, notes: "Hoodie: XL\nLoves: Celtics, golf, coffee\nAvoid: cologne" });
await call("rose", "saveNotes", { exchangeId: X, notes: "Sweater: M\nLoves: puzzles, gardening, tea\nPlease avoid: scented anything" });

console.log(JSON.stringify({ exchangeId: X }));
