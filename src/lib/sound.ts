// Tiny synthesized sound effects for the envelope reveal. No audio files: everything is made with Web Audio.
// Sound is OFF unless the person turns it on; the choice is remembered on this device only.

const KEY = "mm-sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}

/** Call from a tap so the browser lets audio start. */
export function primeAudio() {
  if (!soundOn()) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Paper tearing: a short burst of filtered noise. */
export function playRip() {
  const a = primeAudio();
  if (!a) return;
  const len = 0.38;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    // Crackly noise that fades out, with little bursts for a papery feel.
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (Math.random() > 0.82 ? 1 : 0.35);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1800, a.currentTime);
  bp.frequency.exponentialRampToValueAtTime(4200, a.currentTime + len);
  bp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = 0.35;
  src.connect(bp).connect(g).connect(a.destination);
  src.start();
}

/** A bright bell arpeggio for the moment the name lands. */
export function playChime() {
  const a = primeAudio();
  if (!a) return;
  const notes = [1046.5, 1318.5, 1568, 2093]; // C6 E6 G6 C7
  notes.forEach((f, i) => {
    const t = a.currentTime + i * 0.09;
    for (const [mult, vol] of [
      [1, 0.16],
      [2.76, 0.04],
    ] as const) {
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const g = a.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + 1.5);
    }
  });
}

/** A short buzz on phones that support it (Android). iPhones ignore this quietly. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
