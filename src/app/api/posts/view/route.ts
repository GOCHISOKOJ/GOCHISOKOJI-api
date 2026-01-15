import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { postId } = await request.json();

    if (!postId || typeof postId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'postId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Service Role Keyを使用してRLSをバイパス
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 現在の閲覧数を取得
    const { data: post, error: fetchError } = await adminSupabase
      .from('posts')
      .select('view_count')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 閲覧数をインクリメント
    const newViewCount = (post.view_count || 0) + 1;
    const { error: updateError } = await adminSupabase
      .from('posts')
      .update({ view_count: newViewCount })
      .eq('id', postId);

    if (updateError) {
      console.error('View count update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update view count' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, viewCount: newViewCount },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    console.error('View count API error:', e);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
