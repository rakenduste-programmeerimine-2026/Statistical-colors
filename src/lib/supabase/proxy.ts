import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv, hasSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase auth cookies on every matched request so that
 * Server Components always see a valid (anonymous) session.
 *
 * It does NOT sign anyone in – anonymous sign-in happens lazily on the
 * client when the user first uploads an image (see ensureAnonymousSession).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv()) return response;

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Do not put code between createServerClient and getClaims():
  // getClaims() validates the JWT and triggers the cookie refresh.
  await supabase.auth.getClaims();

  return response;
}
