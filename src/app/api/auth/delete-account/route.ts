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
    console.log('[delete-account] API called');
    
    // Authorizationヘッダーからアクセストークンを取得
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[delete-account] No authorization header');
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
    console.log('[delete-account] User retrieved:', { userId: user?.id, email: user?.email, error: userError?.message });

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

    // 削除前の件数を確認
    const { count: postsCountBefore } = await adminSupabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: likesCountBefore } = await adminSupabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    console.log('[delete-account] Before deletion:', { posts: postsCountBefore, likes: likesCountBefore });

    // 1. ユーザーの投稿を削除（select()を使用してRLSをバイパス）
    const { error: postsError } = await adminSupabase.from('posts').delete().eq('user_id', user.id);
    if (postsError) {
      console.error('[delete-account] Posts delete error:', postsError);
    }

    // 2. ユーザーのいいねを削除
    const { error: likesError } = await adminSupabase.from('likes').delete().eq('user_id', user.id);
    if (likesError) {
      console.error('[delete-account] Likes delete error:', likesError);
    }

    // 3. ユーザープロフィールを削除
    const { error: usersError } = await adminSupabase.from('users').delete().eq('id', user.id);
    if (usersError) {
      console.error('[delete-account] Users delete error:', usersError);
    }

    // 削除後の確認
    const { count: postsCountAfter } = await adminSupabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: likesCountAfter } = await adminSupabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { data: userProfile } = await adminSupabase.from('users').select('id').eq('id', user.id).single();
    console.log('[delete-account] After deletion:', { posts: postsCountAfter, likes: likesCountAfter, userProfileExists: !!userProfile });

    // 4. auth.usersからユーザーを削除（管理者権限が必要）
    console.log('[delete-account] Attempting to delete auth user:', user.id);
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
    console.log('[delete-account] Auth user delete result:', { error: deleteError?.message });

    if (deleteError) {
      console.error('Delete auth user error:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete auth user: ' + deleteError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // 削除後の確認
    const { data: verifyUser } = await adminSupabase.auth.admin.getUserById(user.id);
    console.log('[delete-account] Verify user after delete:', { userExists: !!verifyUser?.user, userId: verifyUser?.user?.id });

    return NextResponse.json({
      success: true,
      message: 'Account has been deleted',
      deletedUserId: user.id,
    }, { headers: corsHeaders });

  } catch (e: any) {
    console.error('Delete account error:', e);
    return NextResponse.json(
      { success: false, error: 'Server error: ' + e.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
