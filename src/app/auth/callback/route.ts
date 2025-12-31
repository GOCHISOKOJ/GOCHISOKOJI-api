import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

function sanitizeNext(next: string | null) {
  if (!next) return '/'
  // open redirect 対策: 絶対URLやプロトコル相対URLは拒否
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//')) return '/'
  return next
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // ユーザープロフィールを自動作成
      await createUserProfileIfNotExists(supabase)

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // エラーがあった場合はログインページにリダイレクト
  return NextResponse.redirect(`${origin}/login`)
}

/**
 * ユーザープロフィールが存在しない場合は作成
 */
async function createUserProfileIfNotExists(supabase: any) {
  try {
    // 現在のユーザーを取得
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 既にプロフィールが存在するか確認
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    // 存在しない場合のみ作成
    if (!existingUser) {
      await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          display_name: user.user_metadata.full_name || user.email?.split('@')[0] || null,
          avatar_url: user.user_metadata.avatar_url || null,
        })
    }
  } catch (error) {
    console.error('Error creating user profile:', error)
  }
}

