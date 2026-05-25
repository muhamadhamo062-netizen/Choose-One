import { useEffect, useState } from "react";

/**
 * Countdown in seconds, decrementing every second. Clamps at 0.
 * Pass a stable initial value from the parent (e.g. useState random once).
 */
export function useCountdownSeconds(initialSeconds: number): number {
  const [seconds, setSeconds] = useState(() => Math.max(0, initialSeconds));

  useEffect(() => {
    if (Math.max(0, initialSeconds) <= 0) {
      return;
    }
    const id = setInterval(() => {
      setSeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
    // Intentionally run once: parent supplies a one-time random offer length
  }, [initialSeconds]);

  return seconds;
}

export function formatCountdownMmSs(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
