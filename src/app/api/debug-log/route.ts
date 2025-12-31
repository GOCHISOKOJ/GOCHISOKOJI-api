import { NextResponse } from 'next/server';
import { appendFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const line = body.endsWith('\n') ? body : `${body}\n`;
    const logDir = path.join(process.cwd(), '.cursor');
    const logPath = path.join(logDir, 'debug.log');
    await mkdir(logDir, { recursive: true });
    await appendFile(logPath, line, { encoding: 'utf8' });

    // ベストエフォートでingestにも転送（CORS回避のためサーバー側で実施）
    fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}






