"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { db } from "@/lib/db";
import { api } from "@/lib/api";
import { currentChristmasYear } from "@/lib/format";
import { AuthFlow } from "@/components/AuthFlow";
import { AuthShell, Splash } from "@/components/Shells";
import { Button, Field } from "@/components/ui";

export default function NewExchange() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [yourName, setYourName] = useState("");
  const [budget, setBudget] = useState("50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (isLoading) return <Splash />;
  if (!user)
    return (
      <AuthShell>
        <AuthFlow heading="Start your exchange" sub="First, confirm your email. You'll be the organizer." />
      </AuthShell>
    );

  const year = currentChristmasYear();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!groupName.trim()) return setError("Give your group a name, like \"The Bobola Family\".");
    if (!yourName.trim()) return setError("Enter your name as the family knows you.");
    setBusy(true);
    try {
      const r = await api<{ exchangeId: string }>("createGroup", { groupName, yourName, budget, year });
      router.replace(`/x/${r.exchangeId}?tab=organize&created=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={submit}>
        <div className="eyebrow text-coral-2">Christmas {year}</div>
        <h1 className="mt-1 font-script text-[36px] leading-tight text-pine">Set up your exchange</h1>
        <p className="mt-1 text-[14px] text-muted">You can change any of this later.</p>
        <div className="mt-5 grid gap-4">
          <Field label="Group name" hint="Shows up on every invite.">
            <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="The Bobola Family" maxLength={60} autoFocus />
          </Field>
          <Field label="Your name">
            <input className="input" value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder="Derek" maxLength={40} />
          </Field>
          <Field label="Spending limit per person" hint="What each person spends on their match, in total.">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input className="input pl-7" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} placeholder="50" />
            </div>
          </Field>
        </div>
        {error ? <p className="mt-3 text-[13px] font-medium text-coral-2">{error}</p> : null}
        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy} icon={<Sparkles className="h-4 w-4 text-gold" />}>
          Create exchange
        </Button>
      </form>
    </AuthShell>
  );
}
