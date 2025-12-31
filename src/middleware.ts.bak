import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // 0.0.0.0 は「待ち受け用のアドレス」。
  // ブラウザで http://0.0.0.0:3000 を開くとCookie/セッションが別ホスト扱いになりやすいので、
  // 「Hostヘッダ」が 0.0.0.0 のときだけ localhost に寄せる（nextUrl.hostname は dev環境で常に 0.0.0.0 になることがあり、ループする）。
  const host = request.headers.get('host') ?? ''
  if (host.startsWith('0.0.0.0')) {
    const url = request.nextUrl.clone()
    url.hostname = 'localhost'
    return NextResponse.redirect(url)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストパスにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (faviconファイル)
     * - public配下のファイル
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


