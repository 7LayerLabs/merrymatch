"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HeroScene, Logo, Snow, Starburst } from "./art";

export function Splash({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4">
      <div className="relative h-16 w-16">
        <Starburst size={64} className="left-0 top-0" />
      </div>
      <div className="eyebrow text-muted">{label}</div>
    </div>
  );
}

/* Two-column card layout for sign in / join / create. */
export function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-16 md:grid-cols-[1fr_1.05fr]">
        <div className="card mx-auto w-full max-w-md p-6 sm:p-8">{children}</div>
        <div className="relative hidden md:block">
          {aside ?? <HeroScene />}
        </div>
      </main>
    </div>
  );
}

export function NightBand({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-pine text-cream">
      <Snow count={22} />
      <div className="relative">{children}</div>
    </div>
  );
}
