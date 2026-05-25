/**
 * Deterministic "match count" 3–7 for A/B-consistent copy per user + state.
 */
export function stableRelativesCount(email: string, stateCode: string): number {
  const id = (email || "anon@privacyeraser.scan").trim() + stateCode;
  const seed = id.split("").reduce((acc, ch) => (acc * 33 + ch.charCodeAt(0)) >>> 0, 0);
  return 3 + (seed % 5);
}
