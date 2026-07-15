// Next.js 16 Proxy (the renamed middleware.ts convention). Job is deliberately narrow:
// refresh the Supabase session cookie and redirect based on session *existence* only.
// It does not query Prisma/AppUser and does not cover /api/**  — once guard.ts denies a
// null user, the existing API route handlers already 403 an unauthenticated request
// correctly on their own, without proxy's help. Redirecting an API route here would also
// break RollbackButton.tsx's fetch() call, which expects JSON, not an HTML redirect.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoModeActive } from "@/lib/auth/demo-mode";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  if (isDemoModeActive()) return NextResponse.next();

  if (!isSupabaseConfigured()) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set. " +
        "Copy .env.example to .env, or set DEMO_USER_EMAIL for local dev without Supabase.",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Both writes matter: request.cookies so this request's own render sees the
          // refreshed session, response.cookies so the browser gets it for the next
          // request. Dropping either half is the classic way this pattern silently breaks.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getSession()) — revalidates the JWT against the Supabase Auth server.
  // getSession() only decodes the local cookie and must never be trusted for a
  // server-side authorization decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname === "/login";

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
