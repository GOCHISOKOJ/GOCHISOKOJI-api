// Gemini API クライアント
// NOTE:
// - AI Studio の "Get code" が示すモデル (例: gemini-3-pro-preview) を確実に叩くため、
//   旧SDK(@google/generative-ai)ではなくHTTPで直接呼び出す実装に寄せています。

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  promptFeedback?: any;
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
};

type GenerateOptions = {
  model?: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
};

type EmbedOptions = {
  model?: string;
  /**
   * Embedding task type hint
   * - RETRIEVAL_DOCUMENT: documents to be searched
   * - RETRIEVAL_QUERY: user query
   */
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
  title?: string;
};

// Gemini APIキーを環境変数から取得
const _API_KEY = process.env.GEMINI_API_KEY;

if (!_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const API_KEY: string = _API_KEY;

function getModelName(options?: GenerateOptions): string {
  return (
    options?.model ||
    process.env.GEMINI_MODEL ||
    // デフォルトモデル
    'gemini-1.5-flash'
  );
}

function joinTextFromResponse(json: GenerateContentResponse): string {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('').trim();
}

function getApiVersionForModel(_model: string): 'v1beta' | 'v1' {
  // まず v1 を試し、モデル未対応なら v1beta にフォールバックする
  return 'v1';
}

const LOG_URL = 'http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750';

async function callEmbedContent(text: string, options?: EmbedOptions): Promise<number[]> {
  const model = options?.model || process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
  const taskType = options?.taskType || 'RETRIEVAL_DOCUMENT';

  const requestBody: any = {
    content: { parts: [{ text }] },
    taskType,
    ...(options?.title ? { title: options.title } : {}),
  };

  async function tryEmbed(apiVersion: 'v1' | 'v1beta') {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:embedContent?key=${encodeURIComponent(API_KEY)}`;
    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const raw = await res.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    // #region agent log
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'client.ts',
        message: 'EMBED_HTTP_RESPONSE',
        data: {
          model,
          apiVersion,
          taskType,
          ok: res.ok,
          status: res.status,
          durationMs: Date.now() - t0,
          rawLength: raw?.length,
          rawPreview: raw?.substring(0, 200),
        },
        timestamp: Date.now(),
        sessionId: 'debug',
        runId: 'embed-debug',
        hypothesisId: 'E1',
      }),
    }).catch(() => {});
    // #endregion

    if (!res.ok) {
      const errMsg = json?.error?.message || `Gemini embedContent failed: HTTP ${res.status} ${res.statusText}`;
      return { ok: false as const, errMsg };
    }

    const values = json?.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      return { ok: false as const, errMsg: 'Gemini embedContent returned empty embedding' };
    }
    const vec = values
      .map((v: any) => (typeof v === 'number' ? v : Number(v)))
      .filter((v: number) => Number.isFinite(v));
    if (vec.length === 0) {
      return { ok: false as const, errMsg: 'Gemini embedContent embedding values were not numbers' };
    }
    return { ok: true as const, vec };
  }

  // Prefer v1beta first for embeddings, fallback to v1
  const first = await tryEmbed('v1beta');
  if (first.ok) return first.vec;
  const second = await tryEmbed('v1');
  if (second.ok) return second.vec;
  throw new Error(first.errMsg || second.errMsg || 'Gemini embedContent failed');
}

async function listModels(apiVersion: 'v1' | 'v1beta'): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(API_KEY)}`;
  const res = await fetch(url, { method: 'GET' });
  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }
  const models: any[] = Array.isArray(json?.models) ? json.models : [];
  const candidates = models
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => String(m?.name || ''))
    .filter(Boolean);

  // #region agent log
  fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts',message:'LIST_MODELS_TEXT',data:{apiVersion,ok:res.ok,status:res.status,modelsCount:models.length,candidatesCount:candidates.length,firstCandidates:candidates.slice(0,15)},timestamp:Date.now(),sessionId:'debug',runId:'text-debug',hypothesisId:'T1'})}).catch(()=>{});
  // #endregion

  return candidates.map((n) => n.replace(/^models\//, ''));
}

function pickPreferredModel(candidates: string[]): string | null {
  if (!candidates.length) return null;
  return (
    candidates.find((n) => /gemini/i.test(n) && /flash/i.test(n)) ||
    candidates.find((n) => /gemini/i.test(n) && /pro/i.test(n)) ||
    candidates[0] ||
    null
  );
}

async function callGenerateContent(prompt: string, options?: GenerateOptions): Promise<string> {
  const initialModel = getModelName(options);
  const initialApiVersion = getApiVersionForModel(initialModel);

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.9,
      topK: options?.topK ?? 40,
      topP: options?.topP ?? 0.95,
      maxOutputTokens: options?.maxOutputTokens ?? 8192,
      ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
    },
  };

  async function tryGenerate(model: string, apiVersion: 'v1' | 'v1beta') {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(API_KEY)}`;
    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const raw = await res.text();
    let json: GenerateContentResponse | null = null;
    try {
      json = raw ? (JSON.parse(raw) as GenerateContentResponse) : null;
    } catch {
      json = null;
    }
    const durationMs = Date.now() - t0;

    // #region agent log
    fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts',message:'TEXT_HTTP_RESPONSE',data:{model,apiVersion,status:res.status,ok:res.ok,durationMs,rawLength:raw?.length,rawPreview:raw?.substring(0,200)},timestamp:Date.now(),sessionId:'debug',runId:'text-debug',hypothesisId:'T2'})}).catch(()=>{});
    // #endregion

    if (!res.ok) {
      const errMsg =
        json?.error?.message ||
        `Gemini API request failed: HTTP ${res.status} ${res.statusText}`;
      return { ok: false as const, status: res.status, errMsg };
    }
    const text = json ? joinTextFromResponse(json) : '';
    return { ok: true as const, status: res.status, text, json, raw, durationMs };
  }

  // 1) 指定モデルで試す
  const first = await tryGenerate(initialModel, initialApiVersion);
  if (first.ok) {
    const durationMs = first.durationMs;
    const text = first.text;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/35dd2980-78af-40fd-a649-80906759f95d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'chat-api',
        hypothesisId: 'CHAT',
        location: 'src/lib/gemini/client.ts',
        message: 'gemini generateContent parsed',
        data: {
          model: initialModel,
          apiVersion: initialApiVersion,
          httpStatus: first.status,
          durationMs,
          rawLen: first.raw?.length ?? 0,
          candidatesCount: first.json?.candidates?.length ?? 0,
          partsCount: first.json?.candidates?.[0]?.content?.parts?.length ?? 0,
          outLen: text.length,
          hasError: !!first.json?.error,
          hasPromptFeedback: !!first.json?.promptFeedback,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // 空文字（partsが空など）の場合は呼び出し側でハンドリングする（ここで無効モデルにフォールバックしない）

    return text;
  }

  // 2) モデル未対応なら ListModels → 実在モデルへフォールバック（v1→v1beta）
  const versions: Array<'v1' | 'v1beta'> = [initialApiVersion, initialApiVersion === 'v1' ? 'v1beta' : 'v1'];
  for (const v of versions) {
    const candidates = await listModels(v);
    const preferred = pickPreferredModel(candidates);
    if (!preferred) continue;
    const attempt = await tryGenerate(preferred, v);
    if (attempt.ok) {
      // #region agent log
      fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts',message:'TEXT_FALLBACK_SUCCESS',data:{fromModel:initialModel,toModel:preferred,apiVersion:v,textLength:attempt.text.length},timestamp:Date.now(),sessionId:'debug',runId:'text-debug',hypothesisId:'T3'})}).catch(()=>{});
      // #endregion
      return attempt.text;
    }
  }

  throw new Error(first.errMsg || 'Gemini API request failed');
}

/**
 * テキスト生成を実行（HTTP v1）
 */
export async function generateText(prompt: string, options?: GenerateOptions): Promise<string> {
  return await callGenerateContent(prompt, options);
}

/**
 * テキストのEmbeddingを生成（RAG用）
 */
export async function embedText(text: string, options?: EmbedOptions): Promise<number[]> {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('embedText: text is empty');
  return await callEmbedContent(trimmed, options);
}

/**
 * JSON形式でレスポンスを生成
 */
export async function generateJSON<T>(prompt: string): Promise<T> {
  const text = await generateText(prompt);
  
  // JSONの抽出（```jsonブロックがある場合）
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;
  
  try {
    return JSON.parse(jsonText) as T;
  } catch (error) {
    // 追加フォールバック: { ... } を抽出して再パース
    const objMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {
        // ignore
      }
    }
    console.error('Failed to parse JSON from Gemini response:', error);
    console.error('Response text:', text);
    throw new Error('Gemini APIからのレスポンスをパースできませんでした');
  }
}

/**
 * チャットメッセージの型定義
 */
export type ChatMessage = {
  role: 'user' | 'model';
  text?: string;
  parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
};

/**
 * 会話履歴を使ったチャット返答生成
 * Gemini APIの会話履歴機能を使って、文脈を理解した自然な会話を実現
 */
export async function generateChatReply(
  messages: ChatMessage[],
  systemInstruction?: string,
  options?: GenerateOptions
): Promise<string> {
  const LOG_URL = 'http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750';

  const initialModel = getModelName(options);
  const initialApiVersion = getApiVersionForModel(initialModel);

  // 会話履歴をGemini API形式に変換
  // システムインストラクションがある場合は最初のuserメッセージに含める（v1 API対応）
  let contents = messages.map((msg) => ({
    role: msg.role,
    parts: Array.isArray(msg.parts) && msg.parts.length > 0 ? msg.parts : [{ text: msg.text ?? '' }],
  }));

  // システムプロンプトを最初のuserメッセージの前に追加
  if (systemInstruction && contents.length > 0) {
    // 最初のuserメッセージを見つけて、その前にシステムプロンプトを挿入
    const firstUserIndex = contents.findIndex(c => c.role === 'user');
    if (firstUserIndex >= 0) {
      const existingParts = Array.isArray(contents[firstUserIndex].parts) ? contents[firstUserIndex].parts : [];
      const firstTextIdx = existingParts.findIndex((p: any) => typeof p?.text === 'string');
      const originalText =
        firstTextIdx >= 0 && typeof (existingParts[firstTextIdx] as any).text === 'string'
          ? String((existingParts[firstTextIdx] as any).text)
          : '';
      const injectedText = `【システム設定】\n${systemInstruction}\n\n【ユーザーのメッセージ】\n${originalText}`;
      const nextParts = [...existingParts];
      if (firstTextIdx >= 0) {
        nextParts[firstTextIdx] = { ...(nextParts[firstTextIdx] as any), text: injectedText };
      } else {
        nextParts.unshift({ text: injectedText });
      }
      contents[firstUserIndex] = {
        role: 'user',
        parts: nextParts,
      };
    }
  }

  const requestBody: any = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      topK: options?.topK ?? 40,
      topP: options?.topP ?? 0.95,
      maxOutputTokens: options?.maxOutputTokens ?? 1024,
    },
  };

  async function listModels(apiVersion: 'v1' | 'v1beta') {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url, { method: 'GET' });
    const raw = await res.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    const models: any[] = Array.isArray(json?.models) ? json.models : [];
    const candidates = models
      .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m?.name || ''))
      .filter(Boolean);

    // #region agent log
    fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:generateChatReply',message:'LIST_MODELS',data:{apiVersion,ok:res.ok,status:res.status,modelsCount:models.length,candidatesCount:candidates.length,firstCandidates:candidates.slice(0,15)},timestamp:Date.now(),sessionId:'debug',runId:'client-debug',hypothesisId:'C5'})}).catch(()=>{});
    // #endregion

    return { ok: res.ok, status: res.status, candidates };
  }

  async function tryGenerate(model: string, apiVersion: 'v1' | 'v1beta'): Promise<{ ok: true; status: number; text: string } | { ok: false; status: number; errMsg: string }> {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(API_KEY)}`;
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchErr: any) {
      // #region agent log
      fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:generateChatReply',message:'FETCH_ERROR',data:{model,apiVersion,error:fetchErr?.message},timestamp:Date.now(),sessionId:'debug',runId:'client-debug',hypothesisId:'C1'})}).catch(()=>{});
      // #endregion
      throw fetchErr;
    }

    const raw = await res.text();
    let json: GenerateContentResponse | null = null;
    try {
      json = raw ? (JSON.parse(raw) as GenerateContentResponse) : null;
    } catch {
      json = null;
    }

    const durationMs = Date.now() - t0;

    // #region agent log
    fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:generateChatReply',message:'HTTP_RESPONSE',data:{model,apiVersion,status:res.status,ok:res.ok,durationMs,rawLength:raw?.length,rawPreview:raw?.substring(0,200)},timestamp:Date.now(),sessionId:'debug',runId:'client-debug',hypothesisId:'C2'})}).catch(()=>{});
    // #endregion

    if (!res.ok) {
      const errMsg =
        json?.error?.message ||
        `Gemini API request failed: HTTP ${res.status} ${res.statusText}`;
      // #region agent log
      fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:generateChatReply',message:'API_ERROR',data:{model,apiVersion,status:res.status,errMsg,rawPreview:raw?.substring(0,300)},timestamp:Date.now(),sessionId:'debug',runId:'client-debug',hypothesisId:'C3'})}).catch(()=>{});
      // #endregion
      return { ok: false as const, status: res.status, errMsg };
    }

    const text = json ? joinTextFromResponse(json) : '';
    // #region agent log
    fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:generateChatReply',message:'SUCCESS',data:{model,apiVersion,status:res.status,durationMs,textLength:text.length,textPreview:text.substring(0,200)},timestamp:Date.now(),sessionId:'debug',runId:'client-debug',hypothesisId:'C4'})}).catch(()=>{});
    // #endregion

    return { ok: true as const, status: res.status, text };
  }

  // 1) まず指定モデル + 初期APIバージョンで試す
  const first = await tryGenerate(initialModel, initialApiVersion);
  if (first.ok) return first.text;

  // 2) モデル未対応っぽい場合は ListModels して候補から選ぶ（v1→v1betaの順）
  const versions: Array<'v1' | 'v1beta'> = [initialApiVersion, initialApiVersion === 'v1' ? 'v1beta' : 'v1'];
  for (const v of versions) {
    const listed = await listModels(v);
    if (!listed.candidates.length) continue;

    // Prefer: gemini-*flash*, then gemini-*pro*, then first
    const preferred =
      listed.candidates.find((n) => /gemini/i.test(n) && /flash/i.test(n)) ||
      listed.candidates.find((n) => /gemini/i.test(n) && /pro/i.test(n)) ||
      listed.candidates[0];

    if (!preferred) continue;
    const modelName = preferred.replace(/^models\//, '');
    const attempt = await tryGenerate(modelName, v);
    if (attempt.ok) return attempt.text;
  }

  // 最後に最初のエラーを投げる
  throw new Error(first.errMsg || 'Gemini API request failed');
}


