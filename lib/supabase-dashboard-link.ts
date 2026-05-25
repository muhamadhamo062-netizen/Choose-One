/**
 * Deep link to Supabase → Project → Database settings (for setup hints in the client).
 * Requires `NEXT_PUBLIC_SUPABASE_URL` (e.g. https://abcdefgh.supabase.co).
 */
export function getSupabaseDatabaseSettingsUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!u) {
    return null;
  }
  const m = u.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  if (!m) {
    return null;
  }
  return `https://supabase.com/dashboard/project/${m[1]}/settings/database`;
}
