"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { db } from "@/lib/db";
import { api } from "@/lib/api";
import { Logo } from "@/components/art";

// Local testing helper. The server refuses it outside `next dev` with MM_DEV_LOGIN=1.
// With no ?email it shows the test family from tests/seed-test10.mjs so you can hop between people.
const TEST_FAMILY: [string, string, string][] = [
  ["derek", "Derek", "Organizer. Runs the draw."],
  ["sam", "Sam", "Has a list. Can't draw Jordan."],
  ["jordan", "Jordan", "Has a list. Can't draw Sam."],
  ["taylor", "Taylor", "Has a list."],
  ["casey", "Casey", "Has a list."],
  ["morgan", "Morgan", "No list yet."],
  ["riley", "Riley", "No list yet."],
  ["rose", "Grandma Rose", "Has a list and notes."],
  ["mike", "Uncle Mike", "No list yet. Can't draw Aunt Lisa."],
  ["lisa", "Aunt Lisa", "Has a list. Can't draw Uncle Mike."],
];

const noSubscribe = () => () => {};

export default function DevLogin() {
  const [msg, setMsg] = useState("Signing in...");
  const picker = useSyncExternalStore(noSubscribe, () => !new URLSearchParams(location.search).get("email"), () => false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const email = p.get("email");
    const next = p.get("next") ?? "/";
    if (!email) return;
    (async () => {
      try {
        await db.auth.signOut().catch(() => {});
        const r = await api<{ token: string }>("devLogin", { email });
        await db.auth.signInWithToken(r.token);
        location.replace(next);
      } catch (e) {
        setMsg((e as Error).message);
      }
    })();
  }, []);

  if (!picker) return <div className="p-10 text-[14px]">{msg}</div>;
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <Logo />
      <div className="eyebrow mt-8 text-coral-2">Test mode</div>
      <h1 className="mt-1 font-script text-[38px] leading-tight text-pine">Be anyone in the Test Family</h1>
      <p className="mt-2 text-[14px] text-muted">
        Tap a person to see the app as them. To see two people at once, open a second person in a private window. Come back to
        localhost:3020/dev any time to switch.
      </p>
      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {TEST_FAMILY.map(([k, name, note]) => (
          <a
            key={k}
            href={`/dev?email=test-${k}@example.com&next=/`}
            className="card flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
          >
            <span className="font-display text-[17px] font-semibold text-pine">{name}</span>
            <span className="text-[13px] text-muted">{note}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
