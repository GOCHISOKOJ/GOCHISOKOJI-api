import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// OPTIONS (preflight)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスとパスワードを入力してください。' },
        { status: 400, headers: corsHeaders }
      );
    }

    // サーバーサイドでSupabaseに接続
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // #region debug log
    console.log('[LOGIN DEBUG]', {
      email,
      hasError: !!error,
      errorMessage: error?.message,
      errorStatus: error?.status,
      hasUser: !!data.user,
      hasSession: !!data.session,
    });
    // #endregion

    if (error) {
      let message = 'ログインに失敗しました。';
      let needsEmailConfirmation = false;
      if (error.message.includes('Invalid login credentials')) {
        message = 'メールアドレスまたはパスワードが正しくありません。新規登録済みの場合は、確認メールのリンクをクリックしてからログインしてください。';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'メールアドレスの確認が完了していません。登録時に届いた確認メールのリンクをクリックしてください。';
        needsEmailConfirmation = true;
      }
      return NextResponse.json(
        { success: false, error: message, needsEmailConfirmation, debug: { errorMessage: error.message } },
        { status: 401, headers: corsHeaders }
      );
    }

    // セッション情報を返す（クライアントで使用）
    return NextResponse.json({
      success: true,
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      },
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    }, { headers: corsHeaders });
  } catch (e: any) {
    console.error('Email login error:', e);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました。' },
      { status: 500, headers: corsHeaders }
    );
  }
}

