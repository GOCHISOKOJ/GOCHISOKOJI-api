import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスとパスワードを入力してください。' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'パスワードは6文字以上で入力してください。' },
        { status: 400 }
      );
    }

    // サーバーサイドでSupabaseに接続
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      let message = '新規登録に失敗しました。';
      if (error.message.includes('already registered')) {
        message = 'このメールアドレスは既に登録されています。';
      } else if (error.message.includes('invalid email')) {
        message = '有効なメールアドレスを入力してください。';
      }
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }

    // ユーザーが作成され、確認メールが送信された場合
    if (data.user && !data.session) {
      return NextResponse.json({
        success: true,
        needsEmailConfirmation: true,
        message: '確認メールを送信しました。メールのリンクをクリックして登録を完了してください。',
      });
    }

    // 即座にログインできた場合（メール確認が不要な設定の場合）
    return NextResponse.json({
      success: true,
      needsEmailConfirmation: false,
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      },
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  } catch (e: any) {
    console.error('Email signup error:', e);
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました。' },
      { status: 500 }
    );
  }
}

