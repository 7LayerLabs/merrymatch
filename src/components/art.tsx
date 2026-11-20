"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

/* Logo: a tag on a ribbon. */
export function Logo({ className = "", light }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect x="4" y="9" width="24" height="19" rx="3" fill="#edbd62" stroke="#87583f" strokeWidth="1.6" />
        <rect x="2.5" y="6.5" width="27" height="6" rx="2" fill="#f3ca79" stroke="#87583f" strokeWidth="1.6" />
        <rect x="14" y="6.5" width="4" height="21.5" fill="#9d5241" />
        <path d="M16 6.5c-3-5-8.5-4-7.5-.6.7 2.2 4.6 1.4 7.5.6zm0 0c3-5 8.5-4 7.5-.6-.7 2.2-4.6 1.4-7.5.6z" fill="#ce7e69" stroke="#87583f" strokeWidth="1.3" />
      </svg>
      <span className={`font-script text-[25px] leading-none ${light ? "text-cream" : "text-pine"}`}>
        Merry Match
      </span>
    </span>
  );
}

export function Starburst({ size = 28, color = "#d89136", className = "", delay = 0 }: { size?: number; color?: string; className?: string; delay?: number }) {
  return (
    <span
      className={`starburst pointer-events-none absolute block ${className}`}
      style={{ width: size, height: size, background: color, animation: `twinkle 3.6s ease-in-out ${delay}s infinite` }}
      aria-hidden
    />
  );
}

function Parcel({
  className,
  wrap,
  shade,
  ribbon,
  outline,
  tilt,
  delay,
}: {
  className: string;
  wrap: string;
  shade: string;
  ribbon: string;
  outline: string;
  tilt: number;
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`absolute ${className}`}
      initial={{ y: 60, opacity: 0, rotate: tilt * 2 }}
      animate={{ y: 0, opacity: 1, rotate: tilt }}
      transition={{ type: "spring", stiffness: 140, damping: 14, delay }}
    >
      <div style={{ animation: reduce ? undefined : `bob ${4.4 + delay}s ease-in-out ${delay}s infinite` }} className="relative h-full w-full">
        {/* box */}
        <div
          className="absolute inset-0 top-[14%] rounded-[4px]"
          style={{
            border: `2px solid ${outline}`,
            background: `linear-gradient(90deg,transparent 42%,${ribbon} 42% 57%,transparent 57%),${wrap}`,
            boxShadow: `5px 6px 0 ${shade}`,
          }}
        />
        {/* lid */}
        <div
          className="absolute -left-[6%] -right-[6%] top-[4%] h-[20%] rounded-[4px]"
          style={{ border: `2px solid ${outline}`, background: `linear-gradient(90deg,transparent 43%,${ribbon} 43% 57%,transparent 57%),${wrap}` }}
        />
        {/* bow */}
        <svg viewBox="0 0 60 30" className="absolute left-1/2 top-[-14%] w-[52%] -translate-x-1/2" aria-hidden>
          <path d="M30 26C22 6 6 4 6 15s16 9 24 11zm0 0C38 6 54 4 54 15S38 24 30 26z" fill={ribbon} stroke={outline} strokeWidth="2" />
          <circle cx="30" cy="25" r="4.5" fill={ribbon} stroke={outline} strokeWidth="2" />
        </svg>
      </div>
    </motion.div>
  );
}

/* The retro hero scene, rebuilt from the original Merry Match art direction. */
export function HeroScene({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative aspect-[5/4] w-full ${className}`} aria-hidden>
      <motion.div
        className="absolute inset-[8%_10%_6%_8%] bg-teal"
        style={{ clipPath: "polygon(1% 31%,100% 0,80% 91%,27% 100%)" }}
        initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <motion.div
        className="checker-band absolute left-0 top-[62%] h-[12%] w-full opacity-70"
        style={{ rotate: -5 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <motion.div
        className="absolute inset-[25%_3%_22%_2%] rounded-[50%] border-[5px] border-gold"
        style={{ rotate: -22 }}
        initial={{ pathLength: 0, opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.4 }}
      />
      <motion.div
        className="absolute inset-[25%_3%_22%_2%]"
        style={{ rotate: -22 }}
        animate={reduce ? undefined : { rotate: [-22, 338] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute -top-2 left-1/2 h-3.5 w-3.5 rounded-full bg-gold shadow-[0_0_0_4px_rgba(237,189,98,.3)]" />
      </motion.div>
      <Parcel className="left-[20%] bottom-[14%] h-[30%] w-[24%]" wrap="#e6a08b" shade="#bd7663" ribbon="#fff1c5" outline="#a7584a" tilt={-4} delay={0.55} />
      <Parcel className="left-[30%] bottom-[22%] h-[52%] w-[34%]" wrap="#f3ca79" shade="#bb8657" ribbon="#9d5241" outline="#87583f" tilt={-10} delay={0.4} />
      <Parcel className="left-[59%] bottom-[18%] h-[40%] w-[27%]" wrap="#c6d8bd" shade="#658b78" ribbon="#f8e7aa" outline="#456d5d" tilt={11} delay={0.7} />
      <Starburst size={34} className="right-[10%] top-[8%]" delay={0.2} />
      <Starburst size={20} color="#ce7e69" className="left-[8%] top-[22%]" delay={1.1} />
      <Starburst size={16} color="#214337" className="right-[24%] bottom-[8%]" delay={0.6} />
      <Starburst size={12} color="#d89136" className="left-[46%] top-[4%]" delay={1.8} />
    </div>
  );
}

/* A six-armed snowflake. */
function Flake({ size, opacity }: { size: number; opacity: number }) {
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} style={{ opacity }} className="block">
      <g stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none">
        {[0, 60, 120].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0 -10V10" />
            <path d="M-3 -7.5L0 -5l3 -2.5M-3 7.5L0 5l3 2.5" />
          </g>
        ))}
      </g>
      <circle r="1.6" fill="#fff" />
    </svg>
  );
}

/* Gentle snowfall: a mix of real flakes and soft specks, drifting and slowly turning. Off for reduced motion. */
export function Snow({ count = 36, className = "" }: { count?: number; className?: string }) {
  const reduce = useReducedMotion();
  const flakes = useMemo(() => {
    const r = (i: number, k: number) => {
      const v = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: count }, (_, i) => {
      let k = 0;
      const rnd = () => r(i, k++);
      const flake = rnd() > 0.45;
      return {
        flake,
        x: rnd() * 100,
        s: flake ? 11 + rnd() * 11 : 2.5 + rnd() * 3,
        d: flake ? 14 + rnd() * 12 : 9 + rnd() * 8,
        delay: -rnd() * 24,
        drift: (rnd() - 0.5) * 70,
        spin: (rnd() > 0.5 ? 1 : -1) * (120 + rnd() * 240),
        o: flake ? 0.6 + rnd() * 0.35 : 0.3 + rnd() * 0.4,
      };
    });
  }, [count]);
  if (reduce) return null;
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {flakes.map((f, i) => (
        <motion.span
          key={i}
          className="absolute top-[-24px] block"
          style={{ left: `${f.x}%` }}
          animate={{ y: ["0vh", "105vh"], x: [0, f.drift, 0], rotate: [0, f.spin] }}
          transition={{ duration: f.d, delay: f.delay, repeat: Infinity, ease: "linear" }}
        >
          {f.flake ? <Flake size={f.s} opacity={f.o} /> : <span className="block rounded-full bg-white" style={{ width: f.s, height: f.s, opacity: f.o }} />}
        </motion.span>
      ))}
    </div>
  );
}
