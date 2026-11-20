export function GiftMark({ size }: { size: number }) {
  const s = size / 32;
  return (
    <div style={{ width: size, height: size, display: "flex", background: "#214337", alignItems: "center", justifyContent: "center" }}>
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 32 32">
        <rect x="4" y="11" width="24" height="18" rx="2.5" fill="#edbd62" stroke="#87583f" strokeWidth={1.4} />
        <rect x="2.5" y="8" width="27" height="6" rx="2" fill="#f3ca79" stroke="#87583f" strokeWidth={1.4} />
        <rect x="14" y="8" width="4" height="21" fill="#9d5241" />
        <path d="M16 8c-3-5-8.5-4-7.5-.6.7 2.2 4.6 1.4 7.5.6zm0 0c3-5 8.5-4 7.5-.6-.7 2.2-4.6 1.4-7.5.6z" fill="#ce7e69" stroke="#87583f" strokeWidth={1.2} />
      </svg>
      <span style={{ display: "none" }}>{s}</span>
    </div>
  );
}
