import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log("Auth Callback triggered. Origin:", origin);

  if (code) {
    try {
      const cookieStore = (await cookies()) as any;
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }: any) =>
                  cookieStore.set(name, value, options)
                )
              } catch (error) {
                console.error("Cookie setting failed:", error)
              }
            },
          },
        }
      )
      
      console.log("Exchanging code for session...");
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error) {
        console.log("Session exchanged successfully. Redirecting to:", next);
        return NextResponse.redirect(`${origin}${next}`)
      } else {
        console.error("Supabase Auth Error:", error.message);
      }
    } catch (err) {
      console.error("Callback unexpected error:", err);
    }
  }

  // Fallback redirect to home if something goes wrong, instead of 404
  console.warn("Callback failed or no code. Redirecting to home.");
  return NextResponse.redirect(`${origin}/`)
}
