"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { Character } from "./avatars";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

/* ---------------- Button ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-pine text-[#fdf6ea] hover:bg-pine-2 shadow-[0_2px_0_#173127] active:translate-y-[1px] active:shadow-none",
  gold: "bg-gold text-pine-3 hover:bg-[#f2c977] shadow-[0_2px_0_#b9832f] active:translate-y-[1px] active:shadow-none",
  secondary: "bg-card text-pine border border-[var(--line-2)] hover:bg-white hover:border-pine/30",
  ghost: "text-pine hover:bg-pine/[0.06]",
  danger: "bg-coral-2 text-white hover:bg-[#a95541] shadow-[0_2px_0_#7d3c2d] active:translate-y-[1px] active:shadow-none",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}) {
  const sizes = {
    sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[10px]",
    md: "h-10 px-4 text-[14px] gap-2 rounded-xl",
    lg: "h-12 px-6 text-[15px] gap-2 rounded-2xl",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-55 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ---------------- Field ---------------- */

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-pine">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

/* ---------------- Avatar ---------------- */

const AVATAR_COLORS = [
  ["#96bdb0", "#173127"],
  ["#edbd62", "#4a3410"],
  ["#ce7e69", "#fff7ea"],
  ["#214337", "#f8e9ce"],
  ["#c6d8bd", "#2d5a49"],
  ["#e6a08b", "#5a2318"],
  ["#f3ca79", "#5b3a12"],
];

export function avatarColors(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, avatar, size = 36, ring }: { name: string; avatar?: string | null; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full ${ring ? "ring-2 ring-gold ring-offset-2 ring-offset-card" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Character name={name} avatar={avatar} size={size} />
    </span>
  );
}

/* ---------------- Candy-cane budget bar ---------------- */

export function CandyBar({ pct, over, dark }: { pct: number; over?: boolean; dark?: boolean }) {
  return (
    <div className={`relative h-3.5 overflow-hidden rounded-full ${dark ? "bg-white/10 ring-1 ring-white/10" : "bg-pine/[0.07] ring-1 ring-[var(--line)]"}`}>
      <motion.div
        className="relative h-full rounded-full shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]"
        style={{
          backgroundImage: over
            ? "repeating-linear-gradient(-45deg, #8f2d24 0 9px, #d24b3e 9px 18px)"
            : "repeating-linear-gradient(-45deg, #d24b3e 0 9px, #fdf6ea 9px 18px)",
          backgroundSize: "25.46px 25.46px",
          animation: "candy-roll 1.2s linear infinite",
        }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(pct, 0)}%` }}
        transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <span className="absolute inset-x-1 top-[2px] h-[3px] rounded-full bg-white/45" />
      </motion.div>
    </div>
  );
}

/* ---------------- Pill ---------------- */

export function Pill({ tone = "neutral", children, className = "" }: { tone?: "neutral" | "pine" | "gold" | "coral" | "teal"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-pine/[0.06] text-pine",
    pine: "bg-pine text-cream",
    gold: "bg-gold/30 text-[#7a5212]",
    coral: "bg-coral/20 text-coral-2",
    teal: "bg-teal/35 text-pine-3",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-pine-3/45 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-[var(--line)] bg-card shadow-[var(--shadow-lg)] sm:rounded-3xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--line)] bg-card/95 px-5 py-3.5 backdrop-blur">
              <div className="font-display text-[19px] font-semibold text-pine">{title}</div>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-pine/5 hover:text-pine" aria-label="Close">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ---------------- Confirm ---------------- */

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title}>
      <div className="text-[14px] leading-relaxed text-ink/85">{body}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------- Toasts ---------------- */

type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastCtx = createContext<{ ok: (t: string) => void; err: (e: unknown) => void }>({ ok: () => {}, err: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++n.current;
    setItems((x) => [...x.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "err" ? 6000 : 3200);
  }, []);
  const api = {
    ok: useCallback((t: string) => push("ok", t), [push]),
    err: useCallback(
      (e: unknown) => push("err", e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong. Please try again."),
      [push],
    ),
  };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-medium shadow-[var(--shadow-lg)] ${
                t.kind === "ok" ? "bg-pine text-cream" : "bg-[#fff1ea] text-[#8a3b28] ring-1 ring-coral/40"
              }`}
              role="status"
            >
              {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------------- Misc ---------------- */

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      {icon ? <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/30 text-pine">{icon}</div> : null}
      <div className="font-display text-[18px] font-semibold text-pine">{title}</div>
      {body ? <div className="mt-1 max-w-sm text-[14px] text-muted">{body}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-pine/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-pine" : "bg-pine/20"}`}>
        <motion.span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
          animate={{ left: checked ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </span>
      <span>
        <span className="block text-[14px] font-semibold text-pine">{label}</span>
        {hint ? <span className="block text-[12.5px] text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
