import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Makes sure the browser has a Supabase session without asking the user to
 * create an account: reuses the existing session or signs in anonymously.
 *
 * Call it right before the first database/storage write (e.g. when the user
 * starts an upload), not on every page view – that would create a user for
 * every visitor and bot.
 *
 * @returns the (anonymous) user id, used as owner_id and storage folder name
 */
export async function ensureAnonymousSession(
  supabase: Pick<SupabaseClient, "auth">,
): Promise<string> {
  const { data: claimsData } = await supabase.auth.getClaims();
  const existingUserId = claimsData?.claims?.sub;
  if (existingUserId) return existingUserId;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `Anonymous sign-in failed: ${error?.message ?? "no user returned"}`,
    );
  }
  return data.user.id;
}
