/* Christmas characters people can pick as their picture. Flat SVG, drawn on a 48x48 grid. */

export const CHARACTERS = [
  { key: "reindeer", label: "Reindeer", bg: "#c9ddd5" },
  { key: "snowman", label: "Snowman", bg: "#bcd3e6" },
  { key: "gingerbread", label: "Gingerbread", bg: "#f6e0b8" },
  { key: "penguin", label: "Penguin", bg: "#cfe0ea" },
  { key: "elf", label: "Elf", bg: "#f3d0c4" },
  { key: "santa", label: "Santa", bg: "#e8c9a9" },
  { key: "tree", label: "Tree", bg: "#f8e9ce" },
  { key: "ornament", label: "Ornament", bg: "#c6d8bd" },
  { key: "polarbear", label: "Polar bear", bg: "#a9c7bd" },
  { key: "star", label: "Star", bg: "#214337" },
] as const;

export type CharacterKey = (typeof CHARACTERS)[number]["key"];

/** Everyone gets a character right away, picked from their name, until they choose their own. */
export function characterFor(name: string, chosen?: string | null): (typeof CHARACTERS)[number] {
  const hit = chosen ? CHARACTERS.find((c) => c.key === chosen) : undefined;
  if (hit) return hit;
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CHARACTERS[h % CHARACTERS.length];
}

const INK = "#2b2420";
const eyes = (y = 25, gap = 5.5) => (
  <>
    <circle cx={24 - gap} cy={y} r="1.9" fill={INK} />
    <circle cx={24 + gap} cy={y} r="1.9" fill={INK} />
    <circle cx={24 - gap + 0.6} cy={y - 0.6} r="0.6" fill="#fff" />
    <circle cx={24 + gap + 0.6} cy={y - 0.6} r="0.6" fill="#fff" />
  </>
);
const cheeks = (y = 29, gap = 9, color = "#e89b8a") => (
  <>
    <ellipse cx={24 - gap} cy={y} rx="2.4" ry="1.5" fill={color} opacity=".7" />
    <ellipse cx={24 + gap} cy={y} rx="2.4" ry="1.5" fill={color} opacity=".7" />
  </>
);
const smile = (y = 30, w = 3.4) => <path d={`M${24 - w} ${y}q${w} ${w * 0.9} ${w * 2} 0`} stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />;

const ART: Record<CharacterKey, React.ReactNode> = {
  reindeer: (
    <>
      <path d="M15 17c-4-3-5-8-3-11m3 11c-3-1-6-1-8 1m26-1c4-3 5-8 3-11m-3 11c3-1 6-1 8 1" stroke="#8a5a3b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="12" cy="22" rx="4" ry="2.4" fill="#a8714d" transform="rotate(-25 12 22)" />
      <ellipse cx="36" cy="22" rx="4" ry="2.4" fill="#a8714d" transform="rotate(25 36 22)" />
      <ellipse cx="24" cy="28" rx="11" ry="12" fill="#b77d55" />
      <ellipse cx="24" cy="34" rx="7" ry="5.5" fill="#e3c19c" />
      {eyes(25, 4.6)}
      <circle cx="24" cy="32" r="3.2" fill="#d9483b" />
      <circle cx="23" cy="31" r="0.9" fill="#fff" opacity=".8" />
    </>
  ),
  snowman: (
    <>
      <circle cx="24" cy="29" r="12" fill="#fffdf8" stroke="#d6e2ea" strokeWidth="1" />
      <rect x="15" y="15" width="18" height="3" rx="1.5" fill={INK} />
      <rect x="18" y="5" width="12" height="11" rx="1.5" fill={INK} />
      <rect x="18" y="12" width="12" height="2.5" fill="#ce4a3c" />
      {eyes(26, 4.5)}
      <path d="M24 29.5l7 2-7 1.4z" fill="#e8892e" />
      <circle cx="19.5" cy="35" r="0.9" fill={INK} />
      <circle cx="22.5" cy="36.2" r="0.9" fill={INK} />
      <circle cx="25.5" cy="36.2" r="0.9" fill={INK} />
      <circle cx="28.5" cy="35" r="0.9" fill={INK} />
    </>
  ),
  gingerbread: (
    <>
      <circle cx="24" cy="26" r="13" fill="#c98a52" />
      <path d="M12.5 21q11.5-9 23 0" stroke="#fffdf8" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="2.4 2" />
      {eyes(25, 5)}
      {cheeks(29.5, 8.5, "#f08f87")}
      <path d="M19 31q5 4.5 10 0" stroke="#fffdf8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="41" r="1.6" fill="#d9483b" />
    </>
  ),
  penguin: (
    <>
      <ellipse cx="24" cy="27" rx="13" ry="13.5" fill="#2f3a44" />
      <path d="M24 17c-8 0-10 6-9.5 10.5C15 33 19 37 24 37s9-4 9.5-9.5C34 23 32 17 24 17z" fill="#fffdf8" />
      {eyes(25, 4.4)}
      <path d="M21.2 29h5.6l-2.8 3.2z" fill="#f0a03a" />
      {cheeks(30, 7.5)}
      <path d="M12 37q12 6 24 0v4H12z" fill="#ce4a3c" />
    </>
  ),
  elf: (
    <>
      <path d="M10 26l-5-4 6.5-1M38 26l5-4-6.5-1" fill="#f2c9a8" stroke="#d9a47f" strokeWidth="1" />
      <circle cx="24" cy="28" r="11.5" fill="#f6d2b2" />
      <path d="M11 22c3-11 19-15 30-12l-6 2c-2 3-1 7 2 10z" fill="#3f8a5a" />
      <circle cx="41" cy="10" r="3" fill="#edbd62" />
      <rect x="11" y="20.5" width="26" height="4" rx="2" fill="#ce4a3c" />
      {eyes(28.5, 4.6)}
      {cheeks(32, 7.5)}
      {smile(33, 3)}
    </>
  ),
  santa: (
    <>
      <circle cx="24" cy="25" r="11" fill="#f6d2b2" />
      <path d="M11 30c0 9 6 13 13 13s13-4 13-13c-3 2-6 3-8 2-2-1-3 0-5 0s-3-1-5 0-5 0-8-2z" fill="#fffdf8" />
      <path d="M12 19c1-9 9-14 18-12 4 1 7 4 8 7l-3 5z" fill="#ce4a3c" />
      <circle cx="38" cy="16" r="3.2" fill="#fffdf8" />
      <rect x="11" y="17.5" width="26" height="5" rx="2.5" fill="#fffdf8" />
      {eyes(26, 4.4)}
      <ellipse cx="24" cy="30" rx="2.6" ry="2" fill="#e89b8a" />
      <path d="M18 32.5q3-2 6 0 3-2 6 0" stroke="#e7e2d8" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  tree: (
    <>
      <path d="M24 9l8 10h-4l7 9h-4.5l7 9H7.5l7-9H10l7-9h-4z" fill="#2f7a52" />
      <rect x="21" y="37" width="6" height="5" rx="1" fill="#8a5a3b" />
      <path d="M24 5.5l1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.5-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z" fill="#edbd62" />
      <circle cx="20" cy="21" r="1.6" fill="#ce4a3c" />
      <circle cx="28" cy="25" r="1.6" fill="#edbd62" />
      <circle cx="18" cy="31" r="1.6" fill="#edbd62" />
      <circle cx="30" cy="33" r="1.6" fill="#ce4a3c" />
      <circle cx="24" cy="29" r="1.6" fill="#fffdf8" />
      {eyes(23.5, 3)}
    </>
  ),
  ornament: (
    <>
      <path d="M24 4v6" stroke="#9aa39e" strokeWidth="1.4" />
      <rect x="20" y="9" width="8" height="5" rx="1.2" fill="#d89136" />
      <circle cx="24" cy="28" r="14" fill="#ce4a3c" />
      <path d="M10.5 25q13.5 6 27 0" stroke="#edbd62" strokeWidth="2.4" fill="none" />
      <path d="M11 31q13 6 26 0" stroke="#fffdf8" strokeWidth="1.4" fill="none" strokeDasharray="1.5 2.5" strokeLinecap="round" />
      <ellipse cx="18" cy="20" rx="3" ry="4.5" fill="#fff" opacity=".35" transform="rotate(30 18 20)" />
    </>
  ),
  polarbear: (
    <>
      <circle cx="13.5" cy="16" r="4.6" fill="#fffdf8" />
      <circle cx="34.5" cy="16" r="4.6" fill="#fffdf8" />
      <circle cx="13.5" cy="16" r="2.2" fill="#e8d9c4" />
      <circle cx="34.5" cy="16" r="2.2" fill="#e8d9c4" />
      <circle cx="24" cy="27" r="13" fill="#fffdf8" />
      <ellipse cx="24" cy="32" rx="6" ry="4.6" fill="#f1e6d6" />
      {eyes(25, 5)}
      <ellipse cx="24" cy="30.5" rx="2.6" ry="1.9" fill={INK} />
      <path d="M24 32.4v1.8m0 0q-2 1.6-3.4.4m3.4-.4q2 1.6 3.4.4" stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M12 37q12 6 24 0v4H12z" fill="#3f8a5a" />
    </>
  ),
  star: (
    <>
      <path d="M24 7l4.9 10.1 11.1 1.5-8.1 7.7 2 11-9.9-5.3-9.9 5.3 2-11-8.1-7.7 11.1-1.5z" fill="#edbd62" stroke="#d89136" strokeWidth="1.4" strokeLinejoin="round" />
      {eyes(24, 4)}
      {cheeks(27.5, 7, "#e89b8a")}
      {smile(28, 2.6)}
      <circle cx="9" cy="10" r="1" fill="#fdf6ea" />
      <circle cx="40" cy="38" r="1.2" fill="#fdf6ea" />
      <circle cx="38" cy="9" r="0.8" fill="#fdf6ea" />
    </>
  ),
};

export function Character({ name, avatar, size = 36 }: { name: string; avatar?: string | null; size?: number }) {
  const c = characterFor(name, avatar);
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="block" aria-hidden>
      <defs>
        <clipPath id={`clip-${c.key}`}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="24" fill={c.bg} />
      <g clipPath={`url(#clip-${c.key})`}>{ART[c.key]}</g>
    </svg>
  );
}
