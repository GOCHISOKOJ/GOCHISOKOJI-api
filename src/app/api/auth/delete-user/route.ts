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

// 開発/デバッグ用: 指定したメールアドレスのユーザーを削除
export async function POST(request: NextRequest) {
  try {
    const { email, adminKey } = await request.json();

    // 簡易的な保護（本番では削除するか、より強固な認証を使用）
    if (adminKey !== 'koji-admin-2024') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
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
      return NextResponse.json(
        { success: false, error: listError.message },
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

    // ユーザーを削除
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} has been deleted`,
    }, { headers: corsHeaders });

  } catch (e: any) {
    console.error('Delete user error:', e);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

