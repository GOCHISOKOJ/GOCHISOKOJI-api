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

// 開発/デバッグ用: 指定したユーザーのパスワードを強制リセット
export async function POST(request: NextRequest) {
  try {
    const { email, newPassword, adminKey } = await request.json();

    // 簡易的な保護
    if (adminKey !== 'koji-admin-2024') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!email || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Email and newPassword are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ユーザーを検索
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('List users error:', listError);
      return NextResponse.json(
        { success: false, error: `List error: ${listError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // パスワードを更新
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
      email_confirm: true, // メール確認も完了させる
    });

    if (updateError) {
      console.error('Update user error:', updateError);
      return NextResponse.json(
        { success: false, error: `Update error: ${updateError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password for ${email} has been reset`,
    }, { headers: corsHeaders });

  } catch (e: any) {
    console.error('Reset password error:', e);
    return NextResponse.json(
      { success: false, error: `Server error: ${e.message}` },
      { status: 500, headers: corsHeaders }
    );
  }
}

