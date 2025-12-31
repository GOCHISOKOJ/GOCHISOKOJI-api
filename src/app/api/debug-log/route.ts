import { NextResponse } from 'next/server';

export async function POST() {
  // デバッグログは開発環境でのみ使用。本番では何もせず成功を返す
  return NextResponse.json({ ok: true });
}






