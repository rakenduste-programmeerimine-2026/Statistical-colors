import { describe, expect, it, vi } from "vitest";
import { ensureAnonymousSession } from "./anonymous-session";

function fakeSupabase({
  existingUserId,
  signIn = { data: { user: { id: "new-anon-user" } }, error: null },
}: {
  existingUserId?: string;
  signIn?: { data: { user: { id: string } | null }; error: { message: string } | null };
}) {
  const auth = {
    getClaims: vi.fn().mockResolvedValue({
      data: existingUserId ? { claims: { sub: existingUserId } } : null,
      error: null,
    }),
    signInAnonymously: vi.fn().mockResolvedValue(signIn),
  };
  return { auth } as unknown as Parameters<typeof ensureAnonymousSession>[0] & {
    auth: typeof auth;
  };
}

describe("ensureAnonymousSession", () => {
  it("reuses the existing session", async () => {
    const supabase = fakeSupabase({ existingUserId: "user-123" });

    await expect(ensureAnonymousSession(supabase)).resolves.toBe("user-123");
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("signs in anonymously when there is no session", async () => {
    const supabase = fakeSupabase({});

    await expect(ensureAnonymousSession(supabase)).resolves.toBe("new-anon-user");
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledOnce();
  });

  it("throws a clear error when anonymous sign-in fails", async () => {
    const supabase = fakeSupabase({
      signIn: { data: { user: null }, error: { message: "Anonymous sign-ins are disabled" } },
    });

    await expect(ensureAnonymousSession(supabase)).rejects.toThrow(
      "Anonymous sign-in failed: Anonymous sign-ins are disabled",
    );
  });
});
