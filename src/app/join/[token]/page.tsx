"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { api } from "@/lib/api";
import { firstName } from "@/lib/format";
import { AuthFlow } from "@/components/AuthFlow";
import { AuthShell, Splash } from "@/components/Shells";
import { Button } from "@/components/ui";

type Info = { name: string; groupName: string; year: number | null; email: string | null; used: boolean };

export default function JoinPage() {
  return (
    <Suspense fallback={<Splash label="Opening your invite" />}>
      <JoinInner />
    </Suspense>
  );
}

function JoinInner() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isLoading: authLoading, user } = db.useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [claimError, setClaimError] = useState("");
  const claiming = useRef(false);

  useEffect(() => {
    api<Info>("inviteInfo", { token })
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (!user || !info || claiming.current) return;
    claiming.current = true;
    api<{ exchangeId: string | null }>("claimInvite", { token })
      .then((r) => router.replace(r.exchangeId ? `/x/${r.exchangeId}?welcome=1` : "/"))
      .catch((e) => {
        setClaimError(e.message);
        claiming.current = false;
      });
  }, [user, info, token, router]);

  if (error)
    return (
      <AuthShell>
        <h1 className="font-display text-[24px] font-semibold text-pine">This invite isn&apos;t working</h1>
        <p className="mt-2 text-[14px] text-muted">{error}</p>
        <p className="mt-4 text-[14px] text-muted">Already joined before? Just sign in with your email.</p>
        <Link href="/login" className="mt-5 block">
          <Button className="w-full">Sign in</Button>
        </Link>
      </AuthShell>
    );

  if (!info || authLoading) return <Splash label="Opening your invite" />;

  if (user && !claimError) return <Splash label="Joining" />;

  if (claimError)
    return (
      <AuthShell>
        <h1 className="font-display text-[24px] font-semibold text-pine">Almost there</h1>
        <p className="mt-2 text-[14px] text-ink/80">{claimError}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="secondary" onClick={() => db.auth.signOut().then(() => setClaimError(""))}>
            Sign in with a different email
          </Button>
          <Link href="/">
            <Button variant="ghost" className="w-full">
              Go to my exchanges
            </Button>
          </Link>
        </div>
      </AuthShell>
    );

  if (info.used)
    return (
      <AuthShell>
        <h1 className="font-display text-[24px] font-semibold text-pine">This invite was already used</h1>
        <p className="mt-2 text-[14px] text-muted">
          If that was you, just sign in with your email. If it wasn&apos;t, let your organizer know so they can sort it out.
        </p>
        <Link href="/login" className="mt-5 block">
          <Button className="w-full">Sign in</Button>
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-2xl bg-pine p-4 text-cream">
        <div className="eyebrow text-gold">You&apos;re invited</div>
        <div className="mt-1 font-display text-[20px] font-semibold leading-tight">
          Hi {firstName(info.name)}! Join {info.groupName}
          {info.year ? ` for Christmas ${info.year}` : ""}.
        </div>
      </motion.div>
      <AuthFlow
        lockedEmail={info.email}
        heading="Confirm it's you"
        sub={
          info.email
            ? "We'll send a 6-digit code to the email your organizer has for you. After this, you can sign in on any device the same way."
            : "Enter your email and we'll send you a 6-digit code. You'll use the same email to sign in on any device."
        }
      />
    </AuthShell>
  );
}
