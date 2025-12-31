import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // セッションの更新（トークンのリフレッシュ）
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 認証が必要なページで未ログインの場合
  // 要件:
  // - /profile はログイン必須 → ページ側でモーダル表示
  // - /compose (AI投稿) はログイン必須 → ページ側でモーダル表示
  // ※ 自動リダイレクトせず、ページ側で AuthRequiredModal を表示する

  return supabaseResponse
}



