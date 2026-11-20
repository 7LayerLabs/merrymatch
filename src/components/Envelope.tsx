"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buzz, playChime, playRip, primeAudio, setSoundOn, soundOn } from "@/lib/sound";
import { Snow, Starburst } from "./art";

type Stage = "idle" | "shake" | "breaking" | "flap" | "rising" | "revealed";

const noSubscribe = () => () => {};

const CONFETTI_COLORS = ["#edbd62", "#ce7e69", "#96bdb0", "#fdf6ea", "#d89136", "#c6d8bd", "#e6a08b"];

type Piece = ReturnType<typeof makePieces>[number];

function makePieces() {
  return Array.from({ length: 90 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 140 + Math.random() * 260;
        return {
          i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.75 - 60,
          fall: 140 + Math.random() * 220,
          rot: (Math.random() - 0.5) * 900,
          w: 6 + Math.random() * 7,
          h: Math.random() > 0.5 ? 6 + Math.random() * 6 : 3 + Math.random() * 3,
          round: Math.random() > 0.7,
          star: Math.random() > 0.88,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          delay: Math.random() * 0.25,
          dur: 1.8 + Math.random() * 1.4,
        };
  });
}

function Confetti({ fire, pieces }: { fire: number; pieces: Piece[] }) {
  if (!fire) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[44%] z-30" aria-hidden key={fire}>
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className={`absolute block ${p.star ? "starburst" : ""}`}
          style={{
            width: p.star ? 16 : p.w,
            height: p.star ? 16 : p.h,
            background: p.color,
            borderRadius: p.round ? 999 : 2,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{
            x: [0, p.x, p.x * 1.08],
            y: [0, p.y, p.y + p.fall],
            rotate: p.rot,
            opacity: [1, 1, 0],
            scale: [0.4, 1, 0.9],
          }}
          transition={{ duration: p.dur, delay: p.delay, ease: [0.15, 0.7, 0.4, 1], times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}

type RevealProps = {
  name: string;
  subtitle?: string;
  startOpen?: boolean; // already revealed: show the card, allow replay
  onOpened?: () => void;
  children?: React.ReactNode; // actions under the card once revealed
};

// Each replay mounts a fresh envelope, so every run starts from a clean, sealed state.
export function EnvelopeReveal(props: RevealProps) {
  const [run, setRun] = useState(0);
  return (
    <EnvelopeInner
      key={run}
      {...props}
      startOpen={run === 0 ? props.startOpen : false}
      autoPlay={run > 0}
      onOpened={run === 0 ? props.onOpened : undefined}
      onReplay={() => setRun((r) => r + 1)}
    />
  );
}

function EnvelopeInner({
  name,
  subtitle,
  startOpen,
  onOpened,
  children,
  autoPlay,
  onReplay,
}: RevealProps & { autoPlay: boolean; onReplay: () => void }) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>(startOpen ? "revealed" : "idle");
  const [fire, setFire] = useState(0);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const timers = useRef<number[]>([]);
  const opened = useRef(false);
  const [, bump] = useState(0);
  const sound = useSyncExternalStore(noSubscribe, soundOn, () => false);
  const toggleSound = () => {
    setSoundOn(!sound);
    bump((v) => v + 1);
    if (!sound) {
      primeAudio();
      playChime();
    }
  };

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const open = () => {
    if (stage !== "idle") return;
    if (reduce) {
      setStage("revealed");
      if (!opened.current) {
        opened.current = true;
        onOpened?.();
      }
      return;
    }
    primeAudio();
    buzz(15);
    setStage("shake");
    later(900, () => {
      setStage("breaking");
      playRip();
      buzz(25);
    });
    later(1320, () => setStage("flap"));
    later(1950, () => setStage("rising"));
    later(3150, () => {
      setStage("revealed");
      setPieces(makePieces());
      setFire((f) => f + 1);
      playChime();
      buzz([40, 70, 110]);
      if (!opened.current) {
        opened.current = true;
        onOpened?.();
      }
    });
  };

  const replay = onReplay;

  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setTimeout(() => open(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flapOpen = stage === "flap" || stage === "rising" || stage === "revealed";
  const cardUp = stage === "rising" || stage === "revealed";
  const done = stage === "revealed";
  const words = name.split(/\s+/);

  // The envelope body (back, pocket and flap) moves as one piece.
  const bodyAnim = done
    ? { y: 150, opacity: 0, scale: 0.9, rotate: 0 }
    : stage === "idle"
      ? { y: [0, -8, 0], rotate: [0, -1.2, 0, 1.2, 0], opacity: 1, scale: 1 }
      : stage === "shake"
        ? { y: [0, -6, 0, -8, 0, -4, 0], rotate: [0, -6, 6, -7, 7, -3, 0], scale: [1, 1.03, 1.03, 1.05, 1.05, 1.02, 1], opacity: 1 }
        : { y: 0, rotate: 0, opacity: 1, scale: 1 };
  const bodyTrans = done
    ? { duration: 0.7, ease: [0.4, 0, 0.6, 1] as const }
    : stage === "idle"
      ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const }
      : stage === "shake"
        ? { duration: 0.9, ease: "easeInOut" as const }
        : { duration: 0.3 };
  const headline =
    stage === "idle"
      ? { key: "idle", eyebrow: "Your Secret Santa match", text: "Somebody's name is in here..." }
      : stage === "rising"
        ? { key: "rising", eyebrow: "Drumroll please", text: "And your person is..." }
        : done
          ? null
          : { key: "coming", eyebrow: "Your Secret Santa match", text: "Here it comes..." };

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-pine-3 px-4 pb-8 pt-10 text-cream shadow-[var(--shadow-lg)] sm:px-8">
      {/* backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#2d5a49_0%,#214337_45%,#173127_100%)]" />
      <motion.div
        className="absolute left-1/2 top-[42%] h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "repeating-conic-gradient(from 0deg, rgba(237,189,98,.13) 0deg 9deg, transparent 9deg 22deg)",
          maskImage: "radial-gradient(circle, black 0%, transparent 60%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 60%)",
        }}
        animate={{ opacity: done ? 1 : 0.25, rotate: reduce ? 0 : 360 }}
        transition={{ opacity: { duration: 0.8 }, rotate: { duration: 60, repeat: Infinity, ease: "linear" } }}
      />
      <Snow count={30} />
      <Starburst size={22} className="left-[12%] top-[14%]" color="#edbd62" />
      <Starburst size={14} className="right-[14%] top-[22%]" color="#ce7e69" delay={0.8} />
      <Starburst size={18} className="bottom-[16%] left-[18%]" color="#96bdb0" delay={1.4} />
      <Starburst size={12} className="bottom-[26%] right-[12%]" color="#edbd62" delay={2} />

      <button
        type="button"
        onClick={toggleSound}
        className="absolute right-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-cream/80 ring-1 ring-white/15 transition hover:bg-white/15 hover:text-cream"
        aria-pressed={sound}
      >
        {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        {sound ? "Sound on" : "Sound off"}
      </button>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 flex h-[64px] items-end justify-center text-center">
          <AnimatePresence mode="wait">
            {headline ? (
              <motion.div
                key={headline.key}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="eyebrow text-gold">{headline.eyebrow}</div>
                <div className="mt-1 font-script text-[30px] leading-tight sm:text-[34px]">{headline.text}</div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Stage */}
        <motion.div
          className="relative w-[300px] sm:w-[400px]"
          style={{ perspective: 900 }}
          initial={false}
          animate={{ height: done ? 300 : 350 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.div className="absolute bottom-6 left-0 right-0 mx-auto h-[196px] w-full" animate={bodyAnim} transition={bodyTrans}>
            {/* back of envelope */}
            <div className="absolute inset-0 rounded-[10px] bg-[#e9d2a8] shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]" />
            {/* inner liner (checker) */}
            <div
              className="checker-band absolute inset-x-[6px] top-[6px] h-[90px] rounded-t-[6px] opacity-60"
              style={{ clipPath: "polygon(0 0,100% 0,50% 100%)" }}
            />
          </motion.div>

          {/* The card */}
          <motion.div
            className="absolute left-1/2 z-[15] w-[88%] -translate-x-1/2 rounded-[16px] bg-card text-ink shadow-[0_24px_60px_-18px_rgba(0,0,0,.6)]"
            style={{ bottom: 34, transformOrigin: "50% 100%" }}
            initial={false}
            animate={
              done
                ? { y: -30, scale: 1.1, rotate: 0, zIndex: 40 }
                : cardUp
                  ? { y: -150, scale: 1, rotate: -2, zIndex: 15 }
                  : { y: 0, scale: 0.94, rotate: 0, zIndex: 15 }
            }
            transition={done ? { type: "spring", stiffness: 160, damping: 16 } : { duration: 0.95, ease: [0.25, 0.9, 0.3, 1] }}
          >
            <div className="checker-band h-3 rounded-t-[16px] opacity-80" />
            <div className="relative px-5 pb-6 pt-5 text-center sm:px-6">
              <Starburst size={20} className="right-4 top-4" />
              <div className="eyebrow text-coral-2">You&apos;re shopping for</div>
              <div
                className={`mt-2 font-script leading-[1.08] text-pine ${
                  name.length <= 9 ? "text-[44px] sm:text-[60px]" : name.length <= 14 ? "text-[38px] sm:text-[50px]" : "text-[32px] sm:text-[42px]"
                }`}
              >
                {/* Whole words animate so the script letters stay joined and a name never breaks mid-word. */}
                {done
                  ? words.map((word, i, all) => (
                      <motion.span
                        key={i + word}
                        className="inline-block whitespace-nowrap"
                        initial={{ opacity: 0, y: 22, scale: 0.7, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        transition={{ delay: 0.15 + i * 0.22, type: "spring", stiffness: 260, damping: 15 }}
                      >
                        {word}
                        {i < all.length - 1 ? " " : ""}
                      </motion.span>
                    ))
                  : <span className="opacity-0">{name}</span>}
              </div>
              {subtitle ? (
                <motion.div
                  className="mt-2 text-[13px] text-muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: done ? 1 : 0 }}
                  transition={{ delay: done ? 0.55 + words.length * 0.22 : 0 }}
                >
                  {subtitle}
                </motion.div>
              ) : null}
            </div>
          </motion.div>

          {/* front pocket */}
          <motion.div
            className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 mx-auto h-[196px] w-full"
            animate={bodyAnim}
            transition={bodyTrans}
          >
            <svg viewBox="0 0 340 196" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <path d="M0 10 Q0 0 10 0 L0 0 Z" fill="none" />
              <path d="M0 14 L170 118 L340 14 L340 186 Q340 196 330 196 L10 196 Q0 196 0 186 Z" fill="#f8e9ce" />
              <path d="M0 196 L150 104 Q170 92 190 104 L340 196 Z" fill="#f3dfbb" />
              <path d="M0 14 L150 106 M340 14 L190 106" stroke="#d9be8c" strokeWidth="1.5" fill="none" />
            </svg>
            <div className="absolute bottom-4 left-5 font-script text-[19px] text-[#9b7b4a]">To: you</div>
            <div className="absolute bottom-3 right-5 h-9 w-7 rounded-[3px] border border-dashed border-coral/60 bg-coral/15" />
          </motion.div>

          {/* flap */}
          <motion.div
            className="absolute left-0 right-0 mx-auto h-[196px] w-full"
            style={{ bottom: 24, zIndex: flapOpen ? 5 : 25, transformStyle: "preserve-3d", pointerEvents: "none" }}
            animate={bodyAnim}
            transition={bodyTrans}
          >
            <motion.div
              className="absolute inset-x-0 top-0 h-[118px]"
              style={{ transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
              animate={{ rotateX: flapOpen ? 178 : 0 }}
              transition={{ duration: 0.65, ease: [0.5, 0, 0.3, 1] }}
            >
              <svg viewBox="0 0 340 118" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" style={{ backfaceVisibility: "hidden" }}>
                <path d="M0 10 Q0 0 10 0 L330 0 Q340 0 340 10 L180 112 Q170 118 160 112 Z" fill="#f1dcb5" stroke="#d9be8c" strokeWidth="1.5" />
              </svg>
              <svg
                viewBox="0 0 340 118"
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
                style={{ transform: "rotateX(180deg)", backfaceVisibility: "hidden" }}
              >
                <path d="M0 10 Q0 0 10 0 L330 0 Q340 0 340 10 L180 112 Q170 118 160 112 Z" fill="#e2c592" />
              </svg>
            </motion.div>
          </motion.div>

          {/* wax seal */}
          <AnimatePresence>
            {stage === "idle" || stage === "shake" || stage === "breaking" ? (
              <motion.button
                type="button"
                onClick={open}
                aria-label="Open your envelope"
                className="absolute left-1/2 z-30 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full"
                style={{ bottom: 24 + 196 - 118 - 32 }}
                animate={
                  stage === "breaking"
                    ? { scale: [1, 1.3, 0], rotate: [0, -20, 40], opacity: [1, 1, 0] }
                    : stage === "shake"
                      ? { y: [0, -6, 0, -8, 0, -4, 0], rotate: [0, -12, 12, -14, 14, -6, 0], scale: [1, 1.1, 1.05, 1.15, 1.08, 1.12, 1.1] }
                      : { y: [0, -8, 0], scale: [1, 1.06, 1] }
                }
                transition={
                  stage === "breaking"
                    ? { duration: 0.42 }
                    : stage === "shake"
                      ? { duration: 0.9, ease: "easeInOut" }
                      : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
                }
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
              >
                <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,.35)]">
                  <path
                    d="M32 3c5 0 6 4 10 5s8-1 10 3-1 7 1 11 6 5 5 10-5 5-6 9 2 8-2 11-7 0-11 2-4 6-9 6-6-4-10-5-8 1-10-3 1-7-1-11-6-5-5-10 5-5 6-9-2-8 2-11 7 0 11-2 4-6 9-6z"
                    fill="#b9604b"
                  />
                  <circle cx="32" cy="32" r="18" fill="#ce7e69" stroke="#a24d3a" strokeWidth="2" />
                  <text x="32" y="39" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="20" fill="#fdf6ea">
                    M
                  </text>
                </svg>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <Confetti fire={fire} pieces={pieces} />

        <div className="relative z-40 mt-2 min-h-[56px] text-center">
          <AnimatePresence mode="wait">
            {stage === "idle" ? (
              <motion.button
                key="tap"
                type="button"
                onClick={open}
                className="rounded-full bg-gold px-6 py-3 text-[15px] font-bold text-pine-3 shadow-[0_3px_0_#b9832f] transition hover:bg-[#f2c977] active:translate-y-[2px] active:shadow-none"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                Break the seal
              </motion.button>
            ) : done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + words.length * 0.22 }}
                className="flex flex-col items-center gap-3"
              >
                {children}
                <button type="button" onClick={replay} className="text-[12.5px] font-semibold text-cream/60 underline-offset-4 hover:text-cream hover:underline">
                  Open it again
                </button>
              </motion.div>
            ) : (
              <motion.div key="wait" className="pt-3 text-[13px] text-cream/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {stage === "rising" ? "" : "Opening..."}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
