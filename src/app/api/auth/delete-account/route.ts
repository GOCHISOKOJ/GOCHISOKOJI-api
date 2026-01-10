import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS (preflight)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ユーザー自身によるアカウント削除
export async function POST(request: NextRequest) {
  try {
    // Authorizationヘッダーからアクセストークンを取得
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization header is required' },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // ユーザーのSupabaseクライアントを作成してユーザー情報を取得
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Service Role Keyを使用した管理者クライアントを作成
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. ユーザーの投稿を削除
    await adminSupabase.from('posts').delete().eq('user_id', user.id);

    // 2. ユーザーのいいねを削除
    await adminSupabase.from('likes').delete().eq('user_id', user.id);

    // 3. ユーザープロフィールを削除
    await adminSupabase.from('users').delete().eq('id', user.id);

    // 4. auth.usersからユーザーを削除（管理者権限が必要）
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Delete auth user error:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete auth user: ' + deleteError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account has been deleted',
    }, { headers: corsHeaders });

  } catch (e: any) {
    console.error('Delete account error:', e);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
