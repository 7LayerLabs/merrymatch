// Run: node --test tests/parseList.test.ts
// Real-world pastes from Apple Notes, share buttons and texts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseList } from "../src/lib/parseList.ts";

const titles = (raw: string) => parseList(raw).gifts.map((g) => g.title);
const urls = (raw: string) => parseList(raw).gifts.map((g) => g.url);

test("one link per line, with words in front", () => {
  const r = parseList("Cozy socks https://www.target.com/p/socks/-/A-1\nYeti mug https://www.yeti.com/mug");
  assert.deepEqual(titles("Cozy socks https://www.target.com/p/socks/-/A-1\nYeti mug https://www.yeti.com/mug"), ["Cozy socks", "Yeti mug"]);
  assert.equal(r.gifts[0].store, "Target");
});

test("several links on one line become several gifts", () => {
  const raw = "https://a.co/d/abc123 https://a.co/d/def456 https://www.etsy.com/listing/123/mug";
  assert.equal(parseList(raw).gifts.length, 3);
  assert.deepEqual(urls(raw), ["https://a.co/d/abc123", "https://a.co/d/def456", "https://www.etsy.com/listing/123/mug"]);
  assert.ok(parseList(raw).gifts.every((g) => g.titleFromLink));
});

test("several named links on one line keep their names", () => {
  assert.deepEqual(titles("Socks https://target.com/p/1 Hat https://target.com/p/2 Gloves https://target.com/p/3"), ["Socks", "Hat", "Gloves"]);
});

test("links without https:// are found", () => {
  const g = parseList("LEGO set amazon.com/dp/B0ABCDEF12\nmug a.co/d/xyz").gifts;
  assert.equal(g.length, 2);
  assert.equal(g[0].url, "https://amazon.com/dp/B0ABCDEF12");
  assert.equal(g[1].url, "https://a.co/d/xyz");
  assert.equal(g[1].title, "mug");
});

test("Apple Notes invisible line breaks and spaces", () => {
  const raw = "Christmas list • Socks size L • Candle https://www.target.com/p/candle​ • Book";
  assert.deepEqual(titles(raw), ["Socks", "Candle", "Book"]);
  assert.equal(parseList(raw).gifts[0].size, "L");
});

test("share-button text is cleaned off", () => {
  assert.deepEqual(titles("Check out this deal on Amazon: Stanley Quencher 40 oz https://a.co/d/abc"), ["Stanley Quencher 40 oz"]);
  assert.deepEqual(titles("Amazon.com: Silk Pillowcase for Hair : Home & Kitchen https://a.co/d/q1"), ["Silk Pillowcase for Hair"]);
  assert.deepEqual(titles("I found this on Etsy: Custom name mug https://etsy.me/3abc"), ["Custom name mug"]);
  assert.deepEqual(titles("Check this out! https://www.target.com/p/x/-/A-9"), ["Item from Target"]);
});

test("a link on the line under its title attaches to it", () => {
  const g = parseList("Lululemon belt bag\nhttps://shop.lululemon.com/p/bag/123\n\nAirPods case $19").gifts;
  assert.equal(g.length, 2);
  assert.equal(g[0].title, "Lululemon belt bag");
  assert.equal(g[0].url, "https://shop.lululemon.com/p/bag/123");
  assert.equal(g[1].priceCents, 1900);
});

test("the same link twice only counts once", () => {
  assert.equal(parseList("https://a.co/d/abc\nmug https://a.co/d/abc").gifts.length, 1);
});

test("a dash before the link is not part of the name", () => {
  assert.deepEqual(titles("Fuzzy slippers — https://www.target.com/p/slippers"), ["Fuzzy slippers"]);
});

test("avoid section still works", () => {
  const r = parseList("Socks\nhttps://a.co/d/1 https://a.co/d/2\n\nAvoid:\nCandles\nCologne");
  assert.equal(r.gifts.length, 3);
  assert.equal(r.avoid, "Candles\nCologne");
});

test("note titles are not gifts", () => {
  assert.deepEqual(titles("Riley's Christmas list\nSocks"), ["Socks"]);
  assert.deepEqual(titles("Riley’s Christmas List\nSocks"), ["Socks"]);
  assert.deepEqual(titles("Wish list 2026\nSocks"), ["Socks"]);
  assert.deepEqual(titles("Christmas list for 2026\nSocks"), ["Socks"]);
  assert.deepEqual(titles("List of books to read\nSocks"), ["List of books to read", "Socks"]);
});
