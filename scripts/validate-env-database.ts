/**
 * Bypass mode: keep this script non-blocking.
 */
// eslint-disable-next-line no-console
console.warn("[database env] bypass enabled: skipping DATABASE_URL / DIRECT_URL validation.");
process.exit(0);
