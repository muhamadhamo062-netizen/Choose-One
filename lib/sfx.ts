type PulseKind = "tick" | "found";

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function unlockOnce() {
  if (unlocked) return;
  const ctx = getCtx();
  if (!ctx) return;
  // Resume context on first user gesture.
  const resume = () => {
    void ctx.resume().catch(() => {});
    unlocked = true;
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
  };
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
}

export function initSfx(): void {
  if (typeof window === "undefined") return;
  unlockOnce();
}

export function playPulse(kind: PulseKind = "tick"): void {
  if (typeof window === "undefined") return;
  unlockOnce();
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state !== "running") return; // avoid autoplay violations

  // Respect reduced motion / sensory preference (best-effort).
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch {
    // ignore
  }

  const now = ctx.currentTime;

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = kind === "found" ? 920 : 520;
  f.Q.value = 10;

  o.type = "sine";
  o.frequency.setValueAtTime(kind === "found" ? 820 : 480, now);
  o.frequency.exponentialRampToValueAtTime(kind === "found" ? 520 : 320, now + 0.12);

  // Very subtle volume envelope.
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(kind === "found" ? 0.06 : 0.04, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  o.connect(f);
  f.connect(g);
  g.connect(ctx.destination);

  o.start(now);
  o.stop(now + 0.18);

  o.onended = () => {
    try {
      o.disconnect();
      f.disconnect();
      g.disconnect();
    } catch {
      // ignore
    }
  };
}

