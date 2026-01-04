import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ModelListResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
  error?: { message?: string };
};

async function fetchModelList(apiVersion: 'v1' | 'v1beta') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(
    key
  )}`;
  const res = await fetch(url, { method: 'GET' });
  const json = (await res.json().catch(() => ({}))) as ModelListResponse;
  if (!res.ok) throw new Error(json?.error?.message || `ListModels failed: ${res.status}`);
  return json;
}

export async function GET() {
  try {
    const t0 = Date.now();
    let json: ModelListResponse | null = null;
    let apiVersion: 'v1' | 'v1beta' = 'v1beta';
    try {
      json = await fetchModelList('v1beta');
      apiVersion = 'v1beta';
    } catch {
      json = await fetchModelList('v1');
      apiVersion = 'v1';
    }

    const models = (json?.models ?? [])
      .map((m) => ({
        name: m.name ?? null,
        methods: m.supportedGenerationMethods ?? [],
      }))
      .filter((m) => !!m.name);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'chat-api',
        hypothesisId: 'CHAT',
        location: 'src/app/api/gemini-models/route.ts',
        message: 'listed models',
        data: { apiVersion, count: models.length, durationMs: Date.now() - t0 },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return NextResponse.json({ success: true, apiVersion, models });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}





