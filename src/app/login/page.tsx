"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { db } from "@/lib/db";
import { AuthFlow } from "@/components/AuthFlow";
import { AuthShell, Splash } from "@/components/Shells";

export default function LoginPage() {
  const { isLoading, user } = db.useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);
  if (isLoading || user) return <Splash />;
  return (
    <AuthShell>
      <AuthFlow
        heading="Welcome back"
        sub="Sign in on any phone, tablet or computer. We'll email you a 6-digit code, no password needed."
      />
      <p className="mt-6 border-t border-[var(--line)] pt-4 text-[12.5px] text-muted">
        First time here? Open the invite link your organizer texted you. It connects you to the right person.
      </p>
    </AuthShell>
  );
}
