// Seeds a sample family into the DEV app for visual QA. Never point this at production.
// Usage: node --env-file=.env.local tests/seed-demo.mjs [baseUrl] [--draw]
import { init } from "@instantdb/admin";

const BASE = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3020";
const DRAW = process.argv.includes("--draw");
const db = init({ appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID, adminToken: process.env.INSTANT_APP_ADMIN_TOKEN });
const mail = (n) => `demo-${n}@example.com`;
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

// Clear any earlier demo group.
const old = await db.query({ members: { $: { where: { "user.email": mail("olive") } }, group: {} } });
for (const m of old.members) { const g = Array.isArray(m.group) ? m.group[0] : m.group; if (g) await db.transact(db.tx.groups[g.id].delete()); }

const { exchangeId: X } = await call("olive", "createGroup", { groupName: "The Hollis Family", yourName: "Olive Hollis", budget: 50, year: 2026 });
const people = { amy: "Amy", ben: "Ben", cal: "Cal", dee: "Dee", gus: "Grandpa Gus" };
const ids = {};
for (const [k, name] of Object.entries(people)) {
  ids[k] = (await call("olive", "addMember", { exchangeId: X, name, email: mail(k) })).memberId;
}
for (const k of ["amy", "ben", "cal", "dee"]) {
  const { url } = await call("olive", "createInvite", { exchangeId: X, memberId: ids[k] });
  await call(k, "claimInvite", { token: url.split("/join/")[1] });
}
await call("olive", "addExclusion", { exchangeId: X, from: ids.amy, to: ids.ben, both: true });

const lists = {
  olive: [
    ["Le Creuset Dutch oven, 5.5 qt", 42000, "Williams Sonoma", null, "Cerise"],
    ["Cozy cable-knit throw blanket", 4900, "Target", null, "Oatmeal"],
    ["Ina Garten cookbook", 2200, "Barnes & Noble"],
  ],
  amy: [
    ["Stanley Quencher 40 oz", 4500, "Target", null, "Rose Quartz"],
    ["Lululemon belt bag", 3800, "lululemon", null, "Black"],
    ["Silk pillowcase", 2900, "Amazon"],
    ["Sephora gift card", 2500, "Sephora"],
  ],
  ben: [
    ["LEGO Technic McLaren", 4999, "LEGO"],
    ["Celtics hoodie", 6500, "Nike", "L", "Green"],
    ["Wireless earbuds", 3999, "Best Buy"],
  ],
  cal: [
    ["Golf balls, Pro V1 dozen", 5500, "Dick's"],
    ["Yeti Rambler 20 oz", 3500, "Yeti", null, "Navy"],
  ],
  dee: [["Paint-by-numbers kit", 2400, "Amazon"], ["Fuzzy slippers", 2800, "Target", "8", "Pink"]],
};
const gifts = {};
for (const [who, rows] of Object.entries(lists)) {
  gifts[who] = [];
  for (const [title, priceCents, store, size, color] of rows) {
    gifts[who].push((await call(who, "saveGift", { exchangeId: X, title, priceCents, store, size, color })).giftId);
  }
}
await call("ben", "saveNotes", { exchangeId: X, notes: "Hoodie: L, shoes: 10\nLoves: Celtics, LEGO, anything Star Wars\nAvoid: candles, cologne" });
await call("olive", "saveNotes", { exchangeId: X, notes: "Sweater: M\nLoves: cooking, gardening, Dunkin\nPlease avoid: scented anything" });
await call("cal", "shop", { giftId: gifts.amy[0], action: "reserve" });
await call("dee", "shop", { giftId: gifts.ben[1], action: "purchase", priceCents: 6500 });
await call("amy", "shop", { giftId: gifts.ben[0], action: "reserve" });
await call("amy", "shop", { giftId: gifts.olive[2], action: "purchase", priceCents: 2200 });
if (DRAW) await call("olive", "draw", { exchangeId: X });
console.log(JSON.stringify({ exchangeId: X }));
