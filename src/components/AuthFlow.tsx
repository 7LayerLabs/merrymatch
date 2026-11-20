"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { isEmail } from "@/lib/format";
import { Button, Field } from "./ui";

function friendly(e: unknown): string {
  const msg = String((e as { body?: { message?: string }; message?: string })?.body?.message ?? (e as Error)?.message ?? "");
  if (/expired|invalid|incorrect|not found/i.test(msg)) return "That code didn't work. Check the newest email from us, or send a new code.";
  if (/rate|too many/i.test(msg)) return "Too many tries. Wait a minute, then try again.";
  if (/network|fetch/i.test(msg)) return "We couldn't reach Merry Match. Check your connection.";
  return "That didn't work. Please try again.";
}

export function AuthFlow({
  lockedEmail,
  defaultEmail,
  heading = "Sign in",
  sub = "We'll email you a 6-digit code. No password to remember.",
}: {
  lockedEmail?: string | null;
  defaultEmail?: string;
  heading?: string;
  sub?: string;
}) {
  const [email, setEmail] = useState(lockedEmail ?? defaultEmail ?? "");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") setTimeout(() => codeRef.current?.focus(), 120);
  }, [step]);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!isEmail(e)) return setError("Enter your email address.");
    setBusy(true);
    setError("");
    try {
      await db.auth.sendMagicCode({ email: e });
      setEmail(e);
      setStep("code");
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    const c = value.replace(/\D/g, "");
    if (c.length !== 6) return setError("Enter the 6-digit code from your email.");
    setBusy(true);
    setError("");
    try {
      await db.auth.signInWithMagicCode({ email, code: c });
      // useAuth picks it up from here.
    } catch (err) {
      setError(friendly(err));
      setCode("");
      setBusy(false);
    }
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        {step === "email" ? (
          <motion.form
            key="email"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <h1 className="font-display text-[26px] font-semibold text-pine">{heading}</h1>
            <p className="mt-1 text-[14px] text-muted">{sub}</p>
            <Field label="Email" className="mt-5">
              <input
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus={!lockedEmail}
                value={email}
                readOnly={!!lockedEmail}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            {error ? <p className="mt-2 text-[13px] font-medium text-coral-2">{error}</p> : null}
            <Button type="submit" size="lg" className="mt-5 w-full" loading={busy} icon={<Mail className="h-4 w-4" />}>
              Email me a code
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <button type="button" onClick={() => setStep("email")} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-pine">
              <ArrowLeft className="h-3.5 w-3.5" /> {lockedEmail ? "Back" : "Use a different email"}
            </button>
            <h1 className="font-display text-[26px] font-semibold text-pine">Check your email</h1>
            <p className="mt-1 text-[14px] text-muted">
              We sent a 6-digit code to <span className="font-semibold text-ink">{email}</span>. It can take a minute, and sometimes lands in spam.
            </p>
            <Field label="Code" className="mt-5">
              <input
                ref={codeRef}
                className="input text-center font-display text-[26px] tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) verify(v);
                }}
                placeholder="000000"
              />
            </Field>
            {error ? <p className="mt-2 text-[13px] font-medium text-coral-2">{error}</p> : null}
            <Button type="submit" size="lg" className="mt-5 w-full" loading={busy}>
              Sign in
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await db.auth.sendMagicCode({ email });
                  setResent((n) => n + 1);
                } catch (err) {
                  setError(friendly(err));
                } finally {
                  setBusy(false);
                }
              }}
              className="mt-3 w-full text-center text-[13px] font-semibold text-muted hover:text-pine"
            >
              {resent ? "New code sent. Send another" : "Send a new code"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
